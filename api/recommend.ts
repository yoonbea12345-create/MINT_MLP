import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NaverPlace {
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}

interface WeatherInfo {
  description: string;
  temp: number;
  isRainy: boolean;
  isHot: boolean;
  isCold: boolean;
}

// 두 좌표 간 도보 소요시간(분) — 4km/h 기준
function walkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((km / 4) * 60);
}

// 네이버 로컬 검색 — 실존 장소 목록 반환
async function searchNaverLocal(query: string, display = 8): Promise<NaverPlace[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: { title: string; category: string; roadAddress: string; address: string; mapx: string; mapy: string }[] };
    return (data.items || []).map((item) => ({
      name: item.title.replace(/<[^>]*>/g, ''),
      category: item.category,
      address: item.roadAddress || item.address,
      lat: parseInt(item.mapy) / 1e7,
      lng: parseInt(item.mapx) / 1e7,
    }));
  } catch {
    return [];
  }
}

// OpenWeatherMap 날씨 조회
async function fetchWeather(lat: number, lng: number): Promise<WeatherInfo | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=kr`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      weather: { description: string; id: number }[];
      main: { temp: number };
    };
    const weatherId = data.weather[0]?.id ?? 800;
    const temp = data.main.temp;
    const isRainy = weatherId >= 200 && weatherId < 700;
    return {
      description: data.weather[0]?.description ?? '',
      temp: Math.round(temp),
      isRainy,
      isHot: temp >= 28,
      isCold: temp <= 5,
    };
  } catch {
    return null;
  }
}

function purposeToNaverQuery(purpose: string, areaName: string, groupSize: number): string {
  const isLargeGroup = groupSize >= 5;
  const groupPrefix = isLargeGroup ? '단체 ' : '';
  const map: Record<string, string> = {
    '밥': `${areaName} ${groupPrefix}맛집`,
    '술': `${areaName} ${groupPrefix}${isLargeGroup ? '단체 술집 포차' : '술집 이자카야 포차'}`,
    '카페': `${areaName} ${groupPrefix}카페`,
    '기타': `${areaName} ${groupPrefix}음식점`,
  };
  return map[purpose] ?? `${areaName} ${groupPrefix}${purpose}`;
}

function formatNaverPlaces(places: NaverPlace[]): string {
  return places.map((p, i) =>
    `${i + 1}. ${p.name} | ${p.category} | ${p.address} | lat:${p.lat.toFixed(4)}, lng:${p.lng.toFixed(4)}`
  ).join('\n');
}

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
    const groupSize: number = typeof input.groupSize === 'number' ? input.groupSize : parseInt(input.groupSize) || 2;

    const areaNames = (congestionData as { areaName: string; level: string }[])
      .map((c) => c.areaName)
      .join(', ');
    const congestionSummary = (congestionData as { areaName: string; level: string }[])
      .map((c) => `${c.areaName}: ${c.level}`)
      .join(', ');
    const locationStr = input.locations.map((l: { name: string }) => l.name).join(', ');
    const primaryArea = (congestionData as { areaName: string }[])[0]?.areaName || areaNames;

    // 날씨 + 네이버 장소 병렬 fetch
    const midLat: number = midpoint?.lat ?? 37.5665;
    const midLng: number = midpoint?.lng ?? 126.9780;

    const [weather, naverFirstPlaces, naverSecondPlaces] = await Promise.all([
      fetchWeather(midLat, midLng),
      searchNaverLocal(purposeToNaverQuery(purpose.first, primaryArea, groupSize)),
      hasTwoPurposes && purpose.second
        ? searchNaverLocal(purposeToNaverQuery(purpose.second, primaryArea, groupSize))
        : Promise.resolve([]),
    ]);

    const hasNaverData = naverFirstPlaces.length > 0;

    // 네이버 데이터 있을 때 전용 규칙
    const naverSection = hasNaverData ? `
## 네이버에서 확인된 실존 장소 목록 (반드시 이 목록에서만 선택)
### 1차 목적 "${purpose.first}" 후보
${formatNaverPlaces(naverFirstPlaces)}
${hasTwoPurposes && naverSecondPlaces.length > 0 ? `
### 2차 목적 "${purpose.second}" 후보
${formatNaverPlaces(naverSecondPlaces)}` : ''}

