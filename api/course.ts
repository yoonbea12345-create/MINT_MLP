import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const purposeFlowGuide: Record<string, string> = {
  '밥+술': '1차는 밥집, 2차는 분위기 좋은 술집으로 연결',
  '밥': '1차는 밥집, 2차는 근처 디저트 카페 또는 야경 명소',
  '술': '1차는 술집, 2차는 다른 분위기의 바 또는 칵테일 바',
  '카페': '1차는 카페, 2차는 분위기 다른 카페 또는 디저트 가게',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { input, firstPlace } = req.body;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const courseSchema = `{
  "places": [
    {
      "placeName": "${firstPlace.placeName}",
      "category": "${firstPlace.category}",
      "description": "1차 장소 한줄 설명 (20자 내외)",
      "vibeTags": ["바이브 태그 3개"],
      "address": "${firstPlace.address || firstPlace.area}",
      "walkingMinutes": 0,
      "lat": ${firstPlace.lat ?? 'null'},
      "lng": ${firstPlace.lng ?? 'null'}
    },
    {
      "placeName": "2차 실제 장소명",
      "category": "카테고리",
      "description": "한줄 설명 (20자 내외)",
      "vibeTags": ["바이브 태그 3개"],
      "address": "도로명 주소",
      "walkingMinutes": 0,
      "lat": 37.5,
      "lng": 127.0
    }
  ],
  "totalMinutes": 150
}`;

    const prompt = `당신은 서울 코스 큐레이터입니다. 1차 장소를 기준으로 최적의 2차 코스를 추천해주세요.

## 1차 장소 정보
- 장소명: ${firstPlace.placeName}
- 카테고리: ${firstPlace.category}
- 주소: ${firstPlace.address || firstPlace.area}
${firstPlace.lat ? `- 좌표: 위도 ${firstPlace.lat}, 경도 ${firstPlace.lng}` : ''}

## 모임 정보
- 출발지: ${input.locations.map((l: { name: string }) => l.name).join(', ')}
- 인원: ${input.groupSize}
- 목적: ${input.purpose}
- 바이브: ${input.vibe.noise}, ${input.vibe.pace}, ${input.vibe.novelty}

## 코스 구성 가이드
- ${purposeFlowGuide[input.purpose] ?? '자유로운 코스로 구성'}
- 2차 장소는 1차에서 도보 10분 이내 위치
- 실제 서울에 존재하는 장소만 추천
- 바이브 연속성을 유지하되 적절한 분위기 변화를 줄 것
- totalMinutes: 1차 체류(60~90분) + 이동 + 2차 체류(60~90분) 합산

## 응답 형식 (JSON만 반환, 다른 텍스트 없이)
${courseSchema}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: '코스 추천 응답 파싱 실패' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
