import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp, checkRateLimit, validateRecommendBody } from './_lib/guard.js';
import { getBubbleScoreCached, getBubbleScoresCacheOnly } from './_lib/blogBuzz.js';
import { fetchStoresInRadius, matchStoreToPlace, lookupYearsAlive, computeLocalGem } from './_lib/publicData.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { placeKey } from './_lib/placeKey.js';
import { computeFinalScores } from './_lib/scoring.js';
import { fetchCongestion } from './_lib/congestion.js';

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

// L1(블로그 버즈)·L3(괴리 보정) 재채점을 위해 Claude가 먼저 확정 표시 개수보다
// 넉넉히 파이널리스트를 뽑게 한 뒤, 재채점 후 최종 표시 개수로 슬라이스한다.
// 표시는 단일 3곳 / 이중 6곳이라, 재정렬 풀은 8·5면 충분하다(출력 토큰 절감).
const FINALIST_COUNT_SINGLE = 8;
const FINALIST_COUNT_PER_PURPOSE = 5;

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

// 목적별 검색 키워드 (각 10개, 병렬 쿼리로 최대 50개 장소 확보)
const PURPOSE_KEYWORDS: Record<string, string[]> = {
  '밥':    ['맛집', '식당', '한식', '일식당', '고깃집', '파스타', '이탈리안', '삼겹살', '스시', '해산물'],
  '술':    ['이자카야', '술집', '포차', '호프', '와인바', '칵테일바', '맥주집', '펍', '바', '소주방'],
  '카페':  ['카페', '커피', '브런치', '디저트', '베이커리', '루프탑카페', '감성카페', '티카페', '핸드드립', '스페셜티'],
  '기타':  ['맛집', '음식점', '식당', '카페', '바', '이자카야', '포차', '브런치', '고깃집', '커피'],
};

// 편식 필터 — 사용자가 입력한 못 먹는 음식명 → 가게명/카테고리에서 걸러낼 확장 토큰.
// 입력 텍스트가 키를 포함하면 확장 토큰을 적용하고, 입력 자체(2자 이상)도 토큰으로 쓴다.
// '회'처럼 1글자 음식은 그대로 매칭하면 오탐('회식', '회관')이 나므로 확장 토큰으로만 거른다.
const EXCLUDE_FOOD_EXPANSIONS: [string, string[]][] = [
  ['회', ['횟집', '회센터', '물회', '사시미', '오마카세', '참치', '스시', '초밥']],
  ['날생선', ['횟집', '회센터', '물회', '사시미', '스시', '초밥']],
  ['생선', ['횟집', '회센터', '물회', '사시미', '생선구이', '생선조림']],
  ['조개', ['조개', '꼬막', '홍합', '오이스터']],
  ['굴', ['굴국', '굴보쌈', '굴전', '굴찜', '석화', '오이스터']],
  ['새우', ['새우', '쉬림프', '랍스터']],
  ['게', ['대게', '꽃게', '킹크랩', '크랩', '게장']],
  ['갑각', ['새우', '쉬림프', '랍스터', '대게', '꽃게', '킹크랩', '크랩']],
  ['해산물', ['해물', '해산물', '횟집', '조개', '수산']],
  ['곱창', ['곱창', '대창', '막창', '양곱창']],
  ['내장', ['곱창', '대창', '막창', '양곱창', '내장']],
  ['순대', ['순대', '순댓']],
  ['선지', ['선지', '선짓']],
  ['양고기', ['양고기', '양꼬치', '양갈비']],
  ['양꼬치', ['양고기', '양꼬치', '양갈비']],
  ['매운', ['마라', '불닭', '매운', '매콤', '짬뽕', '낙곱새']],
  ['맵', ['마라', '불닭', '매운', '매콤', '짬뽕', '낙곱새']],
  ['돼지', ['돼지', '삼겹', '족발', '보쌈', '돈까스', '돈카츠']],
  ['닭', ['치킨', '닭갈비', '닭발', '닭한마리', '삼계탕', '찜닭']],
  ['소고기', ['소고기', '한우', '갈비', '스테이크']],
];

function excludeFoodTokens(excludeFoods: string[]): string[] {
  const tokens = new Set<string>();
  for (const raw of excludeFoods) {
    const food = raw.trim();
    if (!food) continue;
    if (food.length >= 2) tokens.add(food); // 입력 자체도 매칭 토큰으로
    for (const [key, expansions] of EXCLUDE_FOOD_EXPANSIONS) {
      if (food.includes(key)) expansions.forEach((t) => tokens.add(t));
    }
  }
  return [...tokens];
}

function filterExcludedFoods<T extends NaverPlace>(places: T[], tokens: string[]): T[] {
  if (tokens.length === 0) return places;
  const filtered = places.filter((p) => !tokens.some((t) => p.name.includes(t) || p.category.includes(t)));
  // 후보가 전멸하면 사전 필터는 포기하고 프롬프트 하드 제약에만 맡긴다 (추천 불가보다 낫다)
  return filtered.length > 0 ? filtered : places;
}

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
  '홍대입구역':         '홍대',
};

function toSearchName(area: string): string {
  // 매핑에 없으면 '관광특구' 접미사만 제거 — "홍대 관광특구 술집" 같은 저효율 쿼리 방지
  return AREA_SEARCH_NAME[area] ?? area.replace(/\s*관광특구$/, '');
}

