import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { input, midpoint, congestionData } = req.body;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const purpose = input.purpose as { first: string; second: string | null };
    const hasTwoPurposes = !!(purpose.second && purpose.second !== '없음');
    const vibe = input.vibe as { first?: string[]; second?: string[] } | undefined;
    const vibeFirstStr = vibe?.first?.length ? vibe.first.join(', ') : '자유롭게';
    const vibeSecondStr = vibe?.second?.length ? vibe.second.join(', ') : '';
    const isQuiet = vibe?.first?.includes('조용하게') ?? false;

    // 지역명 우선, 좌표는 보조용으로만
    const areaNames = (congestionData as { areaName: string; level: string }[])
      .map((c) => c.areaName)
      .join(', ');
    const congestionSummary = (congestionData as { areaName: string; level: string }[])
      .map((c) => `${c.areaName}: ${c.level}`)
      .join(', ');
    const locationStr = input.locations.map((l: { name: string }) => l.name).join(', ');

    const antiHallucinationRules = `
## 절대 규칙 (위반 시 서비스 품질 심각하게 저하됨)
1. 반드시 실제로 존재하고 현재 영업 중인 장소만 추천할 것
2. 확신이 없는 장소는 절대 추천 금지 — 차라리 유명 프랜차이즈를 추천
3. 프랜차이즈·체인점은 정확한 지점명 기재 (예: "이디야커피 부천중동점")
4. 독립 매장은 TV·언론·SNS에 실제로 소개된 검증된 유명 맛집만
5. address는 확실한 경우만, 불확실하면 "경기 부천시 중동" 수준 동네명만
6. lat/lng는 확실한 좌표를 아는 경우만 기재, 모르면 반드시 0 기재
7. placeName은 실제 간판·사업자등록 명칭과 일치해야 함`;

    const commonInfo = `
## 모임 정보
- 출발지: ${locationStr}
- 추천 지역: ${areaNames} (이 지역 내 실존 장소 우선)
- 인원: ${input.groupSize}
- 분위기: ${vibeFirstStr}${vibeSecondStr ? ` / ${vibeSecondStr}` : ''}
- 현재 시각: ${currentTime}
- 실시간 혼잡도: ${congestionSummary || '정보 없음'}

## 추천 조건
- ${areaNames} 상권 내 또는 인접 지역의 실존 장소
- "${vibeFirstStr}" 분위기와 실제로 어울리는 곳
- ${isQuiet ? '혼잡도 낮은(여유/보통) 지역 우선' : '활기찬 분위기 지역 우선'}
- ${input.groupSize} 수용 가능 규모
- 현재 시각(${currentTime}) 기준 영업 중이거나 곧 영업 예정인 곳 우선`;

    const placeSchema = `{
  "rank": 1,
  "placeName": "실제 존재하는 가게 이름 (예: 교촌치킨 부천중동점)",
  "category": "카테고리 (예: 치킨, 이자카야, 카페)",
  "description": "한 줄 설명 20자 내외",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["분위기 태그 3개"],
  "address": "도로명 주소 (확실한 경우만, 불확실하면 동네명만)",
  "area": "지역명 (예: 부천 중동)",
  "congestionLevel": "혼잡도",
  "openingHours": "HH:MM ~ HH:MM 형식",
  "lat": 0,
  "lng": 0
}`;

    const placeSchemaWithWalking = placeSchema.replace('"lng": 0', '"lng": 0,\n  "walkingToNext": 10');

    const prompt = hasTwoPurposes
      ? `당신은 한국 모임 장소 큐레이터입니다. 아래 조건으로 1차·2차 코스 장소를 추천해주세요.
${antiHallucinationRules}
${commonInfo}

## 응답 구성 (총 6곳)
- rank 1: 1차 목적 "${purpose.first}" 최적 장소. walkingToNext에 rank 2까지 도보 분(숫자만) 기재
- rank 2: 2차 목적 "${purpose.second}" 최적 장소 (rank 1과 도보 15분 이내)
- rank 3, 4: 1차 대안 장소 (rank 1과 다른 곳)
- rank 5, 6: 2차 대안 장소 (rank 2와 다른 곳, rank 2 인근)
rank 1·2는 반드시 같은 동네 또는 인접 지역이어야 합니다.

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [${placeSchemaWithWalking}, {"rank": 2}, {"rank": 3}, {"rank": 4}, {"rank": 5}, {"rank": 6}]}`
      : `당신은 한국 모임 장소 큐레이터입니다. 아래 조건으로 "${purpose.first}" 장소 3곳을 추천해주세요.
${antiHallucinationRules}
${commonInfo}

## 응답 구성 (총 3곳, 서로 다른 장소)
- rank 1: 최적 장소
- rank 2, 3: 대안 장소 (rank 1·2·3 모두 서로 다른 장소)

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [${placeSchema}, {"rank": 2}, {"rank": 3}]}`;

    // Extended Thinking으로 hallucination 최소화
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000,
      },
      messages: [{ role: 'user', content: prompt }],
    } as Parameters<typeof client.messages.create>[0]);

    // thinking 블록 제외하고 text 블록만 추출
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 응답 파싱 실패' });

    const parsed = JSON.parse(jsonMatch[0]);
    const places = Array.isArray(parsed.places) ? parsed.places : [parsed];
    return res.status(200).json(places);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
