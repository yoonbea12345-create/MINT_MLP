export type CongestionLevel = '여유' | '보통' | '약간 붐빔' | '붐빔' | '알 수 없음';

export interface AreaCongestion {
  areaName: string;
  level: CongestionLevel;
  message: string;
}

// 서버리스(/api/congestion)를 통해 조회 — 키 노출 없음, 프로덕션에서도 동작
export async function getMultiAreaCongestion(
  areaNames: string[]
): Promise<AreaCongestion[]> {
  const unknown = (areaName: string): AreaCongestion => ({ areaName, level: '알 수 없음', message: '' });
  if (areaNames.length === 0) return [];
  try {
    const res = await fetch(`/api/congestion?areas=${encodeURIComponent(areaNames.join(','))}`);
    if (!res.ok) return areaNames.map(unknown);
    const data = await res.json() as { areas?: AreaCongestion[] };
    if (!Array.isArray(data.areas)) return areaNames.map(unknown);
    // 요청 순서 보존 + 누락분 폴백
    return areaNames.map((name) => data.areas!.find((a) => a.areaName === name) ?? unknown(name));
  } catch {
    return areaNames.map(unknown);
  }
}

export function congestionColor(level: CongestionLevel): string {
  switch (level) {
    case '여유': return '#22c55e';
    case '보통': return '#eab308';
    case '약간 붐빔': return '#f97316';
    case '붐빔': return '#ef4444';
    default: return '#9ca3af';
  }
}

export function congestionDotClass(level: CongestionLevel): string {
  switch (level) {
    case '여유': return 'bg-green-400';
    case '보통': return 'bg-yellow-400';
    case '약간 붐빔': return 'bg-orange-400';
    case '붐빔': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
}
