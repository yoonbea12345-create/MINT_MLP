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

// 중간지점 반경 (1차: 1.5km, 부족하면 3km로 확장)
const MIDPOINT_RADIUS_KM = 1.5;

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkingMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round((distKm(lat1, lng1, lat2, lng2) / 4) * 60);
}

// 중간지점 기준 반경 내 장소만 필터링.
// 1단계: 1.5km 이내 3개 이상 → 반환
// 2단계: 부족하면 3km로 확장
// 3단계: 그래도 없으면 거리순 정렬 후 전체 반환 (시골·비도심 대응)
function filterByRadius(places: NaverPlace[], midLat: number, midLng: number): NaverPlace[] {
  const withDist = places.map((p) => ({ ...p, _dist: distKm(midLat, midLng, p.lat, p.lng) }));
  const inPrimary = withDist.filter((p) => p._dist <= MIDPOINT_RADIUS_KM);
  if (inPrimary.length >= 3) return inPrimary;
  const inExpanded = withDist.filter((p) => p._dist <= MIDPOINT_RADIUS_KM * 2);
  if (inExpanded.length > 0) return inExpanded;
  // 반경 내 장소 없음 → 무게중심에서 가장 가까운 순으로 전체 반환
  return withDist.sort((a, b) => a._dist - b._dist);
}

// 대형 프랜차이즈 체인 키워드 (이름에 포함되면 프랜차이즈로 판단)
const FRANCHISE_KEYWORDS = [
  '스타벅스','이디야','투썸','메가커피','빽다방','컴포즈','탐앤탐스','폴바셋','커피빈',
  '맥도날드','버거킹','롯데리아','KFC','맘스터치','서브웨이','노브랜드버거',
  '파리바게뜨','뚜레쥬르','던킨','크리스피크림',
  'CJ올리브','올리브영','GS25','CU편의점','세븐일레븐',
  '본죽','한솥','김밥천국','국민','놀부','BBQ','BHC','교촌','굽네','네네치킨',
  '이마트24','홈플러스','롯데마트',
];

function isFranchise(name: string): boolean {
  return FRANCHISE_KEYWORDS.some((kw) => name.includes(kw));
}

// 목적별 검색 키워드 (각 10개, 병렬 쿼리로 최대 50개 장소 확보)
const PURPOSE_KEYWORDS: Record<string, string[]> = {
  '밥':    ['맛집', '식당', '한식', '일식당', '고깃집', '파스타', '이탈리안', '삼겹살', '스시', '해산물'],
  '술':    ['이자카야', '술집', '포차', '호프', '와인바', '칵테일바', '맥주집', '펍', '바', '소주방'],
  '카페':  ['카페', '커피', '브런치', '디저트', '베이커리', '루프탑카페', '감성카페', '티카페', '핸드드립', '스페셜티'],
  '기타':  ['맛집', '음식점', '식당', '카페', '바', '이자카야', '포차', '브런치', '고깃집', '커피'],
};

// 행사별 추가 키워드 (1순위 지역에 extra 쿼리로 추가)
const OCCASION_EXTRA_KEYWORDS: Record<string, string[]> = {
  '생일':   ['프라이빗룸 식당', '생일 케이크 반입', '이벤트 레스토랑', '생일 맛집'],
  '기념일': ['프라이빗룸 식당', '기념일 레스토랑', '코스요리', '분위기 좋은 레스토랑'],
  '소개팅': ['소개팅 맛집', '분위기 좋은 식당', '조용한 레스토랑', '데이트 맛집'],
  '축하':   ['단체 모임 맛집', '파티 가능 식당', '이벤트 레스토랑'],
  '위로':   ['감성 맛집', '조용한 술집', '힐링 카페'],
};

// 관계별 추가 키워드
const RELATION_EXTRA_KEYWORDS: Record<string, string[]> = {
  '연인':    ['데이트 맛집', '커플 맛집'],
  '직장동료': ['회식 맛집', '단체 식당'],
  '가족':    ['가족 식사 맛집', '넓은 식당'],
};

