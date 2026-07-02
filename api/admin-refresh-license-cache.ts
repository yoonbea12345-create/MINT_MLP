import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { tmToWgs84 } from './_lib/coords.js';

// 인허가 API(행안부 일반음식점) 배치 적재 — 월 1회 수동 트리거 전용.
// 지역 하나당 데이터가 많으면(강남구 51,000+건) 한 번의 서버리스 호출(60초 제한)로 전량을
// 못 가져온다. 그래서 지역 1개 + 시작페이지(pageNo) 단위로 처리하고, 시간 예산(45초) 안에서
// 페이지를 채운 뒤 done:false + nextPageNo를 반환한다 — 호출자는 done:true가 될 때까지
// 같은 regionCode에 nextPageNo를 넣어 재호출하면 된다.
//
// 요청 예시(1페이지부터):
//   curl -X POST -H "x-admin-secret: ..." -H "content-type: application/json" \
//     -d '{"regionCode": "3220000"}' https://.../api/admin-refresh-license-cache
// 이어서(done:false로 응답 온 경우):
//   -d '{"regionCode": "3220000", "pageNo": 11, "resetRegion": false}'
//
// ⚠️ OPN_ATMY_GRP_CD(개방자치단체코드)는 행안부 표준 5자리 지역코드가 아니라 LOCALDATA 체계의
// 7자리 코드다(예: 서울 강남구=3220000, 실제 API 응답으로 검증됨).

const TIME_BUDGET_MS = 45_000; // Vercel maxDuration(60s) 안에서 여유를 두고 조기 종료
const PAGE_SIZE = 100;

interface HistoryItem {
  BPLC_NM: string;
  ROAD_NM_ADDR?: string;
  LOTNO_ADDR?: string;
  LCPMT_YMD?: string;
  SALS_STTS_CD?: string;
  CRD_INFO_X?: string;
  CRD_INFO_Y?: string;
}

async function fetchPage(regionCode: string, baseDate: string, pageNo: number, serviceKey: string): Promise<HistoryItem[]> {
  const params = new URLSearchParams({
    serviceKey,
    returnType: 'json',
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    'cond[BASE_DATE::EQ]': baseDate,
    'cond[OPN_ATMY_GRP_CD::EQ]': regionCode,
    'cond[SALS_STTS_CD::EQ]': '01', // 영업/정상만
  });
  const res = await fetch(`https://apis.data.go.kr/1741000/general_restaurants/history?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as {
    response?: { header?: { resultCode?: string }; body?: { items?: { item?: HistoryItem[] | HistoryItem } } };
  };
  if (data.response?.header?.resultCode !== '0') return [];

  const rawItems = data.response?.body?.items?.item;
  return Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const startedAt = Date.now();

  const adminSecret = process.env.ADMIN_REFRESH_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: '인증 실패' });
  }

  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'PUBLIC_DATA_SERVICE_KEY 미설정' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  const body = (req.body ?? {}) as {
    regionCode?: string; pageNo?: number; baseDate?: string; resetRegion?: boolean;
  };
  const regionCode = body.regionCode;
  if (!regionCode) {
    return res.status(400).json({ error: 'regionCode가 필요합니다 (예: "3220000"). 지역 하나씩만 처리합니다.' });
  }

  const now = new Date();
  const baseDate = body.baseDate ??
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const startPageNo = body.pageNo ?? 1;

  // 재실행(첫 페이지) 시에만 기존 행 삭제 — 이어받기 호출에서는 지우면 안 됨
  if (startPageNo === 1 && body.resetRegion !== false) {
    await supabase.from('license_cache').delete().eq('region_code', regionCode);
  }

  let pageNo = startPageNo;
  let fetched = 0;
  let upserted = 0;
  const sampleAddresses: string[] = [];
  let done = false;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const items = await fetchPage(regionCode, baseDate, pageNo, serviceKey);
    if (items.length === 0) { done = true; break; }

    fetched += items.length;
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

    if (rows.length > 0) {
      const { error } = await supabase.from('license_cache').insert(rows);
      if (!error) {
        upserted += rows.length;
        if (sampleAddresses.length < 3) sampleAddresses.push(...rows.slice(0, 3 - sampleAddresses.length).map((r) => r.address ?? '(주소 없음)'));
      } else {
        console.error('[admin-refresh-license-cache] insert failed', regionCode, pageNo, error.message);
      }
    }

    if (items.length < PAGE_SIZE) { done = true; break; }
    pageNo += 1;
  }

  return res.status(200).json({
    regionCode,
    baseDate,
    done,
    nextPageNo: done ? null : pageNo,
    fetchedThisCall: fetched,
    upsertedThisCall: upserted,
    sampleAddresses,
  });
}
