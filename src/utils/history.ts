// 추천 히스토리 — localStorage에 최근 5개 보관.
// snapshot은 Home의 결과 복원 스냅샷(RESULT_STORAGE_KEY 포맷) 그대로라,
// 히스토리 클릭 시 sessionStorage에 넣고 /app으로 이동하면 결과 화면이 그대로 살아난다.

export const RESULT_STORAGE_KEY = 'mint_last_result_v1';
const HISTORY_KEY = 'mint_history_v1';
const MAX_ENTRIES = 5;

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

// 히스토리 항목을 결과 화면으로 복원 — 스냅샷을 세션에 심고 /app으로 이동
export function openHistoryEntry(entry: HistoryEntry) {
  try {
    sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(entry.snapshot));
  } catch { /* ignore */ }
  window.location.pathname = '/app';
}