⚠️ 위 목록에 없는 장소는 절대 추천 금지. 목록 내 장소의 address·lat·lng는 위 데이터 그대로 사용.` : `
## 절대 규칙
1. 실제 존재하고 영업 중인 장소만 추천 — 불확실하면 유명 프랜차이즈 추천
2. 프랜차이즈는 정확한 지점명 기재 (예: "이디야커피 부천중동점")
3. address 불확실하면 동네명만, lat/lng 모르면 0 기재`;

    // 날씨 컨텍스트
    const weatherSection = weather ? `
## 현재 날씨 (${primaryArea})
- 날씨: ${weather.description}, 기온: ${weather.temp}°C
- ${weather.isRainy ? '비 또는 눈이 오고 있음 → 실내 장소 우선 추천' : ''}${weather.isHot ? '더운 날씨 → 에어컨 완비된 실내 선호' : ''}${weather.isCold ? '추운 날씨 → 따뜻한 실내 분위기 선호' : ''}` : '';

    const commonInfo = `
## 모임 정보
- 출발지: ${locationStr}
- 추천 지역: ${areaNames}
- 인원: ${groupSize}명${groupSize >= 5 ? ' (단체석 또는 넓은 공간 필수)' : ''}
- 분위기: ${vibeFirstStr}${vibeSecondStr ? ` / 2차: ${vibeSecondStr}` : ''}
- 현재 시각: ${currentTime}
- 혼잡도: ${congestionSummary || '정보 없음'}
${weatherSection}

## 추천 조건
- "${vibeFirstStr}" 분위기에 맞는 곳
- ${isQuiet ? '조용하고 여유로운 분위기' : '활기찬 분위기'}
- ${groupSize}명 수용 가능 규모${groupSize >= 5 ? ' (단체석 우선)' : ''}
- ${currentTime} 기준 영업 중 또는 곧 영업 시작 우선`;

    const placeSchema = `{
  "rank": 1,
  "placeName": "장소명",
  "category": "카테고리",
  "description": "한 줄 설명 20자 내외",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["태그1", "태그2", "태그3"],
  "address": "주소",
  "area": "지역명",
  "congestionLevel": "혼잡도",
  "openingHours": "HH:MM ~ HH:MM",
  "lat": 0,
  "lng": 0
}`;

    const placeSchemaWithWalking = placeSchema.replace('"lng": 0', '"lng": 0,\n  "walkingToNext": 10');

    const prompt = hasTwoPurposes
      ? `당신은 한국 모임 장소 큐레이터입니다. 1차·2차 코스 장소를 추천해주세요.
${naverSection}
${commonInfo}

## 응답 구성 (총 6곳)
- rank 1: 1차 "${purpose.first}" 최적. walkingToNext에 rank 2까지 도보 분 기재
- rank 2: 2차 "${purpose.second}" 최적 (rank 1과 도보 15분 이내)
- rank 3, 4: 1차 대안
- rank 5, 6: 2차 대안 (rank 2 인근)
rank 1·2는 같은 동네 또는 인접 지역.

## 응답 형식 (JSON만)
{"places": [${placeSchemaWithWalking}, {"rank": 2}, {"rank": 3}, {"rank": 4}, {"rank": 5}, {"rank": 6}]}`
      : `당신은 한국 모임 장소 큐레이터입니다. "${purpose.first}" 장소 3곳을 추천해주세요.
${naverSection}
${commonInfo}

## 응답 구성 (서로 다른 3곳)
- rank 1: 최적, rank 2·3: 대안

## 응답 형식 (JSON만)
{"places": [${placeSchema}, {"rank": 2}, {"rank": 3}]}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 응답 파싱 실패' });

    const parsed = JSON.parse(jsonMatch[0]);
    const places = Array.isArray(parsed.places) ? parsed.places : [parsed];

    // 1차·2차 도보 시간 haversine으로 보정 (rank 1 → rank 2)
    if (hasTwoPurposes) {
      const rank1 = places.find((p: { rank: number }) => p.rank === 1);
      const rank2 = places.find((p: { rank: number }) => p.rank === 2);
      if (rank1 && rank2 && rank1.lat && rank1.lng && rank2.lat && rank2.lng &&
          rank1.lat !== 0 && rank2.lat !== 0) {
        rank1.walkingToNext = walkingMinutes(rank1.lat, rank1.lng, rank2.lat, rank2.lng);
      }
    }

    return res.status(200).json(places);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
