// 서울 실시간 도시데이터(citydata_ppltn) 혼잡도 조회 — api/congestion.ts와 recommend 서버 병렬 조회에서 공용
export interface AreaCongestion {
  areaName: string;
  level: string;
  message: string;
}

export const UNKNOWN_CONGESTION = (areaName: string): AreaCongestion => ({ areaName, level: '알 수 없음', message: '' });

async function fetchArea(areaName: string, key: string): Promise<AreaCongestion> {
  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/1/${encodeURIComponent(areaName)}`;
    const res = await fetch(url);
    if (!res.ok) return UNKNOWN_CONGESTION(areaName);
    const data = await res.json() as Record<string, unknown>;
    // 응답 스키마가 두 형태로 관측됨 — 둘 다 수용
    const rows =
      (data?.['SeoulRtd.citydata_ppltn'] as { AREA_CONGEST_LVL?: string; AREA_CONGEST_MSG?: string }[] | undefined) ??
      ((data?.SeoulRtd as { row?: { AREA_CONGEST_LVL?: string; AREA_CONGEST_MSG?: string }[] } | undefined)?.row);
    const p = rows?.[0];
    if (!p?.AREA_CONGEST_LVL) return UNKNOWN_CONGESTION(areaName);
    return { areaName, level: p.AREA_CONGEST_LVL, message: p.AREA_CONGEST_MSG ?? '' };
  } catch {
    return UNKNOWN_CONGESTION(areaName);
  }
}

export async function fetchCongestion(areas: string[]): Promise<AreaCongestion[]> {
  const key = (process.env.SEOUL_DATA_API_KEY ?? process.env.VITE_SEOUL_DATA_API_KEY ?? '').trim();
  if (!key || areas.length === 0) return areas.map(UNKNOWN_CONGESTION);
  return Promise.all(areas.map((a) => fetchArea(a, key)));
}
