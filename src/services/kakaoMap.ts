export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string; // lng
  y: string; // lat
}

declare global {
  interface Window { kakao: any; Kakao: any }
}

const cache = new Map<string, KakaoPlace[]>();

export function searchKakaoKeyword(
  keyword: string,
  options?: { x?: string; y?: string; radius?: number }
): Promise<KakaoPlace[]> {
  const cacheKey = keyword + JSON.stringify(options ?? {});
  if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey)!);

  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error('카카오 지도 SDK가 아직 로드되지 않았어요. 잠시 후 다시 시도해주세요.'));
      return;
    }
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
