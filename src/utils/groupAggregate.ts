import type { PurposeValue } from '../components/PurposeSelect';
import type { VibeState } from '../components/VibeSelect';

// 그룹 모드: 멤버들이 각자 제출한 조건을 하나의 추천 입력으로 집계

export interface GroupMember {
  member_name: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  purpose_first?: string | null;
  purpose_second?: string | null;
  vibe_atmosphere: string | null;
  vibe_budget: string | null;
  vibe_keywords?: string[];
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
