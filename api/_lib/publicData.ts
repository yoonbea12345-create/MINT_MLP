import { getSupabaseAdmin } from './supabaseAdmin.js';

export interface PublicStore {
  name: string;
  category: string; // 상권업종 소분류명 (indsSclsNm)
  address: string;
  lat: number;
  lng: number;
  regionCode: string; // 시군구코드 (signguCd)
}

interface StoreListItem {
  bizesNm: string;
  indsSclsNm: string;
  rdnmAdr?: string;
  lnoAdr?: string;
  lon: number;
  lat: number;
  signguCd: string;
}

// 소상공인 상가(상권)정보 반경 전수 조회. indsLclsCd='I2'(음식 대분류) — 실제 API 응답으로
// 검증 완료(스펙 초안의 'Q'는 오기, 'Q'는 보건의료였음). 좌표는 lon/lat 그대로 WGS84.
export async function fetchStoresInRadius(lat: number, lng: number, radiusM: number): Promise<PublicStore[]> {
  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) return [];

  // 정부 API가 느려 순차 3페이지가 추천 지연의 큰 부분이었다 → 2페이지 병렬 + 페이지당 2.5초 타임아웃.
  // L0은 상위 30곳만 쓰므로 200곳이면 충분(끊겨도 있는 만큼만 사용, 없으면 L0가 조용히 스킵됨).
  const fetchPage = async (pageNo: number): Promise<StoreListItem[]> => {
    try {
      const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${serviceKey}&cx=${lng}&cy=${lat}&radius=${radiusM}&type=json&numOfRows=100&pageNo=${pageNo}&indsLclsCd=I2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return [];
      const data = await res.json() as { header?: { resultCode?: string }; body?: { items?: StoreListItem[] } };
      if (data.header?.resultCode === '03') return []; // NODATA
      return data.body?.items ?? [];
    } catch (e) {
      console.error(`[publicData] page ${pageNo} failed`, e);
      return [];
    }
  };

  const results: PublicStore[] = [];
  const pages = await Promise.all([fetchPage(1), fetchPage(2)]);
  for (const items of pages) {
    for (const it of items) {
      if (!it.lat || !it.lon) continue;
      results.push({
        name: it.bizesNm,
        category: it.indsSclsNm,
        address: it.rdnmAdr || it.lnoAdr || '',
        lat: it.lat,
        lng: it.lon,
        regionCode: it.signguCd,
      });
    }
  }
  return results;
}

function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function namesOverlap(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, '');
  const nb = b.replace(/\s+/g, '');
  return na.length > 0 && nb.length > 0 && (na.includes(nb) || nb.includes(na));
}

// 좌표 50m 이내 + 상호명 부분일치로 공공데이터 상가정보를 네이버/공공 후보 배열에 태깅.
// 매칭 실패는 조용히 스킵(완벽 매칭 불필요, 80%면 충분).
export function matchStoreToPlace<T extends { name: string; lat: number; lng: number }>(
  store: PublicStore,
  candidates: T[],
): T | null {
  for (const c of candidates) {
    if (!c.lat || !c.lng) continue;
    if (distMeters(store.lat, store.lng, c.lat, c.lng) <= 50 && namesOverlap(store.name, c.name)) {
      return c;
    }
  }
  return null;
}

interface LicenseCacheRow {
  biz_name: string;
  lat: number;
  lng: number;
  license_date: string;
}

// license_cache(사전 배치 적재됨, Phase 2 admin 엔드포인트 참고)에서 좌표 50m 이내 + 이름매칭으로
// 인허가일자를 찾아 영업연차를 계산. 매칭 실패 시 undefined(정보 없음으로 처리, 배제하지 않음).
export async function lookupYearsAlive(store: PublicStore): Promise<number | undefined> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;

  try {
    // 50m 반경을 위경도 박스로 근사(약 0.00045도 ≈ 50m) 후 정밀 거리로 재필터
    const delta = 0.0006;
    const { data } = await supabase
      .from('license_cache')
      .select('biz_name, lat, lng, license_date')
      .gte('lat', store.lat - delta)
      .lte('lat', store.lat + delta)
      .gte('lng', store.lng - delta)
      .lte('lng', store.lng + delta);

    const rows = (data ?? []) as LicenseCacheRow[];
    const match = rows.find(
      (r) => distMeters(store.lat, store.lng, r.lat, r.lng) <= 50 && namesOverlap(store.name, r.biz_name),
    );
    if (!match?.license_date) return undefined;

    const licensedAt = new Date(match.license_date).getTime();
    const years = (Date.now() - licensedAt) / (365.25 * 24 * 60 * 60 * 1000);
    return years > 0 ? years : undefined;
  } catch (e) {
    console.error('[publicData] lookupYearsAlive failed', e);
    return undefined;
  }
}

// localGem = 영업연차(10년=1.0 cap) × (1 - 버즈량 정규화). "오래 살았는데 조용하다" = 숨은 후보.
// buzzCountForNormalization은 참고 가능한 버즈량 상한(예: 같은 배치 내 최대값)으로 정규화한다.
export function computeLocalGem(yearsAlive: number | undefined, buzzCount: number, buzzCountCap = 200): number {
  if (yearsAlive === undefined) return 0;
  const yearsNorm = Math.min(yearsAlive / 10, 1);
  const buzzNorm = Math.min(buzzCount / buzzCountCap, 1);
  return yearsNorm * (1 - buzzNorm);
}
