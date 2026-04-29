import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

    const prompt = `당신은 서울 맛집 큐레이터입니다. 아래 조건에 맞는 최적의 장소를 추천해주세요.

## 모임 정보
- 출발지: ${input.locations.map((l: { name: string }) => l.name).join(', ')}
- 지리적 중간 지점: 위도 ${midpoint.lat.toFixed(4)}, 경도 ${midpoint.lng.toFixed(4)}
- 인원: ${input.groupSize}
- 목적: ${input.purpose}
- 바이브: ${input.vibe.noise}, ${input.vibe.pace}, ${input.vibe.novelty}
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
${placeSchema}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 응답 파싱 실패' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
