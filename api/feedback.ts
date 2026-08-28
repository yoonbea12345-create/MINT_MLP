import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { clientIp, checkRateLimit } from './_lib/guard.js';

// 상시 유저 피드백 수집 — POST only. pilot-feedback.ts 컨벤션(service role, clientIp, 한국어 에러) 그대로.
//
// 이 엔드포인트의 유일한 책임은 "유저가 쓴 문장을 잃지 않는 것"이다.
// 그래서 실패로 끝나는 경로를 최대한 줄였다: id 중복은 성공으로 흡수하고(아웃박스 재전송의 정상 경로),
// 테이블이 아직 없으면 events로 흘려보낸다(마이그레이션 전 배포에서도 한 건도 안 버린다).

const CATEGORIES = ['bug', 'pain', 'idea', 'praise'] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

// 유저가 직접 쓰지 않은 맥락 필드는 길이가 이상해도 400을 내지 않고 잘라서 담는다.
// 여기서 거절하면 정작 소중한 본문까지 같이 버려진다.
function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  // 분당 3건(진심인 유저도 연속 3건이면 충분) · 엔드포인트 전체 일 300건(도배 서킷브레이커).
  // 테이블/DB 장애 시 통과(fail-open)는 guard가 이미 처리한다.
  const ip = clientIp(req);
  const gate = await checkRateLimit(supabase, 'feedback', ip, 3, 300);
  if (!gate.allowed) return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });

  const body = (req.body ?? {}) as {
    id?: unknown;
    text?: unknown;
    category?: unknown;
    contact?: unknown;
    context?: unknown;
  };

  const invalid = '내용을 확인해주세요.';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';

  if (!/^fb[a-z0-9]{14}$/.test(id)) return res.status(400).json({ error: invalid });
  if (text.length < 2 || text.length > 500) return res.status(400).json({ error: invalid });
  if (body.category != null && !isCategory(body.category)) return res.status(400).json({ error: invalid });
  if (contact.length > 100) return res.status(400).json({ error: invalid });

  const category: Category | null = isCategory(body.category) ? body.category : null;
  const ctx = (body.context ?? {}) as Record<string, unknown>;
  const route = clip(ctx.route, 120);
  const tab = clip(ctx.tab, 20);
  const sessionKey = clip(ctx.sessionKey, 64);
  const deviceId = clip(ctx.deviceId, 64);
  const viewport = clip(ctx.viewport, 20);

  const rawUa = req.headers['user-agent'];
  const userAgent = clip(Array.isArray(rawUa) ? rawUa[0] : rawUa, 300);

  const row = {
    id,
    text,
    category,
    contact: contact || null,
    route,
    tab,
    session_key: sessionKey,
    device_id: deviceId,
    user_agent: userAgent,
    viewport,
  };

  // 같은 기기가 같은 문장을 5분 안에 또 보냈다면 연타/재전송 경합이다. 조용히 접수 처리한다.
  // (id가 다르면 PK 충돌로 못 막으므로 여기서 한 번 걸러낸다 — 쿼리 1개.)
  if (deviceId) {
    const dup = await supabase
      .from('user_feedback').select('id')
      .eq('device_id', deviceId).eq('text', text)
      .gte('created_at', new Date(Date.now() - 300_000).toISOString())
      .limit(1).maybeSingle();
    if (dup.data) return res.status(200).json({ ok: true });
    // dup.error(테이블 미생성 등)는 무시 — 아래 insert가 폴백까지 책임진다.
  }

  const { error } = await supabase.from('user_feedback').insert(row);
  if (!error) return res.status(200).json({ ok: true });

  // 아웃박스가 이미 저장된 건을 다시 보낸 경우 — 재전송의 정상 경로다.
  if (error.code === '23505') return res.status(200).json({ ok: true });

  // sql/user-feedback.sql 미실행(42P01 테이블 없음 / 42703 컬럼 없음) → events로 흘려보낸다.
  // analytics.ts·pilot-feedback.ts의 "수집은 절대 끊기지 않는다" 폴백 철학 그대로.
  if (error.code === '42P01' || error.code === '42703') {
    const fallback = await supabase.from('events').insert({
      type: 'feedback_submit',
      session_key: sessionKey,
      payload: row,
    });
    // events조차 payload/session_key 컬럼이 없는 구스키마면 최소 필드로 한 번 더.
    if (fallback.error) await supabase.from('events').insert({ type: 'feedback_submit' });
    console.warn('[feedback] user_feedback 테이블 없음 — events로 폴백 저장했습니다.');
    return res.status(200).json({ ok: true });
  }

  console.error('[feedback] insert failed', error);
  return res.status(500).json({ error: '잠시 후 다시 시도해주세요.' });
}