// 단일 Naver 쿼리 → raw items 반환 (display=5 is API max for local search)
// 429(초당 호출 제한)는 잠깐 쉬고 1회 재시도 — 키워드/목적 쿼리가 조용히 누락되는 걸 방지
async function fetchNaverQuery(
  query: string,
  clientId: string,
  clientSecret: string,
  attempt = 0,
): Promise<NaverPlace[]> {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=random`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      return fetchNaverQuery(query, clientId, clientSecret, 1);
    }
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
      // 태그 제거 + HTML 엔티티 복원 ("&amp;" 그대로 노출 방지)
      name: item.title.replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
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
  userKeywords: string[] = [],
): Promise<NaverPlace[]> {
  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const isLargeGroup = groupSize >= 5;
  const groupPrefix  = isLargeGroup ? '단체 ' : '';
  const budgetPrefix = budget === '~2만원' ? '가성비 ' : budget === '4만원+' ? '고급 ' : '';
  // 기타(직접 입력) 목적은 입력 텍스트 자체가 최우선 검색 키워드 — 안 넣으면 원하는 업종이 후보에 아예 없음
  const isCustomPurpose = !PURPOSE_KEYWORDS[purpose];
  const baseKeywords = isCustomPurpose ? [purpose, ...PURPOSE_KEYWORDS['기타']] : PURPOSE_KEYWORDS[purpose];

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

  // 사용자 지정 키워드(편의시설 칩·직접 입력)를 목적 힌트와 결합해 후보 검색에 직접 반영
  // — 프롬프트의 "필수 키워드"는 후보 풀에 해당 장소가 있어야만 작동하기 때문
  const categoryHint = isCustomPurpose
    ? purpose
    : ({ '밥': '맛집', '술': '술집', '카페': '카페' } as Record<string, string>)[purpose] ?? '맛집';
  for (const kw of userKeywords.slice(0, 5)) {
    if (searchAreas[0]) queries.push(`${searchAreas[0]} ${kw} ${categoryHint}`);
    if (searchAreas[1]) queries.push(`${searchAreas[1]} ${kw} ${categoryHint}`);
  }

  // 네이버 QPS 제한(초당 10회) — 1·2차 검색이 병렬로 돌므로 호출당 5개씩 끊어 실행
  const batches: NaverPlace[][] = [];
  for (let i = 0; i < queries.length; i += 5) {
    if (i > 0) await new Promise((r) => setTimeout(r, 350));
    const chunk = await Promise.all(
      queries.slice(i, i + 5).map((q) => fetchNaverQuery(q, clientId, clientSecret)),
    );
    batches.push(...chunk);
  }

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

  // 거리 가까운 순으로만 정렬 (프랜차이즈 여부 무관 — Claude가 상황 맞게 판단)
  all.sort((a, b) => a.dist - b.dist);

  return all.slice(0, 50);
}

// Open-Meteo 현재 날씨 조회 — API 키 불필요.
// (기존 OpenWeather는 프로덕션에서 항상 null을 반환하고 있었음 — 키 인증 실패.
//  키 관리가 필요 없는 Open-Meteo로 교체해 이 고장 유형 자체를 제거)
function wmoDescription(code: number): string {
  if (code === 0) return '맑음';
  if (code <= 2) return '구름 조금';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (code <= 57) return '이슬비';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '소낙눈';
  return '뇌우';
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=Asia%2FSeoul`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      current?: { temperature_2m?: number; precipitation?: number; weather_code?: number };
    };
    const cur = data.current;
    if (!cur || typeof cur.temperature_2m !== 'number') return null;
    const code = cur.weather_code ?? 0;
    const temp = cur.temperature_2m;
    return {
      description: wmoDescription(code),
      temp: Math.round(temp),
      // WMO 51 이상 = 강수(이슬비~뇌우). 실측 강수량도 함께 본다.
      isRainy: code >= 51 || (cur.precipitation ?? 0) > 0.1,
      isHot: temp >= 28,
      isCold: temp <= 5,
    };
  } catch {
    return null;
  }
}

