// 추천 히스토리 — localStorage에 최근 5개 보관.
// snapshot은 Home의 결과 복원 스냅샷(RESULT_STORAGE_KEY 포맷) 그대로라,
// 히스토리 클릭 시 스냅샷을 심고 /app으로 이동하면 결과 화면이 그대로 살아난다.

export const RESULT_STORAGE_KEY = 'mint_last_result_v1';
const HISTORY_KEY = 'mint_history_v1';
const MAX_ENTRIES = 5;

// 결과 스냅샷은 localStorage에 보관 — 모바일에서 홈버튼·카톡 공유 등으로 앱을 벗어나면
// OS가 웹뷰 프로세스를 재시작하며 sessionStorage가 통째로 날아가 추천이 초기화되던 문제 방지.
// 유효기간이 지난 스냅샷은 자동 복원하지 않는다 (지난 약속이 불쑥 뜨지 않게 — 히스토리로는 여전히 열람 가능)
const RESULT_TTL_MS = 24 * 60 * 60 * 1000;

export function saveResultSnapshot(snapshot: unknown) {
  try {
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot }));
  } catch { /* 저장 실패는 치명적이지 않음 */ }
}

export function loadResultSnapshot(): unknown | null {
  try {
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.savedAt === 'number' && parsed.snapshot) {
        if (Date.now() - parsed.savedAt <= RESULT_TTL_MS) return parsed.snapshot;
        localStorage.removeItem(RESULT_STORAGE_KEY);
        return null;
      }
    }
    // 구버전(sessionStorage 직저장) 스냅샷 마이그레이션 — 배포 시점에 결과 화면이던 세션 보호
    const legacy = sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (legacy) {
      const snapshot = JSON.parse(legacy);
      sessionStorage.removeItem(RESULT_STORAGE_KEY);
      saveResultSnapshot(snapshot);
      return snapshot;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearResultSnapshot() {
  try {
    localStorage.removeItem(RESULT_STORAGE_KEY);
    sessionStorage.removeItem(RESULT_STORAGE_KEY);
  } catch { /* ignore */ }
}

export interface HistoryEntry {
  savedAt: number;
  placeName: string;
  secondPlaceName?: string | null;
  areaName?: string | null;
  purposeFirst?: string | null;
  snapshot: unknown;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e && typeof e === 'object' && typeof e.placeName === 'string' && typeof e.savedAt === 'number' && !!e.snapshot,
    );
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry) {
  try {
    // 같은 코스(1차+2차 조합)는 최신 것 하나만 유지
    const rest = loadHistory().filter(
      (e) => !(e.placeName === entry.placeName && (e.secondPlaceName ?? null) === (entry.secondPlaceName ?? null)),
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_ENTRIES)));
  } catch { /* 저장 실패는 치명적이지 않음 */ }
}

// 히스토리 항목을 결과 화면으로 복원 — 스냅샷을 심고 /app으로 이동
export function openHistoryEntry(entry: HistoryEntry) {
  saveResultSnapshot(entry.snapshot);
  window.location.pathname = '/app';
}