// 행사별 Claude 힌트
const OCCASION_HINT: Record<string, string> = {
  '생일':   '프라이빗룸 또는 케이크 반입 가능 우선, 이벤트 연출 가능한 곳',
  '기념일': '분위기 있는 공간, 프라이빗 좌석, 조용한 환경 선호',
  '소개팅': '조용하고 대화하기 좋은 공간, 테이블 간격 넓은 곳',
  '축하':   '신나는 분위기, 파티 가능한 곳, 큰 테이블 선호',
  '위로':   '조용하고 편안한 분위기, 오래 머물 수 있는 곳',
};

// 혼잡도 area명 → 네이버 검색에 효과적인 동네명으로 매핑
const AREA_SEARCH_NAME: Record<string, string> = {
  '강남 MICE 관광특구': '강남역',
  '동대문 관광특구':    '동대문',
  '이태원 관광특구':    '이태원',
  '잠실 관광특구':      '잠실',
  '신촌·이대역':        '신촌',
  '한남·이태원':        '한남동',
  '합정역':             '합정',
  '성수역':             '성수동',
  '건대입구역':         '건대',
  '북촌한옥마을':       '북촌',
  '고양 정발산역':      '일산',
};

function toSearchName(area: string): string {
  return AREA_SEARCH_NAME[area] ?? area;
}

// 단일 Naver 쿼리 → raw items 반환 (display=5 is API max for local search)
async function fetchNaverQuery(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<NaverPlace[]> {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=comment`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[Naver API] FAIL query="${query}" status=${res.status} body=${errText.slice(0, 200)}`);
      return [];
    }
    const data = await res.json() as {
      items?: { title: string; category: string; roadAddress: string; address: string; mapx: string; mapy: string }[];
    };
    const items = data.items ?? [];
    console.log(`[Naver API] OK query="${query}" count=${items.length}`);
    return items.map((item) => ({
      name: item.title.replace(/<[^>]*>/g, ''),
      category: item.category,
      address: item.roadAddress || item.address,
      lat: parseInt(item.mapy) / 1e7,
      lng: parseInt(item.mapx) / 1e7,
    }));
  } catch (e) {
    console.error(`[Naver API] ERROR query="${query}"`, e);
    return [];
  }
}

/**
 * 목적별 다중 키워드로 네이버 검색 → 중복 제거 + 거리순 정렬 → 최대 50개 반환.
 * - 1순위 지역: 전체 키워드(10개) × display=5 → 최대 50개 raw
 * - 2순위 지역: 상위 5개 키워드 추가
 * - 3순위 지역: 상위 3개 키워드 추가
 * 프랜차이즈는 로컬 뒤에 정렬.
 */
