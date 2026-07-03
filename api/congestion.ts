import type { VercelRequest, VercelResponse } from '@vercel/node';

// 서울 실시간 도시데이터(citydata_ppltn) 혼잡도 조회.
// 기존에는 클라이언트가 vite dev 프록시(/api/seoul)로 직접 호출했는데, 그 프록시는
// 개발 서버 전용이라 프로덕션에서는 항상 실패("알 수 없음" 폴백)했다. 서버리스로 이전.
// 키는 서버 env(SEOUL_DATA_API_KEY) 우선, 과거 클라이언트용 VITE_ 키를 폴백으로 허용.

interface AreaCongestion {
  areaName: string;
  level: string;
  message: string;
}

const UNKNOWN = (areaName: string): AreaCongestion => ({ areaName, level: '알 수 없음', message: '' });

async function fetchArea(areaName: string, key: string): Promise<AreaCongestion> {
  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/1/${encodeURIComponent(areaName)}`;
    const res = await fetch(url);
    if (!res.ok) return UNKNOWN(areaName);
    const data = await res.json() as Record<string, unknown>;
    // 응답 스키마가 두 형태로 관측됨 — 둘 다 수용
    const rows =
      (data?.['SeoulRtd.citydata_ppltn'] as { AREA_CONGEST_LVL?: string; AREA_CONGEST_MSG?: string }[] | undefined) ??
      ((data?.SeoulRtd as { row?: { AREA_CONGEST_LVL?: string; AREA_CONGEST_MSG?: string }[] } | undefined)?.row);
    const p = rows?.[0];
    if (!p?.AREA_CONGEST_LVL) return UNKNOWN(areaName);
    return { areaName, level: p.AREA_CONGEST_LVL, message: p.AREA_CONGEST_MSG ?? '' };
  } catch {
    return UNKNOWN(areaName);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const raw = Array.isArray(req.query.areas) ? req.query.areas[0] : req.query.areas;
  const areas = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (areas.length === 0) return res.status(400).json({ error: 'areas 파라미터가 필요해요.' });

  const key = (process.env.SEOUL_DATA_API_KEY ?? process.env.VITE_SEOUL_DATA_API_KEY ?? '').trim();
  if (!key) {
    return res.status(200).json({ areas: areas.map(UNKNOWN) });
  }

  const results = await Promise.all(areas.map((a) => fetchArea(a, key)));
  // 혼잡도는 분 단위로 변하므로 CDN 2분 캐시
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return res.status(200).json({ areas: results });
}
