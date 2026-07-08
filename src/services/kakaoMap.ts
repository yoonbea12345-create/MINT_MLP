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
  area: string;   // "서울 마포구 서교동" 형태 (시 구 동)
  lat: number;
  lng: number;
}

// 정확한 건물/장소 좌표를 '시 구 동' 행정동 단위로 완화한다.
// 거주지(집) 등 정확 위치 노출을 막고, 만남 지점 계산엔 대략적 동네 좌표만 사용하기 위함.
// 실패하면 원래 이름/좌표로 안전하게 폴백한다.
export async function resolveNeighborhood(lat: number, lng: number, fallbackName = ''): Promise<Neighborhood> {
  try {
    await ensureKakaoMaps();
    const geocoder = new window.kakao.maps.services.Geocoder();
    const OK = window.kakao.maps.services.Status.OK;

    // 1) 좌표 → 행정구역(시/구/동) 이름
    const addr = await new Promise<any | null>((resolve) => {
      geocoder.coord2Address(lng, lat, (res: any[], status: string) => {
        resolve(status === OK && res[0] ? res[0].address : null);
      });
    });
    if (!addr) return { area: fallbackName, lat, lng };

    const si = addr.region_1depth_name || '';
    const gu = addr.region_2depth_name || '';
    const dong = addr.region_3depth_name || '';
    const area = [si, gu, dong].filter(Boolean).join(' ') || fallbackName;

    // 2) 동 대표 좌표로 스냅 (구+동 주소 검색) — 정확 건물 좌표 대신 동네 중심을 쓴다.
    //    실패하면 원좌표 유지(어차피 해당 동 내부라 충분히 대략적).
    const query = [gu, dong].filter(Boolean).join(' ');
    let snapLat = lat;
    let snapLng = lng;
    if (query) {
      const centroid = await new Promise<{ x: string; y: string } | null>((resolve) => {
        geocoder.addressSearch(query, (res: any[], status: string) => {
          resolve(status === OK && res[0] ? res[0] : null);
        });
      });
      if (centroid) { snapLat = parseFloat(centroid.y); snapLng = parseFloat(centroid.x); }
    }
    return { area, lat: snapLat, lng: snapLng };
  } catch {
    return { area: fallbackName, lat, lng };
  }
}
