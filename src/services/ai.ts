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
  thirdStop?: PlaceRecommendation | null;   // 3차 '이어서 갈 곳' — 서버가 붙여줌(없으면 null)
  thirdLabel?: string | null;               // 3차 성격 라벨(예: '카페·디저트', '술 한잔')
  serial?: string | null;                   // 파일럿 일련번호(내부 조인키, 유저 비노출)
}

// 행정단위 스코프 — 시/구/동 단위로 추천 범위를 고정 (있을 때만 전송)
export interface RegionScope {
  level: 'city' | 'district' | 'dong';
  matchTokens: string[];
  centerLat: number;
  centerLng: number;
}

export async function getAIRecommendation(
  input: UserInput,
  midpoint: Coordinates,
  congestionData: AreaCongestion[],
  excludeNames: string[] = [],
  areas: string[] = [],
  regionScope: RegionScope | null = null,
  sessionKey: string | null = null,
): Promise<RecommendationResult> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // areas를 보내면 혼잡도는 서버가 네이버 검색과 병렬로 조회 (클라이언트 왕복 1회 절감)
    // sessionKey: 같은 탐색 에피소드(초기→재시도→선택)를 recommendation_log·events에서 조인하기 위한 키
    body: JSON.stringify({ input, midpoint, congestionData, excludeNames, areas, ...(regionScope ? { regionScope } : {}), ...(sessionKey ? { sessionKey } : {}) }),
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
    // 구버전 서버 응답이면 undefined → null 처리(배포 스큐 안전)
    thirdStop: (data.thirdStop ?? null) as PlaceRecommendation | null,
    thirdLabel: (data.thirdLabel ?? null) as string | null,
    serial: (data.serial ?? null) as string | null,
  };
}

// 결과 표시 후 사진·카카오URL을 채우는 후처리 호출 (초기 로딩을 앞당기려 분리)
export interface PlaceEnrichment {
  placeName: string;
  kakaoPlaceUrl?: string;
  imageUrl?: string;
}

export async function enrichPlaces(
  places: { placeName: string; lat?: number; lng?: number; area?: string }[],
): Promise<PlaceEnrichment[]> {
  try {
    const payload = places
      .filter((p) => p.placeName && p.lat && p.lng)
      .map((p) => ({ placeName: p.placeName, lat: p.lat, lng: p.lng, area: p.area }));
    if (payload.length === 0) return [];
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'enrich', places: payload }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.enriched) ? (data.enriched as PlaceEnrichment[]) : [];
  } catch {
    return [];
  }
}
