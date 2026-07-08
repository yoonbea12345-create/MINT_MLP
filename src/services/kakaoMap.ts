import { ensureKakaoMaps } from '../utils/kakaoLoader';

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
}

declare global {
  interface Window { kakao: any; Kakao: any }
}

const cache = new Map<string, KakaoPlace[]>();

export async function searchKakaoKeyword(
  keyword: string,
  options?: { x?: string; y?: string; radius?: number }
): Promise<KakaoPlace[]> {
  const cacheKey = keyword + JSON.stringify(options ?? {});
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  await ensureKakaoMaps();

  return new Promise((resolve, reject) => {
    const ps = new window.kakao.maps.services.Places();
    const opts: Record<string, unknown> = { size: 5 };
    if (options?.x) opts.x = Number(options.x);
    if (options?.y) opts.y = Number(options.y);
    if (options?.radius) opts.radius = options.radius;
    ps.keywordSearch(
      keyword,
      (results: KakaoPlace[], status: string) => {
        const { OK, ZERO_RESULT } = window.kakao.maps.services.Status;
        if (status === OK) {
          cache.set(cacheKey, results);
          resolve(results);
        } else if (status === ZERO_RESULT) {
          cache.set(cacheKey, []);
          resolve([]);
        } else {
          reject(new Error('카카오 장소 검색 실패'));
        }
      },
      opts
    );
  });
}

export async function searchAddress(keyword: string): Promise<KakaoPlace[]> {
  return searchKakaoKeyword(keyword);
}

export interface Neighborhood {
  area: string;   // "대구 수성구 대흥동" 형태 (시 구 동)
  lat: number;
  lng: number;
}

// 지번 주소(address_name)에서 '시 [구...] 동' 부분만 뽑는다.
// 동/읍/면/가/리로 끝나는 첫 토큰까지 포함 → 성남시 분당구처럼 구가 여러 토큰이어도 안전.
function toDongLabel(addressName: string): string | null {
  if (!addressName) return null;
  const tokens = addressName.trim().split(/\s+/);
  const idx = tokens.findIndex((t) => /(동|읍|면|가|리)$/.test(t));
  if (idx < 0) return null;
  return tokens.slice(0, idx + 1).join(' ');
}

// 만날 '지역' 검색 전용 — POI가 아니라 시/구/동 동네 단위 제안 목록을 돌려준다.
// keywordSearch 결과의 지번 주소에서 동네를 뽑아 중복 제거.
export async function searchNeighborhoods(keyword: string): Promise<Neighborhood[]> {
  const places = await searchKakaoKeyword(keyword);
  const seen = new Set<string>();
  const out: Neighborhood[] = [];
  for (const p of places) {
    const area = toDongLabel(p.address_name);
    if (!area || seen.has(area)) continue;
    seen.add(area);
    out.push({ area, lat: parseFloat(p.y), lng: parseFloat(p.x) });
    if (out.length >= 6) break;
  }
  return out;
}

// 동네 이름("대구 수성구 대흥동") → 동 대표 좌표. 실패 시 null.
export async function geocodeArea(area: string): Promise<{ lat: number; lng: number } | null> {
  try {
    await ensureKakaoMaps();
    const geocoder = new window.kakao.maps.services.Geocoder();
    const OK = window.kakao.maps.services.Status.OK;
    return await new Promise((resolve) => {
      geocoder.addressSearch(area, (res: any[], status: string) => {
        resolve(status === OK && res[0] ? { lat: parseFloat(res[0].y), lng: parseFloat(res[0].x) } : null);
      });
    });
  } catch {
    return null;
  }
}