async function searchNaverMulti(
  purpose: string,
  areas: string[],
  groupSize: number,
  midLat: number,
  midLng: number,
  occasion?: string | null,
  relation?: string | null,
  budget?: string | null,
): Promise<NaverPlace[]> {
  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const isLargeGroup = groupSize >= 5;
  const groupPrefix  = isLargeGroup ? '단체 ' : '';
  const budgetPrefix = budget === '~2만원' ? '가성비 ' : budget === '4만원+' ? '고급 ' : '';
  const baseKeywords = PURPOSE_KEYWORDS[purpose] ?? PURPOSE_KEYWORDS['기타'];

  // 행사/관계 추가 키워드 병합
  const extraKeywords = [
    ...(occasion ? (OCCASION_EXTRA_KEYWORDS[occasion] ?? []) : []),
    ...(relation ? (RELATION_EXTRA_KEYWORDS[relation] ?? []) : []),
  ];
  const keywords = [...extraKeywords, ...baseKeywords];

  const searchAreas  = areas.map(toSearchName).filter(Boolean);

  // 쿼리 빌드: 1순위×(extra+10), 2순위×5, 3순위×3
  const queries: string[] = [];
  if (searchAreas[0]) keywords.forEach((kw) => queries.push(`${searchAreas[0]} ${groupPrefix}${budgetPrefix}${kw}`));
  if (searchAreas[1]) keywords.slice(0, 5).forEach((kw) => queries.push(`${searchAreas[1]} ${groupPrefix}${budgetPrefix}${kw}`));
  if (searchAreas[2]) keywords.slice(0, 3).forEach((kw) => queries.push(`${searchAreas[2]} ${groupPrefix}${budgetPrefix}${kw}`));

  const batches = await Promise.all(queries.map((q) => fetchNaverQuery(q, clientId, clientSecret)));

  // 중복 제거 (이름+주소 기준)
  const seen = new Set<string>();
  const all: (NaverPlace & { dist: number })[] = [];
  for (const batch of batches) {
    for (const p of batch) {
      const key = `${p.name}|${p.address}`;
      if (seen.has(key) || !p.lat || !p.lng) continue;
      seen.add(key);
      const dist = Math.hypot(p.lat - midLat, p.lng - midLng);
      all.push({ ...p, dist });
    }
  }

  // 거리 가까운 순으로 정렬, 로컬 앞 / 프랜차이즈 뒤
  all.sort((a, b) => {
    const af = isFranchise(a.name) ? 1 : 0;
    const bf = isFranchise(b.name) ? 1 : 0;
    if (af !== bf) return af - bf;
    return a.dist - b.dist;
  });

  return all.slice(0, 50);
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

async function searchKakaoPlaceUrl(
  name: string,
  lat: number,
  lng: number,
  restApiKey: string,
): Promise<string | null> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}&x=${lng}&y=${lat}&radius=300&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restApiKey}` } });
    if (!res.ok) return null;
    const data = await res.json() as { documents?: { place_url: string }[] };
    return data.documents?.[0]?.place_url ?? null;
  } catch {
    return null;
  }
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
    const relation: string | null = input.relation ?? null;
    const occasion: string | null = input.occasion ?? null;
    const budget: string | null = input.budget ?? null;

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

    // 검색 지역 목록 (primaryArea + nearestAreas, 최대 3개)
    const searchAreas = [
      primaryArea,
      ...((congestionData as { areaName: string }[]).map((c) => c.areaName).filter((a) => a !== primaryArea)),
    ].slice(0, 3);

    const [weather, naverFirstRaw, naverSecondRaw] = await Promise.all([
      fetchWeather(midLat, midLng),
      searchNaverMulti(purpose.first, searchAreas, groupSize, midLat, midLng, occasion, relation, budget),
      hasTwoPurposes && purpose.second
        ? searchNaverMulti(purpose.second, searchAreas, groupSize, midLat, midLng, occasion, relation, budget)
        : Promise.resolve([]),
    ]);
    // 기하학적 중간지점 반경 이내 장소만 사용
    const naverFirstPlaces = filterByRadius(naverFirstRaw, midLat, midLng);
    const naverSecondPlaces = naverSecondRaw.length ? filterByRadius(naverSecondRaw, midLat, midLng) : [];

    const hasNaverData = naverFirstPlaces.length > 0;
    console.log(`[recommend] naverFirst=${naverFirstPlaces.length} naverSecond=${naverSecondPlaces.length} hasNaverData=${hasNaverData}`);
    // 2차 네이버 데이터 없으면 단일 목적 모드로 폴백 (할루시네이션 방지)
    const effectiveTwoPurposes = hasTwoPurposes && naverSecondPlaces.length > 0;

    // 네이버 데이터 있을 때 전용 규칙
    const naverSection = hasNaverData ? `
## 네이버 검색으로 확인된 실존 장소 목록 (총 ${naverFirstPlaces.length}개 중 최적 선택)
### 1차 목적 "${purpose.first}" 후보
${formatNaverPlaces(naverFirstPlaces)}
${effectiveTwoPurposes ? `
### 2차 목적 "${purpose.second}" 후보
${formatNaverPlaces(naverSecondPlaces)}` : ''}

⚠️ 반드시 위 목록의 번호(1~N)에서만 선택. 목록 외 장소 생성 절대 금지.
⚠️ sourceIndex는 선택한 목록 번호를 정확히 기재. 같은 목록 내 중복 사용 금지.
⚠️ placeName·address·lat·lng는 위 데이터 그대로 복사. 절대 임의 생성 금지.
⚠️ 로컬 맛집·개인 운영 식당 최우선. 대형 프랜차이즈 전체 중 최대 1개.` : `
## 절대 규칙
1. 실제 존재하고 영업 중인 장소만 추천
2. 로컬 맛집·개인 운영 식당 우선, 대형 프랜차이즈는 전체 추천 중 최대 1개
3. address 불확실하면 동네명만, lat/lng 모르면 0 기재`;

    // 날씨 컨텍스트
    const weatherSection = weather ? `
