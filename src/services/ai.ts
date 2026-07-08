import type { AreaCongestion } from './seoulData';
import type { Coordinates } from './midpoint';

export interface UserInput {
  locations: { name: string; coords?: Coordinates }[];
  groupSize: '2명' | '3~4명' | '5명 이상';
  purpose: { first: string; second: string | null; firstGenre?: string | null; secondGenre?: string | null };
  vibe: { first: string[]; second: string[] };
  relation?: string | null;
  occasion?: string | null;
  budget?: string | null;
  vibeWeights?: Record<string, number>;
  keywords?: string[];          // 1차 키워드
  keywordsSecond?: string[];    // 2차 키워드
  excludeFoods?: string[];
}

export interface PlaceRecommendation {
  rank?: number;
  placeName: string;
  category: string;
  description: string;
  priceRange: string;
  vibeTags: string[];
  address: string;
  area: string;
  congestionLevel?: string;
  openingHours?: string;
  kakaoPlaceId?: string;
  kakaoPlaceUrl?: string;
  lat?: number;
  lng?: number;
  nearbySpots?: string[];
  walkingToNext?: number;
  fitScore?: number;
  imageUrl?: string;
}

export interface WeatherSummary {
  description: string;
  temp: number;
  isRainy: boolean;
  isHot: boolean;
  isCold: boolean;
}

export interface RecommendationResult {
  places: PlaceRecommendation[];
  weather: WeatherSummary | null;
}

export async function getAIRecommendation(
  input: UserInput,
  midpoint: Coordinates,
  congestionData: AreaCongestion[],
  excludeNames: string[] = [],
  areas: string[] = []
): Promise<RecommendationResult> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // areas를 보내면 혼잡도는 서버가 네이버 검색과 병렬로 조회 (클라이언트 왕복 1회 절감)
    body: JSON.stringify({ input, midpoint, congestionData, excludeNames, areas }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `AI 추천 요청 실패 (${res.status})`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  // API returns { places, weather, _debug } or legacy plain array
  const places = Array.isArray(data) ? data : (data.places ?? [data]);
  if (data._debug) console.log('[recommend] debug', data._debug);
  return {
    places: places as PlaceRecommendation[],
    weather: (data.weather ?? null) as WeatherSummary | null,
  };
}
