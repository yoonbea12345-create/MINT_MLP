const REST_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;

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

export async function searchKakaoKeyword(
  keyword: string,
  options?: { x?: string; y?: string; radius?: number }
): Promise<KakaoPlace[]> {
  const params = new URLSearchParams({ query: keyword, size: '5' });
  if (options?.x) params.append('x', options.x);
  if (options?.y) params.append('y', options.y);
  if (options?.radius) params.append('radius', String(options.radius));

  const res = await fetch(
    `/api/kakao/v2/local/search/keyword.json?${params}`,
    { headers: { Authorization: `KakaoAK ${REST_KEY}` } }
  );
  if (!res.ok) throw new Error('카카오 검색 실패');
  const data = await res.json();
  return (data.documents ?? []) as KakaoPlace[];
}

export async function searchAddress(keyword: string): Promise<KakaoPlace[]> {
  return searchKakaoKeyword(keyword);
}
