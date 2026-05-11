import type { AreaCongestion } from './seoulData';
import type { Coordinates } from './midpoint';

export interface UserInput {
  locations: { name: string; coords?: Coordinates }[];
  groupSize: '2명' | '3~4명' | '5명 이상';
  purpose: { first: string; second: string | null };
  vibe: { first: string[]; second: string[] };
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
  congestionLevel: string;
  openingHours?: string;
  kakaoPlaceId?: string;
  lat?: number;
  lng?: number;
  nearbySpots?: string[];
  walkingToNext?: number;
}

export interface CoursePlace {
  placeName: string;
  category: string;
  description: string;
  vibeTags: string[];
  address: string;
  walkingMinutes: number;
  lat?: number;
  lng?: number;
}

export interface CourseRecommendation {
  places: CoursePlace[];
  totalMinutes: number;
}

export async function getAIRecommendation(
  input: UserInput,
  midpoint: Coordinates,
  congestionData: AreaCongestion[]
): Promise<PlaceRecommendation[]> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, midpoint, congestionData }),
  });
  if (!res.ok) throw new Error('AI 추천 요청 실패');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return Array.isArray(data) ? data as PlaceRecommendation[] : [data as PlaceRecommendation];
}

export async function getCourseRecommendation(
  input: UserInput,
  firstPlace: PlaceRecommendation
): Promise<CourseRecommendation> {
  const res = await fetch('/api/course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, firstPlace }),
  });
  if (!res.ok) throw new Error('코스 추천 요청 실패');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as CourseRecommendation;
}
