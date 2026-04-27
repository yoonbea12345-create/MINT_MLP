const API_KEY = import.meta.env.VITE_SEOUL_DATA_API_KEY;

export type CongestionLevel = '여유' | '보통' | '약간 붐빔' | '붐빔' | '알 수 없음';

export interface AreaCongestion {
  areaName: string;
  level: CongestionLevel;
  message: string;
}

export async function getCongestion(areaName: string): Promise<AreaCongestion> {
  try {
    const encoded = encodeURIComponent(areaName);
    const res = await fetch(
      `/api/seoul/${API_KEY}/json/citydata_ppltn/1/1/${encoded}`
    );
    if (!res.ok) throw new Error('서울 데이터 API 오류');
    const data = await res.json();
    const ppltn = data?.SeoulRtd?.row?.[0];
    if (!ppltn) throw new Error('데이터 없음');

    const level = ppltn.AREA_CONGEST_LVL as CongestionLevel;
    const message = ppltn.AREA_CONGEST_MSG ?? '';
    return { areaName, level, message };
  } catch {
    return { areaName, level: '알 수 없음', message: '' };
  }
}

export async function getMultiAreaCongestion(
  areaNames: string[]
): Promise<AreaCongestion[]> {
  const results = await Promise.allSettled(areaNames.map(getCongestion));
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { areaName: areaNames[i], level: '알 수 없음' as CongestionLevel, message: '' }
  );
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
