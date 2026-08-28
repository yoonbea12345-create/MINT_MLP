// 상시 유저 피드백 — 초안 보관 · 아웃박스 선저장 · 재전송.
//
// 핵심 원리는 "선저장 후전송"이다. 유저가 보내기를 누른 순간 payload를 먼저 localStorage에 쓰고,
// 그 다음에야 네트워크를 탄다. 네트워크는 전송 수단일 뿐 진실의 원본이 아니다 —
// 그래서 화면은 전송 결과를 기다리지 않고 즉시 성공으로 넘어가도 거짓말이 아니다.

import { getDeviceId } from './points';
import { getSessionKey, trackEvent } from './analytics';

const DRAFT_KEY = 'mint_feedback_draft';
const OUTBOX_KEY = 'mint_feedback_outbox';

// 쓰다 만 불만은 하루쯤 유효하다 — 입력 초안(6시간)보다 넉넉하게 잡는다.
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const OUTBOX_MAX = 10;
const SEND_TIMEOUT_MS = 5000;

export const FEEDBACK_MIN_LEN = 2;
export const FEEDBACK_MAX_LEN = 500;
// 카운터를 처음부터 보여주면 "길게 써야 하나?" 압박이 된다. 한계가 가까워질 때만 켠다.
export const FEEDBACK_COUNTER_FROM = 400;

export type FeedbackCategory = 'bug' | 'pain' | 'idea' | 'praise';

// 미선택 허용 — 자동 추론은 오분류 시 어드민 데이터만 오염시킨다. 어차피 원문은 사람이 읽는다.
export const CATEGORY_OPTIONS: { value: FeedbackCategory; emoji: string; label: string }[] = [
  { value: 'bug', emoji: '🐞', label: '버그' },
  { value: 'pain', emoji: '😣', label: '불편해요' },
  { value: 'idea', emoji: '💡', label: '아이디어' },
  { value: 'praise', emoji: '💚', label: '칭찬' },
];

export interface FeedbackDraft {
  text: string;
  category: FeedbackCategory | null;
  contact: string;
  savedAt: number;
}

interface FeedbackPayload {
  id: string;
  text: string;
  category: FeedbackCategory | null;
  contact: string | null;
  context: {
    route: string;
    tab: string;
    sessionKey: string | null;
    deviceId: string;
    viewport: string;
  };
}

function isCategory(v: unknown): v is FeedbackCategory {
  return v === 'bug' || v === 'pain' || v === 'idea' || v === 'praise';
}

// pilot의 'pf' 패턴 답습 — 혼동문자를 뺀 소문자·숫자 14자. 서버 PK라 멱등성 키를 겸한다.
function makeFeedbackId(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = 'fb';
  for (let i = 0; i < 14; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/* ── 초안 ── */

let draftTimer: ReturnType<typeof setTimeout> | null = null;

export function loadDraft(): FeedbackDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeedbackDraft> | null;
    if (!parsed || typeof parsed.text !== 'string' || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return {
      text: parsed.text,
      category: isCategory(parsed.category) ? parsed.category : null,
      contact: typeof parsed.contact === 'string' ? parsed.contact : '',
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

// 입력이 바뀔 때마다 부르되 실제 쓰기는 500ms 뒤 한 번 — 타이핑마다 JSON.stringify 하지 않는다.
export function saveDraftDebounced(draft: Omit<FeedbackDraft, 'savedAt'>): void {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftTimer = null;
    try {
      if (!draft.text.trim() && !draft.contact.trim() && draft.category == null) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch { /* 저장 실패는 치명적이지 않음 */ }
  }, 500);
}

// 예약된 디바운스 쓰기까지 같이 취소한다 — 안 그러면 제출 직후 지운 초안이 500ms 뒤 되살아난다.
export function clearDraft(): void {
  if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/* ── 아웃박스 ── */

function readOutbox(): FeedbackPayload[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is FeedbackPayload =>
        !!p && typeof p === 'object' &&
        typeof (p as FeedbackPayload).id === 'string' &&
        typeof (p as FeedbackPayload).text === 'string',
    );
  } catch {
    return [];
  }
}

function writeOutbox(items: FeedbackPayload[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch { /* 용량 초과 등 — 이미 보낸 건 서버에 남는다 */ }
}

function dropFromOutbox(id: string): void {
  writeOutbox(readOutbox().filter((p) => p.id !== id));
}

// 전송 1건. 성공/영구실패면 아웃박스에서 빼고, 일시적 실패면 남겨 다음 기회를 노린다.
async function send(payload: FeedbackPayload): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) {
      dropFromOutbox(payload.id);
      return;
    }
    // 400은 서버가 영원히 받아주지 않을 형식이다. 계속 재전송해봐야 아웃박스 자리만 막는다.
    // 429/5xx는 "지금은 안 되지만 나중엔 된다"이므로 그대로 둔다.
    if (res.status === 400) {
      dropFromOutbox(payload.id);
      return;
    }
    trackEvent('feedback_send_fail', { device_id: getDeviceId(), reason: 'server' });
  } catch {
    // 타임아웃·오프라인 — 유저에게 알리지 않는다. 앱을 다시 켜면 알아서 다시 보낸다.
    trackEvent('feedback_send_fail', { device_id: getDeviceId(), reason: 'network' });
  } finally {
    clearTimeout(timer);
  }
}

// 앱을 켤 때(AppShell 마운트) · 피드백 시트를 열 때 각각 1회 — 밀린 건을 조용히 흘려보낸다.
// 서버가 id PK 충돌을 ok로 응답하므로 중복 저장은 구조적으로 불가능하다.
export function flushOutbox(): void {
  for (const payload of readOutbox()) void send(payload);
}

/* ── 제출 ── */

export interface FeedbackInput {
  text: string;
  category: FeedbackCategory | null;
  contact: string | null;
  tab: string;
}

/**
 * 제출 — 아웃박스에 먼저 쓰고 전송을 시작한다(결과를 기다리지 않는다).
 * 호출부는 이 함수가 돌아온 직후 성공 화면으로 넘어가면 된다.
 */
export function submitFeedback(input: FeedbackInput): void {
  const text = input.text.trim().slice(0, FEEDBACK_MAX_LEN);
  if (text.length < FEEDBACK_MIN_LEN) return;
  const contact = input.contact?.trim().slice(0, 100) || null;

  const payload: FeedbackPayload = {
    id: makeFeedbackId(),
    text,
    category: input.category,
    contact,
    context: {
      route: window.location.pathname,
      tab: input.tab,
      sessionKey: getSessionKey(),
      deviceId: getDeviceId(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  };

  // [1] 선저장 — 여기까지 오면 이 문장은 이미 기기에 영구 보존됐다. 오래된 것부터 밀어낸다.
  writeOutbox([...readOutbox(), payload].slice(-OUTBOX_MAX));
  clearDraft();
  // [2] 후전송 — 실패해도 아웃박스에 남아 다음 실행 때 재시도된다.
  void send(payload);
}