// 네이버 이미지 검색으로 장소 대표 사진 1장 확보.
// link(원본)는 핫링크 차단이 잦아 네이버 CDN 썸네일(search.pstatic.net)을 쓰고,
// type 파라미터만 키워 카드 배너 해상도로 올린다.
async function fetchPlaceImage(
  name: string,
  area: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const query = `${area} ${name}`.trim();
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=1&sort=sim`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) return null;
    const data = await res.json() as { items?: { thumbnail?: string }[] };
    const thumb = data.items?.[0]?.thumbnail;
    if (!thumb || !thumb.startsWith('https://')) return null;
    return thumb.replace(/type=b\d+/, 'type=b400');
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

// Claude 응답에서 places 배열을 추출한다. 정상이면 JSON.parse 한 방에 되지만,
// max_tokens로 응답이 잘리면 마지막 객체가 불완전해 parse가 실패한다. 그럴 때
// 균형 잡힌 중괄호로 "완전한 객체만" 골라 복구한다(장소 몇 곳이라도 건지는 게 500보다 낫다).
function extractPlaces(text: string): Record<string, unknown>[] | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.places)) return parsed.places;
      if (parsed.placeName) return [parsed];
    } catch { /* 잘린 JSON → 아래 부분 복구로 폴백 */ }
  }

  // 부분 복구: "places" 배열 이후 균형 잡힌 최상위 {…} 객체들만 개별 파싱
  const placesIdx = text.indexOf('places');
  const arrStart = placesIdx >= 0 ? text.indexOf('[', placesIdx) : text.indexOf('[');
  if (arrStart < 0) return null;

  const objects: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let escaped = false;
  for (let i = arrStart; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try { objects.push(JSON.parse(text.slice(start, i + 1))); } catch { /* 이 조각은 버림 */ }
        start = -1;
      }
    }
  }
  return objects.length ? objects : null;
}

function formatNaverPlaces(places: (NaverPlace & { _isPublicGem?: boolean; _buzzHint?: string })[]): string {
  return places.map((p, i) => {
    const tag = p._isPublicGem ? '[공공데이터 발굴 후보 — 정보 적음, 업종/연차 기반 보수적 평가, 배제 금지] ' : '';
    const hint = p._buzzHint ? ` (참고: ${p._buzzHint})` : '';
    return `${i + 1}. ${tag}${p.name} | ${p.category} | ${p.address} | lat:${p.lat.toFixed(4)}, lng:${p.lng.toFixed(4)}${hint}`;
  }).join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // 입력 검증 — 임의 페이로드로 인한 예외/프롬프트 오염 차단
  const invalidMsg = validateRecommendBody(req.body);
  if (invalidMsg) return res.status(400).json({ error: invalidMsg });

  // 레이트리밋 — IP당 분당 5회, 전체 일일 상한(기본 500회, env로 조정)
  const gate = await checkRateLimit(
    getSupabaseAdmin(),
    'recommend',
    clientIp(req),
    5,
    Number(process.env.RECOMMEND_DAILY_CAP ?? 500),
  );
  if (!gate.allowed) {
    return res.status(429).json({
      error: gate.reason === 'daily'
        ? '오늘 추천 요청이 몰려서 잠시 쉬어가고 있어요. 내일 다시 만나요!'
        : '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.',
    });
  }

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

    const keywords: string[] = Array.isArray(input.keywords) ? input.keywords : [];

    // 편식 필터 — 후보 사전 제거(아래 filterExcludedFoods) + 프롬프트 절대 제약 이중 적용
    const excludeFoods: string[] = Array.isArray(input.excludeFoods)
      ? (input.excludeFoods as unknown[])
          .filter((f): f is string => typeof f === 'string' && !!f.trim())
          .map((f) => f.trim())
      : [];
    const excludeTokens = excludeFoodTokens(excludeFoods);

    // 지역명 목록: 신버전 클라이언트는 areas만 보내고 혼잡도는 서버가 병렬 조회(왕복 1회 절감),
    // 구버전 클라이언트는 congestionData에 조회 결과를 담아 보냄 — 둘 다 수용
    const clientCongestion = congestionData as { areaName: string; level: string }[];
    const areaList: string[] = clientCongestion.length
      ? clientCongestion.map((c) => c.areaName)
      : (Array.isArray(req.body.areas) ? (req.body.areas as string[]) : []);

    const areaNames = areaList.join(', ');
    const locationStr = (input.locations as { name: string }[])
      .map((l) => l.name)
      .filter(Boolean)
      .join(', ');
    const primaryArea = areaList[0] || areaNames;

    // 날씨 + 네이버 장소 + 혼잡도 병렬 fetch
    const midLat: number = midpoint?.lat ?? 37.5665;
    const midLng: number = midpoint?.lng ?? 126.9780;

    // 검색 지역 목록 (primaryArea + nearestAreas, 최대 3개)
    const searchAreas = areaList.slice(0, 3);

    const [weather, naverFirstRaw, naverSecondRaw, publicStores, congestionResolved] = await Promise.all([
      fetchWeather(midLat, midLng),
      searchNaverMulti(purpose.first, searchAreas, groupSize, midLat, midLng, occasion, relation, budget, keywords),
      hasTwoPurposes && purpose.second
        ? searchNaverMulti(purpose.second, searchAreas, groupSize, midLat, midLng, occasion, relation, budget, keywords)
        : Promise.resolve([]),
      fetchStoresInRadius(midLat, midLng, MIDPOINT_RADIUS_KM * 1000).catch((e) => {
        console.error('[recommend] L0 public data fetch failed', e);
        return [];
      }),
      clientCongestion.length
        ? Promise.resolve(clientCongestion)
        : fetchCongestion(areaList).catch(() => [] as { areaName: string; level: string }[]),
    ]);
    const congestionSummary = congestionResolved.map((c) => `${c.areaName}: ${c.level}`).join(', ');
    // 기하학적 중간지점 반경 이내 장소만 사용 + 편식 음식 전문점 사전 제거
    const naverFirstPlaces: (NaverPlace & { _isPublicGem?: boolean })[] =
      filterExcludedFoods(filterByRadius(naverFirstRaw, midLat, midLng), excludeTokens);
    const naverSecondPlaces: (NaverPlace & { _isPublicGem?: boolean })[] =
      naverSecondRaw.length ? filterExcludedFoods(filterByRadius(naverSecondRaw, midLat, midLng), excludeTokens) : [];
    if (excludeTokens.length > 0) {
      console.log(`[recommend] excludeFoods=${excludeFoods.join(',')} → first ${naverFirstPlaces.length}, second ${naverSecondPlaces.length}`);
    }

    // L0: 네이버에 없는(=매칭 실패) 공공데이터 상가 중 localGem 상위 소수를 후보 풀에 추가.
    // yearsAlive는 license_cache(사전 배치 적재) 매칭 성공 시에만 채워지며, 실패하면 localGem 0
    // 처리되어 자연히 상위권에서 제외된다(정보 없음 = 배제, 임의 추정 안 함).
    try {
      const allKnownPlaces = [...naverFirstPlaces, ...naverSecondPlaces];
      const unmatchedStores = publicStores.filter((s) => !matchStoreToPlace(s, allKnownPlaces));
      const gemCandidates = (
        await Promise.all(
          unmatchedStores.slice(0, 30).map(async (store) => {
            const yearsAlive = await lookupYearsAlive(store);
            const localGem = computeLocalGem(yearsAlive, 0);
            return { store, localGem };
          })
        )
      )
        .filter((g) => g.localGem > 0)
        .sort((a, b) => b.localGem - a.localGem)
        .slice(0, 3);

      // 1차 목록에만 추가 — 2차 목록에도 같은 가게를 넣으면 1차·2차 양쪽에 동시 추천되거나
      // 버즈 분석이 같은 곳을 중복 호출할 수 있다.
      for (const { store } of gemCandidates) {
        // 편식 필터는 공공데이터 발굴 후보에도 동일 적용
        if (excludeTokens.some((t) => store.name.includes(t) || store.category.includes(t))) continue;
        naverFirstPlaces.push({
          name: store.name, category: store.category, address: store.address,
          lat: store.lat, lng: store.lng, _isPublicGem: true,
        });
      }
      console.log(`[recommend] L0 publicStores=${publicStores.length} gemCandidates=${gemCandidates.length}`);
    } catch (e) {
      console.error('[recommend] L0 gem candidate injection failed', e);
    }

    // 재추천 제외: 방금 추천한 장소를 후보 목록에서 빼서 Claude가 못 고르게 한다.
    // (부분 문자열 매칭 — "아키야마 성수본점"과 "아키야마" 같은 표기 차이 흡수)
    const excludeNames: string[] = Array.isArray(req.body.excludeNames)
      ? (req.body.excludeNames as unknown[]).filter((n): n is string => typeof n === 'string' && n.length > 0)
      : [];
    if (excludeNames.length > 0) {
      const isExcluded = (name: string) =>
        excludeNames.some((ex) => name.includes(ex) || ex.includes(name));
      // 후보가 너무 줄면 추천 자체가 불가 → 3곳 이상 남을 때만 제외 적용
      const filteredFirst = naverFirstPlaces.filter((p) => !isExcluded(p.name));
      if (filteredFirst.length >= 3) naverFirstPlaces.splice(0, naverFirstPlaces.length, ...filteredFirst);
      const filteredSecond = naverSecondPlaces.filter((p) => !isExcluded(p.name));
      if (filteredSecond.length >= 3) naverSecondPlaces.splice(0, naverSecondPlaces.length, ...filteredSecond);
      console.log(`[recommend] excludeNames=${excludeNames.length} → first ${naverFirstPlaces.length}, second ${naverSecondPlaces.length}`);
    }

    const hasNaverData = naverFirstPlaces.length > 0;
    console.log(`[recommend] naverFirst=${naverFirstPlaces.length} naverSecond=${naverSecondPlaces.length} hasNaverData=${hasNaverData}`);
    // 2차 네이버 데이터 없으면 단일 목적 모드로 폴백 (할루시네이션 방지)
    const effectiveTwoPurposes = hasTwoPurposes && naverSecondPlaces.length > 0;

    // L2: 이전 요청에서 이미 캐시된 버즈 신호가 있으면(재추천 등) 참고용으로 프롬프트에 노출.
    // 라이브 블로그 분석(L1)은 파이널리스트 확정 후에만 돌기 때문에 최초 요청은 히트가 없을 수 있다.
    try {
      const allCandidates = [...naverFirstPlaces, ...naverSecondPlaces];
      const bubbleCache = await getBubbleScoresCacheOnly(
        allCandidates.map((p) => ({ name: p.name, address: p.address })),
      );
      for (const p of allCandidates as (NaverPlace & { _buzzHint?: string })[]) {
        const hit = bubbleCache.get(`${p.name}|${p.address}`);
        if (hit) p._buzzHint = `버즈 ${hit.buzzCount}건, 협찬률 ${Math.round(hit.sponsoredRatio * 100)}%`;
      }
    } catch (e) {
      console.error('[recommend] L2 buzz cache hint injection failed', e);
    }

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
⚠️ placeName은 위 데이터 그대로 복사. 절대 임의 생성 금지.
⚠️ 상황(예산·인원·분위기·목적)에 가장 맞는 장소를 프랜차이즈 여부에 무관하게 선택.` : `
## 절대 규칙
1. 실제 존재하고 영업 중인 장소만 추천
2. 상황(예산·인원·분위기·목적)에 가장 맞는 곳 우선 — 프랜차이즈 여부보다 조건 부합이 중요
3. address 불확실하면 동네명만, lat/lng 모르면 0 기재`;

    // 날씨 컨텍스트
    const weatherSection = weather ? `
## 현재 날씨 (${primaryArea})
- 날씨: ${weather.description}, 기온: ${weather.temp}°C
- ${weather.isRainy ? '비 또는 눈이 오고 있음 → 실내 장소 우선 추천' : ''}${weather.isHot ? '더운 날씨 → 에어컨 완비된 실내 선호' : ''}${weather.isCold ? '추운 날씨 → 따뜻한 실내 분위기 선호' : ''}` : '';

    const relationLine = relation ? `\n- 모임 관계: ${relation}` : '';
    const occasionLine = occasion ? `\n- 특별한 행사: ${occasion} → ${OCCASION_HINT[occasion] ?? '분위기에 맞는 곳'}` : '';
    const budgetLine = budget ? `\n- 예산: 1인 ${budget}` : '';
    const keywordsLine = keywords.length > 0
      ? `\n- 필수 키워드: ${keywords.map((k) => `#${k}`).join(' ')} ← 이 조건에 부합하는 장소 최우선 추천`
      : '';
    const excludeFoodsLine = excludeFoods.length > 0
      ? `\n- 🚫 못 먹는 음식(절대 제외): ${excludeFoods.join(', ')} ← 이 음식/재료가 주력 메뉴이거나 피하기 어려운 장소는 fitScore와 무관하게 절대 선택 금지 (편식·알레르기 하드 제약)`
      : '';

    const WEIGHT_DESC: Record<number, string> = { 1: '거의 무시', 2: '낮음', 3: '보통', 4: '중요', 5: '최우선 반영' };
    const vibeWeights: Record<string, number> = input.vibeWeights ?? {};
    const weightsSection = Object.keys(vibeWeights).length > 0
      ? `\n## 재추천 가중치 (사용자 지정)\n${Object.entries(vibeWeights).map(([label, w]) => `- ${label}: ${w}/5 (${WEIGHT_DESC[w] ?? '보통'})`).join('\n')}\n위 가중치를 반드시 고려하여 높은 가중치 항목을 최우선으로 반영하세요.`
      : '';

    const commonInfo = `
## 모임 정보
- 출발지: ${locationStr || `미입력 (${areaNames} 일대에서 모임)`}
- 추천 지역: ${areaNames}
- 인원: ${groupSize}명${groupSize >= 5 ? ' (단체석 또는 넓은 공간 필수)' : ''}${relationLine}${occasionLine}${budgetLine}${keywordsLine}${excludeFoodsLine}
- 분위기: ${vibeFirstStr}${vibeSecondStr ? ` / 2차: ${vibeSecondStr}` : ''}
- 현재 시각: ${currentTime}
- 혼잡도: ${congestionSummary || '정보 없음'}
${weatherSection}${weightsSection}

## 추천 조건
- "${vibeFirstStr}" 분위기에 맞는 곳
- ${isQuiet ? '조용하고 여유로운 분위기' : '활기찬 분위기'}
- ${groupSize}명 수용 가능 규모${groupSize >= 5 ? ' (단체석 우선)' : ''}
- ${currentTime} 기준 영업 중 또는 곧 영업 시작 우선${excludeFoods.length > 0 ? `\n- ⚠️ ${excludeFoods.join(', ')} 위주 메뉴 장소 절대 금지 — 일행 중 못 먹는 사람이 있음` : ''}${occasion ? `\n- ${OCCASION_HINT[occasion] ?? ''}` : ''}${budget ? `\n- 1인 예산 ${budget} 내외` : ''}${relation === '연인' ? '\n- 커플 분위기, 프라이빗하고 조용한 공간 선호' : ''}${relation === '직장동료' ? '\n- 회식에 적합한 단체 공간, 넓은 테이블 선호' : ''}${relation === '가족' ? '\n- 가족 모임에 편한 공간, 소음 덜한 환경 선호' : ''}`;

    const fitScoreGuide = `
## 적합도 점수 (fitScore) 산정 기준 — 각 장소마다 0~100 정수 기재
- 취향/분위기 일치도 (35점): 사용자 선택 vibe와 얼마나 잘 맞는가
- 목적 적합도 (20점): "${purpose.first}" 목적에 얼마나 적합한가${vibeWeights && Object.keys(vibeWeights).length > 0 ? '\n- 가중치 반영 (추가 +10점 풀): 위 재추천 가중치가 높은 항목일수록 더 높게' : ''}
- 예산 적합도 (15점): 예산 조건 충족 여부 (예산 없으면 만점)
- 혼잡도/시간 적합도 (10점): 현재 시각 기준 혼잡도와 영업 여부
- 진짜 맛집 신뢰도 (20점): 다음 신호로 판단 —
  · 오래된 가게(노포) 혹은 전문성 있는 단일 메뉴 위주 (+5~8점)
  · 리뷰가 음식 맛·재방문 위주이며 마케팅성 "인생샷/감성/협찬" 냄새가 없음 (+5~7점)
  · 과도한 SNS 노출·체험단 냄새 없이 입소문으로 알려진 로컬 맛집 (+3~5점)
  · 상황(예산·인원·목적)에 진짜로 맞는 선택인가 (프랜차이즈라도 최선이면 만점 가능) (+0~5점)
  · 목록에 "(참고: 버즈 N건, 협찬률 N%)"가 표기된 곳은 실측 데이터다. 이렇게 해석하라 —
    · 버즈(블로그 언급) 건수가 많으면서 협찬률이 낮은 곳 = 협찬 아닌 진짜 입소문 맛집 → 최우선 (+5~8점)
    · 버즈는 많은데 협찬률이 높은 곳 = 마케팅으로 뜬 거품 의심 → 보수적으로 감점
    · 버즈가 적은 곳 = 신규이거나 알려지지 않은 곳(나쁜 신호 아님) → 다른 신호로 판단
    · 표기가 아예 없는 곳은 판단 재료 부족으로만 취급하고 불리하게 감점하지 말 것(정보 없음 ≠ 거품 있음)
rank 1이 반드시 가장 높아야 하며, 장소마다 솔직하고 차별화된 점수를 부여하세요.`;

    // slotRank: 해당 purposeSlot 목록 내에서 Claude가 매긴 선호 순서(1이 최선).
    // purposeSlot: 1=1차 목적, 2=2차 목적. 최종 표시 3~6곳으로 줄이기 전, 버즈 분석(L1)·
    // 괴리 보정(L3) 재채점을 위해 넉넉한 파이널리스트를 먼저 받는다.
    // 네이버 후보 목록이 없을 때 sourceIndex를 요구하면 모델이 "목록이 없어 선택 불가"로
    // 거부해 JSON 파싱이 실패한다(간헐 500의 원인). 목록 있을 때만 스키마에 포함.
    // AI 출력 다이어트: 주소·좌표·카테고리·지역은 어차피 서버가 네이버 실데이터로 덮어쓰고,
    // 혼잡도는 서버가 실측값으로 대체/제거한다 — 목록이 있으면 스키마에서 제외해
    // 출력 토큰을 ~35% 줄인다(응답 속도 단축, 최종 데이터는 동일).
    const finalistSchema = (slotRank: number, purposeSlot: number) => hasNaverData ? `{
  "slotRank": ${slotRank},
  "purposeSlot": ${purposeSlot},
  "sourceIndex": <목록번호>,
  "placeName": "장소명 (목록에서 그대로)",
  "description": "한 줄 설명 20자 내외",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["태그1", "태그2", "태그3"],
  "fitScore": <0~100>
}` : `{
  "slotRank": ${slotRank},
  "purposeSlot": ${purposeSlot},
  "placeName": "장소명",
  "category": "카테고리",
  "description": "한 줄 설명 20자 내외",
  "priceRange": "1인 예상 가격대",
  "vibeTags": ["태그1", "태그2", "태그3"],
  "address": "주소 (모르면 동네명만)",
  "area": "지역명",
  "fitScore": <0~100>,
  "lat": 0,
  "lng": 0
}`;

    const prompt = effectiveTwoPurposes
      ? `당신은 한국 모임 장소 큐레이터입니다. 1차·2차 코스 장소 후보를 각각 선호 순서대로 ${FINALIST_COUNT_PER_PURPOSE}곳씩 추천해주세요.
${naverSection}
${commonInfo}
${fitScoreGuide}

## 응답 구성 (${hasNaverData ? `1차 목록에서 ${FINALIST_COUNT_PER_PURPOSE}곳 + 2차 목록에서 ${FINALIST_COUNT_PER_PURPOSE}곳, ` : ''}총 ${FINALIST_COUNT_PER_PURPOSE * 2}곳)
- purposeSlot 1(1차 "${purpose.first}") ${FINALIST_COUNT_PER_PURPOSE}곳: slotRank 1이 가장 적합, 내림차순. 같은 슬롯 내 ${hasNaverData ? 'sourceIndex' : '장소'} 중복 금지
- purposeSlot 2(2차 "${purpose.second}") ${FINALIST_COUNT_PER_PURPOSE}곳: slotRank 1이 가장 적합, 내림차순. 같은 슬롯 내 ${hasNaverData ? 'sourceIndex' : '장소'} 중복 금지
- 각 슬롯의 slotRank 1은 서로 도보 15분 이내로 이어질 수 있는 조합을 우선 고려

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [
  ${Array.from({ length: FINALIST_COUNT_PER_PURPOSE }, (_, i) => finalistSchema(i + 1, 1)).join(',\n  ')},
  ${Array.from({ length: FINALIST_COUNT_PER_PURPOSE }, (_, i) => finalistSchema(i + 1, 2)).join(',\n  ')}
]}`
      : `당신은 한국 모임 장소 큐레이터입니다. "${purpose.first}" 장소 후보를 선호 순서대로 ${FINALIST_COUNT_SINGLE}곳 추천해주세요.
${naverSection}
${commonInfo}
${fitScoreGuide}

## 응답 구성 (${hasNaverData ? '1차 목록에서 ' : ''}서로 다른 ${FINALIST_COUNT_SINGLE}곳, purposeSlot은 항상 1)
- slotRank 1이 가장 적합, 내림차순. ${hasNaverData ? 'sourceIndex' : '장소'} 중복 금지

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"places": [
  ${Array.from({ length: FINALIST_COUNT_SINGLE }, (_, i) => finalistSchema(i + 1, 1)).join(',\n  ')}
]}`;

    // 파이널리스트 12곳 JSON이 잘리지 않도록 넉넉하게. non-streaming이라 timeout 여유 안에서 8192.
    const MAX_TOKENS = 8192;
    // 모델 A/B 실험용 오버라이드 — 관리자 키 일치 시에만 (일반 사용자 요청에는 영향 없음)
    const benchModel = typeof req.body._benchModel === 'string'
      && !!process.env.ADMIN_PASSWORD
      && req.headers['x-admin-key'] === process.env.ADMIN_PASSWORD
      ? req.body._benchModel : null;
    // A/B 실측(2026-07-06, 18회): sonnet-5는 opus-4-8과 목적적합률·키워드반영률·성공률 전 항목
    // 동률에 AI 구간 18% 빠르고 비용 절반 — 후보 선별+L3 재정렬 구조라 모델 상한에 둔감.
    const model = benchModel ?? 'claude-sonnet-5';
    const aiStart = Date.now();
    let message;
    try {
      message = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        // sonnet-5는 thinking 생략 시 adaptive가 기본 — JSON 선택 작업이라 저지연을 위해 비활성화
        ...(model.startsWith('claude-sonnet-5') ? { thinking: { type: 'disabled' as const } } : {}),
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      if (e instanceof Anthropic.APIError && e.status === 529) {
        message = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        });
      } else {
        throw e;
      }
    }
    const aiMs = Date.now() - aiStart;

    if (message.stop_reason === 'max_tokens') {
      console.warn('[recommend] 응답이 max_tokens에서 잘림 — 부분 복구 시도');
    }

    const text = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const finalists = extractPlaces(text);
    if (!finalists || finalists.length === 0) {
      console.error('[recommend] places 추출 실패. 응답 앞부분:', text.slice(0, 300));
      return res.status(500).json({ error: '추천 결과를 정리하지 못했어요. 다시 시도해주세요.' });
    }

    // 네이버 실존 데이터로 강제 덮어쓰기 (할루시네이션 방지) — purposeSlot 기준으로 목록 선택
    if (hasNaverData) {
      const usedFirst = new Set<number>();
      const usedSecond = new Set<number>();

      for (const place of finalists) {
        const isSecond = place.purposeSlot === 2;
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
        // 슬림 스키마에는 area가 없으므로 서버가 채움 (UI의 address 폴백 표기용)
        if (place.area == null) place.area = primaryArea;

        // openingHours는 Naver에 없어서 항상 할루시네이션 → 제거
        delete place.openingHours;
        delete place.sourceIndex;
      }
    }

    // L1: 파이널리스트 전체에 대해 블로그 버즈 분석 (캐시 우선, 실패 시 개별 0점 폴백)
    try {
      await Promise.all(
        finalists.map(async (place: { placeName: string; address: string; bubbleScore?: number; buzzCount?: number }) => {
          const buzz = await getBubbleScoreCached(place.placeName, place.address, primaryArea);
          place.bubbleScore = buzz.bubbleScore;
          place.buzzCount = buzz.buzzCount;
        })
      );
    } catch (e) {
      console.error('[recommend] L1 buzz analysis failed', e);
    }

    // L3: naverRank(네이버 거리순 검색 결과에서의 위치 — 원 노출순위 프록시)와
    // isPublicGem(L0에서 localGem 상위로 이미 선별된 공공데이터 발굴 후보) 태깅 후 finalScore 계산.
    // 프랜차이즈 후순위 로직은 부활시키지 않는다 — naverRank는 정렬용이 아니라 괴리 감지용 신호일 뿐.
    try {
      for (const f of finalists) {
        const list = f.purposeSlot === 2 ? naverSecondPlaces : naverFirstPlaces;
        const idx = list.findIndex((p) => p.name === f.placeName && p.address === f.address);
        f.naverRank = idx >= 0 ? idx : null;
        f.isPublicGem = idx >= 0 ? Boolean(list[idx]._isPublicGem) : false;
      }

      // 사용자 지정 키워드가 장소의 태그/설명에 실제로 매칭된 개수 — 객관 순위 신호
      const countKeywordHits = (f: { placeName?: string; vibeTags?: string[]; description?: string; category?: string }): number => {
        if (keywords.length === 0) return 0;
        const haystack = [
          f.placeName ?? '',
          ...(Array.isArray(f.vibeTags) ? f.vibeTags : []),
          f.description ?? '',
          f.category ?? '',
        ].join(' ').replace(/\s/g, '');
        return keywords.filter((k) => haystack.includes(k.replace(/\s/g, ''))).length;
      };

      const scoreSlot = (slot: number) => {
        const input: {
          placeName: string; address: string; fitScore: number; bubbleScore: number;
          naverRank: number | null; isPublicGem: boolean; keywordHits: number;
        }[] = finalists
          .filter((f) => f.purposeSlot === slot)
          .map((f) => ({
            ...f,
            fitScore: f.fitScore ?? 0,
            bubbleScore: f.bubbleScore ?? 0,
            keywordHits: countKeywordHits(f),
          }));
        return computeFinalScores(input);
      };

      const finalScoreByKey = new Map<string, number>();
      for (const s of [...scoreSlot(1), ...scoreSlot(2)]) {
        finalScoreByKey.set(`${s.placeName}|${s.address}`, s.finalScore);
      }
      for (const f of finalists) {
        f.finalScore = finalScoreByKey.get(`${f.placeName}|${f.address}`) ?? f.fitScore;
      }
    } catch (e) {
      console.error('[recommend] L3 scoring failed', e);
    }

    // 최종 표시 개수로 슬라이스 — finalScore(L3 재정렬) 내림차순
    const bySlot = (slot: number) =>
      finalists.filter((p) => p.purposeSlot === slot).sort((a, b) => (b.finalScore ?? b.fitScore ?? 0) - (a.finalScore ?? a.fitScore ?? 0));

    let places;
    if (effectiveTwoPurposes) {
      const firstSorted = bySlot(1);
      const secondSorted = bySlot(2);
      places = [
        firstSorted[0] && { ...firstSorted[0], rank: 1 },
        secondSorted[0] && { ...secondSorted[0], rank: 2 },
        firstSorted[1] && { ...firstSorted[1], rank: 3 },
        firstSorted[2] && { ...firstSorted[2], rank: 4 },
        secondSorted[1] && { ...secondSorted[1], rank: 5 },
        secondSorted[2] && { ...secondSorted[2], rank: 6 },
      ].filter(Boolean);
    } else {
      places = bySlot(1)
        .slice(0, 3)
        .map((p, i) => ({ ...p, rank: i + 1 }));
    }

    const debugBubbleScores = finalists.map((p: { placeName: string; bubbleScore?: number; buzzCount?: number }) => ({
      placeName: p.placeName,
      bubbleScore: p.bubbleScore,
      buzzCount: p.buzzCount,
    }));

    // 클라이언트 응답에서 내부 전용 필드 제거
    for (const p of places) {
      delete p.slotRank;
      delete p.purposeSlot;
    }

    // Kakao 장소 URL + 대표 사진 병렬 보강 (표시 확정된 3~6곳만 — 추가 왕복 1회 안에 처리)
    const kakaoRestKey = process.env.VITE_KAKAO_REST_API_KEY;
    const naverImgId = process.env.NAVER_CLIENT_ID;
    const naverImgSecret = process.env.NAVER_CLIENT_SECRET;
    await Promise.all(
      places.map(async (place: { placeName: string; area?: string; lat: number; lng: number; kakaoPlaceUrl?: string; imageUrl?: string }) => {
        const hasCoords = place.lat && place.lng && place.lat !== 0 && place.lng !== 0;
        const [placeUrl, imageUrl] = await Promise.all([
          kakaoRestKey && hasCoords
            ? searchKakaoPlaceUrl(place.placeName, place.lat, place.lng, kakaoRestKey)
            : Promise.resolve(null),
          naverImgId && naverImgSecret
            ? fetchPlaceImage(place.placeName, toSearchName(typeof place.area === 'string' ? place.area : primaryArea), naverImgId, naverImgSecret)
            : Promise.resolve(null),
        ]);
        if (placeUrl) place.kakaoPlaceUrl = placeUrl;
        if (imageUrl) place.imageUrl = imageUrl;
      })
    );

    // 혼잡도 정직화: 서울 실시간 데이터가 실제로 있을 때만 노출, 없으면 필드 제거
    // (기존에는 Claude가 지어낸 혼잡도가 그대로 나갔다 — 실측 아닌 값은 보여주지 않는다)
    const realCongestion = congestionResolved
      .find((c) => c.level && c.level !== '알 수 없음')?.level ?? null;
    for (const p of places) {
      if (realCongestion) p.congestionLevel = realCongestion;
      else delete p.congestionLevel;
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

    // L4: 후보별 신호·노출·선택 기록 (분석은 v2 스코프 — 지금은 기록만, 실패해도 응답엔 무영향)
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const displayedByKey = new Map(
          places.map((p) => [`${p.placeName}|${p.address}`, p.rank as number]),
        );
        const candidates = finalists.map((f: {
          placeName: string; address: string; purposeSlot: number; slotRank: number;
          fitScore?: number; bubbleScore?: number; buzzCount?: number;
          naverRank?: number | null; isPublicGem?: boolean; finalScore?: number;
        }) => {
          const key = `${f.placeName}|${f.address}`;
          return {
            place_key: placeKey(f.placeName, f.address),
            purposeSlot: f.purposeSlot,
            slotRank: f.slotRank,
            fitScore: f.fitScore ?? null,
            bubbleScore: f.bubbleScore ?? null,
            buzzCount: f.buzzCount ?? null,
            naverRank: f.naverRank ?? null,
            isPublicGem: f.isPublicGem ?? false,
            finalScore: f.finalScore ?? null,
            finalRank: displayedByKey.get(key) ?? null,
            displayed: displayedByKey.has(key),
          };
        });

        await supabase.from('recommendation_log').insert({
          group_size: groupSize,
          purpose_first: purpose.first,
          purpose_second: purpose.second,
          budget,
          vibe_first: vibeFirstStr,
          vibe_second: vibeSecondStr || null,
          midpoint_lat: midLat,
          midpoint_lng: midLng,
          candidates,
        });
      }
    } catch (e) {
      console.error('[recommend] L4 recommendation_log insert failed', e);
    }

    return res.status(200).json({
      places,
      // 유저 배너용 날씨 요약 — 프롬프트에는 이미 반영됨(우천 시 실내 우선), 이제 그 사실을 유저에게도 보여준다
      weather: weather
        ? { description: weather.description, temp: weather.temp, isRainy: weather.isRainy, isHot: weather.isHot, isCold: weather.isCold }
        : null,
      // 내부 스코어링은 디버그 플래그 켰을 때만 노출
      ...(process.env.EXPOSE_DEBUG === '1'
        ? { _debug: { naverPlacesCount: naverFirstPlaces.length, bubbleScores: debugBubbleScores } }
        : {}),
      // 모델 실험 시에만 측정 메타 노출
      ...(benchModel ? { _bench: { model, aiMs, outputTokens: message.usage?.output_tokens ?? null } } : {}),
    });
  } catch (e) {
    console.error('[recommend] failed', e);
    return res.status(500).json({ error: '추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.' });
  }
}