## 현재 날씨 (${primaryArea})
- 날씨: ${weather.description}, 기온: ${weather.temp}°C
- ${weather.isRainy ? '비 또는 눈이 오고 있음 → 실내 장소 우선 추천' : ''}${weather.isHot ? '더운 날씨 → 에어컨 완비된 실내 선호' : ''}${weather.isCold ? '추운 날씨 → 따뜻한 실내 분위기 선호' : ''}` : '';

    const relationLine = relation ? `\n- 모임 관계: ${relation}` : '';
    const occasionLine = occasion ? `\n- 특별한 행사: ${occasion} → ${OCCASION_HINT[occasion] ?? '분위기에 맞는 곳'}` : '';
    const budgetLine = budget ? `\n- 예산: 1인 ${budget}` : '';

    const commonInfo = `
## 모임 정보
- 출발지: ${locationStr}
- 추천 지역: ${areaNames}
- 인원: ${groupSize}명${groupSize >= 5 ? ' (단체석 또는 넓은 공간 필수)' : ''}${relationLine}${occasionLine}${budgetLine}
- 분위기: ${vibeFirstStr}${vibeSecondStr ? ` / 2차: ${vibeSecondStr}` : ''}
- 현재 시각: ${currentTime}
- 혼잡도: ${congestionSummary || '정보 없음'}
${weatherSection}

## 추천 조건
- "${vibeFirstStr}" 분위기에 맞는 곳
- ${isQuiet ? '조용하고 여유로운 분위기' : '활기찬 분위기'}
- ${groupSize}명 수용 가능 규모${groupSize >= 5 ? ' (단체석 우선)' : ''}
- ${currentTime} 기준 영업 중 또는 곧 영업 시작 우선${occasion ? `\n- ${OCCASION_HINT[occasion] ?? ''}` : ''}${budget ? `\n- 1인 예산 ${budget} 내외` : ''}${relation === '연인' ? '\n- 커플 분위기, 프라이빗하고 조용한 공간 선호' : ''}${relation === '직장동료' ? '\n- 회식에 적합한 단체 공간, 넓은 테이블 선호' : ''}${relation === '가족' ? '\n- 가족 모임에 편한 공간, 소음 덜한 환경 선호' : ''}`;

    const placeSchema = `{
  "rank": 1,
  "sourceIndex": 1,
  "placeName": "장소명 (목록에서 그대로)",
  "category": "카테고리",
  "description": "한 줄 설명 20자 내외",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["태그1", "태그2", "태그3"],
  "address": "주소 (목록에서 그대로)",
  "area": "지역명",
  "congestionLevel": "혼잡도",
  "lat": 0,
  "lng": 0
}`;

    const placeSchemaWithWalking = placeSchema.replace('"lng": 0', '"lng": 0,\n  "walkingToNext": 10');

    const rankSchema = (rank: number) =>
      placeSchema.replace('"rank": 1', `"rank": ${rank}`).replace('"sourceIndex": 1', `"sourceIndex": <목록번호>`);

    const prompt = effectiveTwoPurposes
      ? `당신은 한국 모임 장소 큐레이터입니다. 1차·2차 코스 장소를 추천해주세요.
${naverSection}
${commonInfo}

## 응답 구성 (총 6곳)
- rank 1: 1차 "${purpose.first}" 최적 (1차 목록에서 선택). walkingToNext에 rank 2까지 도보 분 기재
- rank 2: 2차 "${purpose.second}" 최적 (2차 목록에서 선택, rank 1과 도보 15분 이내)
- rank 3, 4: 1차 대안 (1차 목록에서 선택)
- rank 5, 6: 2차 대안 (2차 목록에서 선택)

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [
  ${placeSchemaWithWalking},
  ${rankSchema(2)},
  ${rankSchema(3)},
  ${rankSchema(4)},
  ${rankSchema(5)},
  ${rankSchema(6)}
]}`
      : `당신은 한국 모임 장소 큐레이터입니다. "${purpose.first}" 장소 3곳을 추천해주세요.
