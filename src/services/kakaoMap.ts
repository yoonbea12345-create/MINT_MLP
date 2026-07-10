import { ensureKakaoMaps } from '../utils/kakaoLoader';

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
}

declare global {
  interface Window { kakao: any; Kakao: any }
}

const cache = new Map<string, KakaoPlace[]>();

export async function searchKakaoKeyword(
  keyword: string,
  options?: { x?: string; y?: string; radius?: number }
): Promise<KakaoPlace[]> {
  const cacheKey = keyword + JSON.stringify(options ?? {});
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  await ensureKakaoMaps();

  return new Promise((resolve, reject) => {
    const ps = new window.kakao.maps.services.Places();
    const opts: Record<string, unknown> = { size: 5 };
    if (options?.x) opts.x = Number(options.x);
    if (options?.y) opts.y = Number(options.y);
    if (options?.radius) opts.radius = options.radius;
    ps.keywordSearch(
      keyword,
      (results: KakaoPlace[], status: string) => {
        const { OK, ZERO_RESULT } = window.kakao.maps.services.Status;
        if (status === OK) {
          cache.set(cacheKey, results);
          resolve(results);
        } else if (status === ZERO_RESULT) {
          cache.set(cacheKey, []);
          resolve([]);
        } else {
          reject(new Error('카카오 장소 검색 실패'));
        }
      },
      opts
    );
  });
}

export async function searchAddress(keyword: string): Promise<KakaoPlace[]> {
  return searchKakaoKeyword(keyword);
}

export interface Neighborhood {
  area: string;   // "대구 수성구 대흥동" 형태 (시 구 동)
  lat: number;
  lng: number;
}

// 지번 주소(address_name)에서 '시 [구...] 동' 부분만 뽑는다.
// 동/읍/면/가/리로 끝나는 첫 토큰까지 포함 → 성남시 분당구처럼 구가 여러 토큰이어도 안전.
function toDongLabel(addressName: string): string | null {
  if (!addressName) return null;
  const tokens = addressName.trim().split(/\s+/);
  const idx = tokens.findIndex((t) => /(동|읍|면|가|리)$/.test(t));
  if (idx < 0) return null;
  return tokens.slice(0, idx + 1).join(' ');
}

// 만날 '지역' 검색 전용 — POI가 아니라 시/구/동 동네 단위 제안 목록을 돌려준다.
// keywordSearch 결과의 지번 주소에서 동네를 뽑아 중복 제거.
export async function searchNeighborhoods(keyword: string): Promise<Neighborhood[]> {
  const places = await searchKakaoKeyword(keyword);
  const seen = new Set<string>();
  const out: Neighborhood[] = [];
  for (const p of places) {
    const area = toDongLabel(p.address_name);
    if (!area || seen.has(area)) continue;
    seen.add(area);
    out.push({ area, lat: parseFloat(p.y), lng: parseFloat(p.x) });
    if (out.length >= 6) break;
  }
  return out;
}

// 행정단위(시/구/동) 계층 자동완성 — 카카오 JS SDK 키워드 검색 결과의 주소를 계층 파싱해서
// 사용자가 입력한 깊이(시→구→동)에 맞는 제안을 만든다. (별도 서버 함수 없이 클라이언트에서 처리)
export type RegionLevel = 'city' | 'district' | 'dong';
export interface RegionSuggestion {
  level: RegionLevel;
  label: string;
  query: string;
  sido: string;
  gu?: string;
  dong?: string;
  matchTokens: string[];// 결과 주소에 모두 포함돼야 하는 행정 토큰 (추천 범위 고정용)
  searchAreas: string[];// 네이버 검색 프리픽스 (시=유명상권 여러 곳, 구/동=그 자체)
  lat: number;
  lng: number;
}

const GU_RE = /(구|군)$/;
const SI_RE = /시$/;
const DONG_RE = /(동|읍|면|가|리)$/;

function shortSido(s: string): string {
  return s
    .replace(/특별자치시$/, '').replace(/특별자치도$/, '')
    .replace(/특별시$/, '').replace(/광역시$/, '')
    .replace(/자치도$/, '').replace(/도$/, '')
    .trim();
}

interface Parsed { sido: string; guPath: string; gu: string; dong: string; lat: number; lng: number; }

// "인천 미추홀구 학익동 123-4" / "경기 수원시 팔달구 매산로1가" → 계층 분해
function parseAddr(addressName: string, lat: number, lng: number): Parsed | null {
  if (!addressName) return null;
  const tokens = addressName.trim().split(/\s+/);
  if (tokens.length < 2) return null;
  const sido = shortSido(tokens[0]);
  const dongIdx = tokens.findIndex((t, i) => i > 0 && DONG_RE.test(t) && !GU_RE.test(t) && !SI_RE.test(t));
  const guTokens: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (GU_RE.test(t) || SI_RE.test(t)) guTokens.push(t);
    else if (DONG_RE.test(t)) break;
  }
  const guPath = guTokens.join(' ');
  const gu = [...guTokens].reverse().find((t) => GU_RE.test(t)) ?? '';
  const dong = dongIdx >= 0 ? tokens[dongIdx] : '';
  if (!sido || !lat || !lng) return null;
  return { sido, guPath, gu, dong, lat, lng };
}

