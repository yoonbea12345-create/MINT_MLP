import Anthropic from '@anthropic-ai/sdk';
import type { AreaCongestion } from './seoulData';
import type { Coordinates } from './midpoint';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface UserInput {
  locations: { name: string; coords?: Coordinates }[];
  groupSize: '2명' | '3~4명' | '5명 이상';
  purpose: '밥' | '술' | '카페' | '밥+술';
  vibe: {
    noise: '시끌벅적' | '조용하게';
    pace: '빠르게 한잔' | '오래 즐기기';
    novelty: '새로운 곳' | '검증된 곳';
  };
  withCourse: boolean;
}

export interface PlaceRecommendation {
  placeName: string;
  category: string;
  description: string;
  priceRange: string;
  vibeTags: string[];
  address: string;
  area: string;
  congestionLevel: string;
  openingHours?: string; // "11:00 ~ 23:00"
  kakaoPlaceId?: string;
  lat?: number;
  lng?: number;
  secondPlace?: {
    placeName: string;
    category: string;
    description: string;
    walkingMinutes: number;
    address: string;
    lat?: number;
    lng?: number;
  };
}

const placeSchema = `{
  "placeName": "실제 식당/카페 이름",
  "category": "카테고리 (예: 이자카야, 루프탑 바, 감성 카페 등)",
  "description": "한줄 설명 (왜 오늘 여기여야 하는지, 20자 내외)",
  "priceRange": "1인 예상 가격대 (예: 1~2만원)",
  "vibeTags": ["바이브 태그 3개"],
  "address": "도로명 주소",
  "area": "지역명 (예: 성수동, 홍대, 강남역 등)",
  "congestionLevel": "혼잡도",
  "openingHours": "영업시간 (예: 11:00 ~ 23:00 또는 17:00 ~ 02:00)",
  "lat": 37.5xxx,
  "lng": 127.0xxx
}`;

const courseSchema = `{
  "placeName": "실제 식당/카페 이름",
  "category": "카테고리",
  "description": "한줄 설명 (20자 내외)",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["바이브 태그 3개"],
  "address": "도로명 주소",
  "area": "지역명",
  "congestionLevel": "혼잡도",
  "openingHours": "영업시간 (예: 11:00 ~ 23:00)",
  "lat": 37.5xxx,
  "lng": 127.0xxx,
  "secondPlace": {
    "placeName": "2차 장소명",
    "category": "카테고리",
    "description": "한줄 설명",
    "walkingMinutes": 5,
    "address": "도로명 주소",
    "lat": 37.5xxx,
    "lng": 127.0xxx
  }
}`;

export async function getAIRecommendation(
  input: UserInput,
  midpoint: Coordinates,
  congestionData: AreaCongestion[]
): Promise<PlaceRecommendation> {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const congestionSummary = congestionData
    .map((c) => `${c.areaName}: ${c.level}`)
    .join(', ');

  const prompt = `당신은 서울 맛집 큐레이터입니다. 아래 조건에 맞는 최적의 장소를 추천해주세요.

## 모임 정보
- 출발지: ${input.locations.map((l) => l.name).join(', ')}
- 지리적 중간 지점: 위도 ${midpoint.lat.toFixed(4)}, 경도 ${midpoint.lng.toFixed(4)}
- 인원: ${input.groupSize}
- 목적: ${input.purpose}
- 바이브: ${input.vibe.noise}, ${input.vibe.pace}, ${input.vibe.novelty}
- 코스 추천 여부: ${input.withCourse ? '2차까지 추천 필요' : '1차만'}
- 현재 시각: ${currentTime}

## 현재 실시간 혼잡도
${congestionSummary}

## 추천 조건
1. 중간 지점 반경 2km 이내 지역 우선
2. "${input.vibe.noise}" 바이브에 맞는 장소
3. ${input.vibe.noise === '조용하게' ? '혼잡도가 낮은(여유/보통) 지역 강력 우선' : '활기찬 분위기 지역 우선'}
4. "${input.vibe.novelty}" 성향 반영
5. ${input.groupSize} 수용 가능한 장소
6. 실제 서울에 존재하는 장소만 추천
7. 현재 시각(${currentTime}) 기준 영업 중인 곳 우선 추천
8. openingHours는 실제 그 장소의 영업시간 형식으로 정확히 기재

## 응답 형식 (JSON만 반환, 다른 텍스트 없이)
${input.withCourse ? courseSchema : placeSchema}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패');

  return JSON.parse(jsonMatch[0]) as PlaceRecommendation;
}
