import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { tmToWgs84 } from './_lib/coords';

// 인허가 API(행안부 일반음식점) 배치 적재 — 월 1회 수동 트리거 전용.
// 요청 예시: curl -X POST -H "x-admin-secret: ..." -H "content-type: application/json" \
//   -d '{"regionCodes": ["3220000"]}' https://.../api/admin-refresh-license-cache
//
// ⚠️ OPN_ATMY_GRP_CD(개방자치단체코드)는 행안부 표준 5자리 지역코드가 아니라 LOCALDATA 체계의
// 7자리 코드다(예: 서울 강남구=3220000, 실제 API 응답으로 검증됨). 정확한 코드값은 이 엔드포인트를
// 후보 코드로 먼저 실행해 반환된 addresses로 지역을 확인한 뒤 확정한다 — 추정 코드를 미리
// 하드코딩하지 않는다.

interface HistoryItem {
  BPLC_NM: string;
  ROAD_NM_ADDR?: string;
  LOTNO_ADDR?: string;
  LCPMT_YMD?: string;
  SALS_STTS_CD?: string;
  CRD_INFO_X?: string;
  CRD_INFO_Y?: string;
}

async function fetchRegionHistory(regionCode: string, baseDate: string, serviceKey: string): Promise<HistoryItem[]> {
  const all: HistoryItem[] = [];
  for (let pageNo = 1; pageNo <= 50; pageNo++) {
    const params = new URLSearchParams({
      serviceKey,
      returnType: 'json',
      pageNo: String(pageNo),
      numOfRows: '100',
      'cond[BASE_DATE::EQ]': baseDate,
      'cond[OPN_ATMY_GRP_CD::EQ]': regionCode,
      'cond[SALS_STTS_CD::EQ]': '01', // 영업/정상만
    });
    const res = await fetch(`https://apis.data.go.kr/1741000/general_restaurants/history?${params}`);
    if (!res.ok) break;
    const data = await res.json() as {
      response?: { header?: { resultCode?: string }; body?: { items?: { item?: HistoryItem[] | HistoryItem } } };
    };
    if (data.response?.header?.resultCode !== '0') break;

    const rawItems = data.response?.body?.items?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminSecret = process.env.ADMIN_REFRESH_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: '인증 실패' });
  }

  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'PUBLIC_DATA_SERVICE_KEY 미설정' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  const body = (req.body ?? {}) as { regionCodes?: string[]; baseDate?: string };
  const regionCodes = Array.isArray(body.regionCodes) ? body.regionCodes : [];
  if (regionCodes.length === 0) {
    return res.status(400).json({ error: 'regionCodes가 필요합니다 (예: ["3220000"])' });
  }

  const now = new Date();
  const baseDate = body.baseDate ??
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  const summary: { regionCode: string; fetched: number; upserted: number; sampleAddresses: string[] }[] = [];

  for (const regionCode of regionCodes) {
    try {
      const items = await fetchRegionHistory(regionCode, baseDate, serviceKey);

      const rows = items
        .map((it) => {
          const x = parseFloat((it.CRD_INFO_X ?? '').trim());
          const y = parseFloat((it.CRD_INFO_Y ?? '').trim());
          if (!it.BPLC_NM || Number.isNaN(x) || Number.isNaN(y)) return null;
          const { lat, lng } = tmToWgs84(x, y);
          return {
            region_code: regionCode,
            biz_name: it.BPLC_NM,
            address: it.ROAD_NM_ADDR || it.LOTNO_ADDR || null,
            lat,
            lng,
            license_date: it.LCPMT_YMD || null,
            status_code: it.SALS_STTS_CD || null,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // 월 1회 갱신 구조 — 재실행 시 중복 누적 방지를 위해 해당 지역 기존 행을 지우고 새로 적재
      await supabase.from('license_cache').delete().eq('region_code', regionCode);

      let upserted = 0;
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const { error } = await supabase.from('license_cache').insert(chunk);
        if (!error) upserted += chunk.length;
        else console.error('[admin-refresh-license-cache] insert failed', regionCode, error.message);
      }

      summary.push({
        regionCode,
        fetched: items.length,
        upserted,
        sampleAddresses: rows.slice(0, 3).map((r) => r.address ?? '(주소 없음)'),
      });
    } catch (e) {
      console.error('[admin-refresh-license-cache] region failed', regionCode, e);
      summary.push({ regionCode, fetched: 0, upserted: 0, sampleAddresses: [] });
    }
  }

  return res.status(200).json({ baseDate, summary });
}