${naverSection}
${commonInfo}

## 응답 구성 (서로 다른 3곳, 모두 1차 목록에서 선택)
- rank 1: 최적, rank 2·3: 대안 (서로 다른 sourceIndex 사용)

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [
  ${placeSchema},
  ${rankSchema(2)},
  ${rankSchema(3)}
]}`;

    let message;
    try {
      message = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      if (e instanceof Anthropic.APIError && e.status === 529) {
        message = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });
      } else {
        throw e;
      }
    }

    const text = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 응답 파싱 실패' });

    const parsed = JSON.parse(jsonMatch[0]);
    const places = Array.isArray(parsed.places) ? parsed.places : [parsed];

    // 네이버 실존 데이터로 강제 덮어쓰기 (할류시네이션 방지)
    if (hasNaverData) {
      const usedFirst = new Set<number>();
      const usedSecond = new Set<number>();

      for (const place of places) {
        const isSecond = effectiveTwoPurposes && [2, 5, 6].includes(place.rank);
        const naverList: NaverPlace[] = isSecond ? naverSecondPlaces : naverFirstPlaces;
        const used = isSecond ? usedSecond : usedFirst;
        if (!naverList.length) continue;

        // AI가 선택한 sourceIndex (1-based → 0-based)
        let idx = typeof place.sourceIndex === 'number' ? place.sourceIndex - 1 : -1;

        // sourceIndex가 잘못됐거나 중복이면 이름 매칭으로 대체
        if (idx < 0 || idx >= naverList.length || used.has(idx)) {
          const nameIdx = naverList.findIndex(
            (p) => p.name.includes(place.placeName ?? '') || (place.placeName ?? '').includes(p.name)
          );
          idx = nameIdx >= 0 && !used.has(nameIdx)
            ? nameIdx
            : naverList.findIndex((_, i) => !used.has(i));
        }

        // 미사용 슬롯 없음(네이버 결과 부족) → 첫 번째 실존 데이터 재사용 (할루시네이션보다 낫음)
        if (idx < 0) idx = 0;

        used.add(idx);
        const naver = naverList[idx];
        place.placeName = naver.name;
        place.address = naver.address;
        place.lat = naver.lat;
        place.lng = naver.lng;
        if (naver.category) place.category = naver.category;

        // openingHours는 Naver에 없어서 항상 할류시네이션 → 제거
        delete place.openingHours;
        delete place.sourceIndex;
      }
    }

    // Kakao 장소 URL 병렬 보강 (place_url 있으면 정식 카카오 페이지 연결)
    const kakaoRestKey = process.env.VITE_KAKAO_REST_API_KEY;
    if (kakaoRestKey) {
      await Promise.all(
        places.map(async (place: { placeName: string; lat: number; lng: number; kakaoPlaceUrl?: string }) => {
          if (place.lat && place.lng && place.lat !== 0 && place.lng !== 0) {
            const placeUrl = await searchKakaoPlaceUrl(place.placeName, place.lat, place.lng, kakaoRestKey);
            if (placeUrl) place.kakaoPlaceUrl = placeUrl;
          }
        })
      );
    }

    // 1차·2차 도보 시간 haversine으로 보정 (rank 1 → rank 2)
    if (effectiveTwoPurposes) {
      const rank1 = places.find((p: { rank: number }) => p.rank === 1);
      const rank2 = places.find((p: { rank: number }) => p.rank === 2);
      if (rank1 && rank2 && rank1.lat && rank1.lng && rank2.lat && rank2.lng &&
          rank1.lat !== 0 && rank2.lat !== 0) {
        rank1.walkingToNext = walkingMinutes(rank1.lat, rank1.lng, rank2.lat, rank2.lng);
      }
    }

    return res.status(200).json({ places, _debug: { naverPlacesCount: naverFirstPlaces.length } });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
