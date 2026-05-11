import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const placeSchema = `{
  "rank": 1,
  "placeName": "실제 식당/카페 이름",
  "category": "카테고리 (예: 이자카야, 루프탑 바, 감성 카페 등)",
  "description": "한줄 설명 (왜 오늘 여기여야 하는지, 20자 내외)",
  "priceRange": "1인 예상 가격대 (예: 1~2만원)",
  "vibeTags": ["분위기 태그 3개"],
  "address": "도로명 주소",
  "area": "지역명 (예: 성수동, 홍대, 강남역 등)",
  "congestionLevel": "혼잡도",
  "openingHours": "영업시간 (예: 11:00 ~ 23:00 또는 17:00 ~ 02:00)",
  "lat": 37.5,
  "lng": 127.0
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { input, midpoint, congestionData } = req.body;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const congestionSummary = (congestionData as { areaName: string; level: string }[])
      .map((c) => `${c.areaName}: ${c.level}`)
      .join(', ');

    const purpose = input.purpose as { first: string; second: string | null };
    const hasTwoPurposes = !!(purpose.second && purpose.second !== '없음');
    const vibeStr = [input.vibe?.noise, input.vibe?.pace, input.vibe?.novelty]
      .filter(Boolean)
      .join(', ') || '자유롭게';

    const commonInfo = `
## 모임 정보
- 출발지: ${input.locations.map((l: { name: string }) => l.name).join(', ')}
- 지리적 중간 지점: 위도 ${midpoint.lat.toFixed(4)}, 경도 ${midpoint.lng.toFixed(4)}
- 인원: ${input.groupSize}
- 분위기: ${vibeStr}
- 현재 시각: ${currentTime}

## 현재 실시간 혼잡도
${congestionSummary}

## 공통 조건
- 중간 지점 반경 2km 이내 지역 우선
- ${input.vibe?.noise ? `"${input.vibe.noise}" 분위기에 맞는 장소` : '분위기 무관'}
- ${input.vibe?.noise === '조용하게' ? '혼잡도가 낮은(여유/보통) 지역 우선' : '활기찬 분위기 지역 우선'}
- ${input.vibe?.novelty ? `"${input.vibe.novelty}" 성향 반영` : '성향 무관'}
- ${input.groupSize} 수용 가능한 장소
- 실제 서울에 존재하는 장소만 추천
- 현재 시각(${currentTime}) 기준 영업 중인 곳 우선
- openingHours는 실제 영업시간 형식으로 정확히 기재`;

    const prompt = hasTwoPurposes
      ? `당신은 서울 맛집 큐레이터입니다. 이 모임은 1차와 2차 장소를 모두 찾고 있습니다. 아래 조건에 맞게 정확히 3곳을 추천해주세요.
${commonInfo}

## 핵심 요구사항 (반드시 준수)
- rank 1: 1차 목적인 "${purpose.first}"에 맞는 최적의 장소
- rank 2: 2차 목적인 "${purpose.second}"에 맞는 최적의 장소 (rank 1 장소와 도보 10~15분 거리 이내여야 함)
- rank 3: 1차 목적인 "${purpose.first}"의 다른 대안 장소 (rank 1과 다른 곳)

rank 1과 rank 2는 반드시 같은 동네 또는 인접한 지역이어야 합니다.

## 응답 형식 (JSON만 반환, 다른 텍스트 없이)
{
  "places": [
    ${placeSchema},
    { "rank": 2, ...같은 형식 },
    { "rank": 3, ...같은 형식 }
  ]
}`
      : `당신은 서울 맛집 큐레이터입니다. 아래 조건에 맞는 최적의 장소 3곳을 순위별로 추천해주세요.
${commonInfo}

## 추가 조건
- 목적: ${purpose.first}
- 3곳은 서로 다른 장소로 다양하게 추천 (같은 건물/골목 반복 금지)

## 응답 형식 (JSON만 반환, 다른 텍스트 없이)
{
  "places": [
    ${placeSchema},
    { "rank": 2, ...같은 형식 },
    { "rank": 3, ...같은 형식 }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 응답 파싱 실패' });

    const parsed = JSON.parse(jsonMatch[0]);
    const places = Array.isArray(parsed.places) ? parsed.places : [parsed];
    return res.status(200).json(places);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
