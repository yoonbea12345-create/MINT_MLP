import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NaverPlace {
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}

const FRANCHISE_KEYWORDS = [
  '스타벅스','이디야','투썸','메가커피','빽다방','컴포즈','탐앤탐스','폴바셋','커피빈',
  '맥도날드','버거킹','롯데리아','KFC','맘스터치','서브웨이','노브랜드버거',
  '파리바게뜨','뚜레쥬르','던킨','크리스피크림',
];

function isFranchise(name: string): boolean {
  return FRANCHISE_KEYWORDS.some((kw) => name.includes(kw));
}

async function searchNaverLocal(query: string, display = 8): Promise<NaverPlace[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: { title: string; category: string; roadAddress: string; address: string; mapx: string; mapy: string }[] };
    const all = (data.items || []).map((item) => ({
      name: item.title.replace(/<[^>]*>/g, ''),
      category: item.category,
      address: item.roadAddress || item.address,
      lat: parseInt(item.mapy) / 1e7,
      lng: parseInt(item.mapx) / 1e7,
    }));
    const local = all.filter((p) => !isFranchise(p.name));
    const franchise = all.filter((p) => isFranchise(p.name));
    return [...local, ...franchise].slice(0, 8);
  } catch {
    return [];
  }
}

function formatNaverPlaces(places: NaverPlace[]): string {
  return places.map((p, i) =>
    `${i + 1}. ${p.name} | ${p.category} | ${p.address} | lat:${p.lat.toFixed(4)}, lng:${p.lng.toFixed(4)}`
  ).join('\n');
}

// 1차 목적에서 2차 검색 키워드 결정
function secondPurposeQuery(area: string, firstPurpose: string): string {
  const map: Record<string, string> = {
    '밥': `${area} 카페 디저트`,
    '술': `${area} 바 칵테일바`,
    '카페': `${area} 카페 디저트`,
  };
  if (firstPurpose.includes('술')) return `${area} 바 칵테일바`;
  return map[firstPurpose] ?? `${area} 바 카페`;
}

// 주소에서 동네명 추출 (예: "서울 용산구 이태원동 ..." → "이태원")
function extractArea(address: string): string {
  const match = address.match(/([가-힣]+[동로길])/);
  return match ? match[1] : address.split(' ').slice(0, 2).join(' ');
}

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

    // 1차 장소 인근에서 2차 목적에 맞는 실존 장소 검색
    const area = extractArea(firstPlace.address || firstPlace.area || '');
    const firstPurpose = typeof input.purpose === 'object' ? input.purpose.first : input.purpose;
    const secondQuery = secondPurposeQuery(area, firstPurpose);
    const naverSecondPlaces = await searchNaverLocal(secondQuery);
    const hasNaverData = naverSecondPlaces.length > 0;

    const naverSection = hasNaverData ? `
## 네이버 검색으로 확인된 2차 장소 후보 (반드시 이 목록에서만 선택)
${formatNaverPlaces(naverSecondPlaces)}

⚠️ 반드시 위 목록 번호(1~${naverSecondPlaces.length})에서만 선택. 목록 외 장소 생성 절대 금지.
⚠️ sourceIndex는 선택한 목록 번호를 정확히 기재.
⚠️ placeName·address·lat·lng는 위 데이터 그대로 복사. 임의 생성 절대 금지.` : '';

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
      "sourceIndex": 1,
      "placeName": "2차 실제 장소명 (목록에서 그대로)",
      "category": "카테고리",
      "description": "한줄 설명 (20자 내외)",
      "vibeTags": ["바이브 태그 3개"],
      "address": "주소 (목록에서 그대로)",
      "walkingMinutes": 0,
      "lat": 37.5,
      "lng": 127.0
    }
  ],
  "totalMinutes": 150
}`;

    const vibeStr = typeof input.vibe === 'object' && !Array.isArray(input.vibe)
      ? (Array.isArray(input.vibe.first) ? input.vibe.first.join(', ') : `${input.vibe.noise ?? ''}, ${input.vibe.pace ?? ''}, ${input.vibe.novelty ?? ''}`)
      : '';

    const prompt = `당신은 서울 코스 큐레이터입니다. 1차 장소를 기준으로 최적의 2차 코스를 추천해주세요.
${naverSection}

## 1차 장소 정보
- 장소명: ${firstPlace.placeName}
- 카테고리: ${firstPlace.category}
- 주소: ${firstPlace.address || firstPlace.area}
${firstPlace.lat ? `- 좌표: 위도 ${firstPlace.lat}, 경도 ${firstPlace.lng}` : ''}

## 모임 정보
- 출발지: ${input.locations.map((l: { name: string }) => l.name).join(', ')}
- 인원: ${input.groupSize}
- 목적: ${firstPurpose}
- 바이브: ${vibeStr}

## 코스 구성 가이드
- ${purposeFlowGuide[firstPurpose] ?? '자유로운 코스로 구성'}
- 2차 장소는 1차에서 도보 10분 이내 위치
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

    const parsed = JSON.parse(jsonMatch[0]);

    // 2차 장소(places[1])를 Naver 데이터로 강제 덮어쓰기
    if (hasNaverData && Array.isArray(parsed.places) && parsed.places[1]) {
      const second = parsed.places[1];
      let idx = typeof second.sourceIndex === 'number' ? second.sourceIndex - 1 : -1;
      if (idx < 0 || idx >= naverSecondPlaces.length) {
        idx = naverSecondPlaces.findIndex(
          (p) => p.name.includes(second.placeName ?? '') || (second.placeName ?? '').includes(p.name)
        );
        if (idx < 0) idx = 0;
      }
      const naver = naverSecondPlaces[idx];
      second.placeName = naver.name;
      second.address = naver.address;
      second.lat = naver.lat;
      second.lng = naver.lng;
      if (naver.category) second.category = naver.category;
      delete second.sourceIndex;
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