// 시 전체 추천 시 '유명상권 우선'으로 검색할 대표 상권 (구를 흩어 배치 → 구 골고루)
const FAMOUS_AREAS: Record<string, string[]> = {
  '서울': ['강남역', '홍대', '성수동', '종로', '잠실', '여의도'],
  '인천': ['부평', '송도', '구월동', '인천 차이나타운', '청라'],
  '부산': ['서면', '해운대', '남포동', '광안리', '전포동'],
  '대구': ['동성로', '수성못', '들안길', '앞산카페거리'],
  '대전': ['둔산동', '은행동', '유성온천', '봉명동'],
  '광주': ['상무지구', '충장로', '첨단', '수완지구'],
  '울산': ['삼산동', '성남동', '무거동'],
  '세종': ['나성동', '조치원', '어진동'],
  '수원': ['수원역', '인계동', '광교', '영통'],
  '성남': ['판교', '서현역', '모란'],
  '용인': ['수지', '기흥역', '동백'],
  '고양': ['일산', '정발산', '화정'],
  '창원': ['상남동', '마산', '진해'],
  '청주': ['성안길', '복대동', '율량동'],
  '천안': ['불당동', '천안역', '두정동'],
  '전주': ['한옥마을', '객사', '신시가지'],
  '제주': ['제주시청', '연동', '노형동', '중문'],
};

const noSpace = (s: string) => (s || '').replace(/\s/g, '');
const regionCache = new Map<string, RegionSuggestion[]>();

export async function searchRegions(q: string): Promise<RegionSuggestion[]> {
  const key = q.trim();
  if (!key) return [];
  if (regionCache.has(key)) return regionCache.get(key)!;

  let places: KakaoPlace[] = [];
  try {
    places = await searchKakaoKeyword(key);
  } catch { return []; }

  const parsed: Parsed[] = [];
  for (const p of places) {
    const r = parseAddr(p.address_name, parseFloat(p.y), parseFloat(p.x));
    if (r) parsed.push(r);
  }

  const cityMap = new Map<string, Parsed>();
  const distMap = new Map<string, Parsed>();
  const dongMap = new Map<string, Parsed>();
  for (const p of parsed) {
    if (!cityMap.has(p.sido)) cityMap.set(p.sido, p);
    if (p.guPath) { const dk = `${p.sido} ${p.guPath}`; if (!distMap.has(dk)) distMap.set(dk, p); }
    if (p.guPath && p.dong) { const nk = `${p.sido} ${p.guPath} ${p.dong}`; if (!dongMap.has(nk)) dongMap.set(nk, p); }
  }

  const qTokens = key.split(/\s+/).filter(Boolean);
  const suggestions: RegionSuggestion[] = [];

  // 입력 토큰 수 = 의도한 깊이. 동(≥3) / 구(≥2) / 시(항상)
  if (dongMap.size && qTokens.length >= 3) {
    for (const [nk, p] of dongMap) {
      suggestions.push({ level: 'dong', label: nk, query: nk, sido: p.sido, gu: p.gu, dong: p.dong,
        matchTokens: [p.gu || p.sido, p.dong].filter(Boolean), searchAreas: [nk], lat: p.lat, lng: p.lng });
    }
  }
  if (distMap.size && qTokens.length >= 2) {
    for (const [dk, p] of distMap) {
      suggestions.push({ level: 'district', label: dk, query: dk, sido: p.sido, gu: p.gu,
        matchTokens: [p.sido, p.gu].filter(Boolean), searchAreas: [dk], lat: p.lat, lng: p.lng });
    }
  }
  for (const [c, p] of cityMap) {
    const famous = FAMOUS_AREAS[c];
    let areas: string[];
    if (famous?.length) {
      areas = famous.map((a) => (a.includes(c) ? a : `${c} ${a}`)).slice(0, 6);
    } else {
      const gus = [...distMap.values()].filter((dp) => dp.sido === c && dp.gu).map((dp) => `${c} ${dp.gu}`);
      areas = [...new Set(gus)].slice(0, 5);
      if (!areas.length) areas = [c];
    }
    suggestions.push({ level: 'city', label: `${c} 전체`, query: c, sido: c,
      matchTokens: [c], searchAreas: areas, lat: p.lat, lng: p.lng });
  }

  // 입력 토큰이 모두 label에 포함되는 제안만
  const filtered = suggestions.filter((s) =>
    qTokens.every((t) => noSpace(s.label).includes(noSpace(t)) || noSpace(s.query).includes(noSpace(t))));

  const levelRank = (lv: RegionLevel): number => {
    if (qTokens.length >= 3) return { dong: 0, district: 1, city: 2 }[lv];
    if (qTokens.length === 2) return { district: 0, dong: 1, city: 2 }[lv];
    return { city: 0, district: 1, dong: 2 }[lv];
  };
  filtered.sort((a, b) => levelRank(a.level) - levelRank(b.level));

  const out = filtered.slice(0, 8);
  regionCache.set(key, out);
  return out;
}

// 동네 이름("대구 수성구 대흥동") → 동 대표 좌표. 실패 시 null.
export async function geocodeArea(area: string): Promise<{ lat: number; lng: number } | null> {
  try {
    await ensureKakaoMaps();
    const geocoder = new window.kakao.maps.services.Geocoder();
    const OK = window.kakao.maps.services.Status.OK;
    return await new Promise((resolve) => {
      geocoder.addressSearch(area, (res: any[], status: string) => {
        resolve(status === OK && res[0] ? { lat: parseFloat(res[0].y), lng: parseFloat(res[0].x) } : null);
      });
    });
  } catch {
    return null;
  }
}
