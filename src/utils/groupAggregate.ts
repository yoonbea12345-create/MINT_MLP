import type { PurposeValue } from '../components/PurposeSelect';
import type { VibeState } from '../components/VibeSelect';

// 그룹 모드: 멤버들이 각자 제출한 조건을 하나의 추천 입력으로 집계

export interface GroupMember {
  member_name: string;
  location_name: string | null;
  // 임의 지역 모드 게스트는 출발지를 입력하지 않으므로 좌표가 null일 수 있다
  location_lat: number | null;
  location_lng: number | null;
  purpose_first?: string | null;
  purpose_second?: string | null;
  vibe_atmosphere: string | null;
  vibe_budget: string | null;
  vibe_keywords?: string[];
}

// 편식 항목은 DB 스키마 변경 없이 vibe_keywords에 접두사로 실어 보낸다 (MemberInput에서 인코딩)
export const EXCLUDE_FOOD_PREFIX = '안먹:';

// 멤버 키워드에서 일반 키워드와 편식(못 먹는 음식) 항목을 분리 — 편식은 전원 합집합(한 명이라도 못 먹으면 제외)
export function splitMemberKeywords(members: GroupMember[]): { keywords: string[]; excludeFoods: string[] } {
  const all = members.flatMap((m) => m.vibe_keywords ?? []);
  return {
    keywords: Array.from(new Set(all.filter((k) => !k.startsWith(EXCLUDE_FOOD_PREFIX)))),
    excludeFoods: Array.from(new Set(
      all.filter((k) => k.startsWith(EXCLUDE_FOOD_PREFIX)).map((k) => k.slice(EXCLUDE_FOOD_PREFIX.length).trim()).filter(Boolean),
    )),
  };
}

export function aggregatePurpose(members: GroupMember[]): PurposeValue | null {
  const fc: Record<string, number> = {};
  const sc: Record<string, number> = {};
  members.forEach((m) => {
    if (m.purpose_first) fc[m.purpose_first] = (fc[m.purpose_first] || 0) + 1;
    if (m.purpose_second) sc[m.purpose_second] = (sc[m.purpose_second] || 0) + 1;
  });
  const topFirst = Object.entries(fc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topSecond = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '없음';
  if (!topFirst) return null;
  const toRaw = (v: string | null): '밥' | '술' | '카페' | '기타' | null =>
    ['밥', '술', '카페'].includes(v ?? '') ? (v as '밥' | '술' | '카페') : v ? '기타' : null;
  return {
    first: topFirst,
    firstRaw: toRaw(topFirst),
    second: topSecond,
    secondRaw: topSecond === '없음' ? '없음' : toRaw(topSecond),
    relation: null,
    occasion: null,
  };
}

export function aggregateVibe(members: GroupMember[]): VibeState {
  const counts: Record<string, number> = {};
  members.forEach((m) => {
    if (m.vibe_atmosphere) counts[m.vibe_atmosphere] = (counts[m.vibe_atmosphere] || 0) + 1;
  });
  const topAtm = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return topAtm ? { 분위기: { first: topAtm, second: null } } : {};
}

// 멤버들이 각자 고른 예산을 하나로 집계 — 최빈값, 동률이면 낮은 예산 우선(보수적).
// 예산이 낮게 잡히면 모두가 부담 없는 선택이 되므로 동률 시 저가 쪽을 택한다.
const BUDGET_ORDER = ['~2만원', '2~4만원', '4만원+'];
export function aggregateBudget(members: GroupMember[]): string | null {
  const counts: Record<string, number> = {};
  members.forEach((m) => {
    if (m.vibe_budget) counts[m.vibe_budget] = (counts[m.vibe_budget] || 0) + 1;
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  const maxCount = Math.max(...entries.map(([, c]) => c));
  // 최빈값이 여럿이면 BUDGET_ORDER상 가장 낮은(저가) 예산 선택
  const tied = entries.filter(([, c]) => c === maxCount).map(([b]) => b);
  tied.sort((a, b) => BUDGET_ORDER.indexOf(a) - BUDGET_ORDER.indexOf(b));
  return tied[0] ?? null;
}
