import type { VercelRequest, VercelResponse } from '@vercel/node';

// 행정단위 계층 자동완성 — 카카오 REST(키워드+주소 검색)로 시/구/동 제안을 만든다.
// 사용자가 입력한 깊이(시→구→동)에 맞춰 추천 범위가 정해지도록, 각 제안에
// level(범위 단위)과 matchTokens(추천 결과 주소에서 반드시 포함돼야 할 토큰)을 실어 보낸다.

export type RegionLevel = 'city' | 'district' | 'dong';

export interface RegionSuggestion {
  level: RegionLevel;
  label: string;        // 화면 표시: "인천 미추홀구"
  query: string;        // 네이버 검색 프리픽스: "인천 미추홀구"
  sido: string;         // "인천"
  gu?: string;          // "미추홀구" (도-시-구 구조면 "수원시 팔달구")
  dong?: string;        // "학익동"
  matchTokens: string[];// 결과 주소 필터용 (모두 포함돼야 함)
  lat: number;
  lng: number;
}

// 광역 접미사 제거 → 짧은 표기(주소 부분매칭에 유리). "인천광역시"→"인천", "강원특별자치도"→"강원"
function shortSido(s: string): string {
  return s
    .replace(/특별자치시$/, '')
    .replace(/특별자치도$/, '')
    .replace(/특별시$/, '')
    .replace(/광역시$/, '')
    .replace(/자치도$/, '')
    .replace(/도$/, '')
    .trim();
}

const GU_RE = /(구|군)$/;
const SI_RE = /시$/;
const DONG_RE = /(동|읍|면|가|리)$/;

interface Parsed {
  sido: string;          // 짧은 표기
  guPath: string;        // "미추홀구" 또는 "수원시 팔달구"
  gu: string;            // 마지막 구/군 (없으면 '')
  dong: string;          // '' 가능
  lat: number;
  lng: number;
}

// "인천 미추홀구 학익동 123-4" / "경기 수원시 팔달구 매산로1가" 형태를 계층으로 분해
function parseAddress(addressName: string, lat: number, lng: number): Parsed | null {
  if (!addressName) return null;
  const tokens = addressName.trim().split(/\s+/);
  if (tokens.length < 2) return null;
  const sido = shortSido(tokens[0]);

  // 동/읍/면 토큰 위치 (시/군/구로 끝나는 건 제외)
  const dongIdx = tokens.findIndex((t, i) => i > 0 && DONG_RE.test(t) && !GU_RE.test(t) && !SI_RE.test(t));

  // 시/도 다음부터 시/군/구로 끝나는 토큰들이 guPath (도-시-구 3단 구조 대응)
  const guTokens: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (GU_RE.test(t) || SI_RE.test(t)) guTokens.push(t);
    else if (DONG_RE.test(t)) break; // 동에 도달하면 중단
  }
  const guPath = guTokens.join(' ');
  const gu = [...guTokens].reverse().find((t) => GU_RE.test(t)) ?? '';
  const dong = dongIdx >= 0 ? tokens[dongIdx] : '';

  return { sido, guPath, gu, dong, lat, lng };
}

interface KakaoDoc {
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
}

async function kakaoKeyword(query: string, key: string): Promise<KakaoDoc[]> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return [];
    const data = await res.json() as { documents?: KakaoDoc[] };
    return data.documents ?? [];
  } catch {
    return [];
  }
}

async function kakaoAddress(query: string, key: string): Promise<{ address_name: string; x: string; y: string; address?: { region_1depth_name?: string; region_2depth_name?: string; region_3depth_name?: string } }[]> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=15`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return [];
    const data = await res.json() as { documents?: { address_name: string; x: string; y: string; address?: Record<string, string> }[] };
    return (data.documents ?? []) as never;
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.VITE_KAKAO_REST_API_KEY;
  if (!key) return res.status(500).json({ error: 'kakao key missing' });

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 1) return res.status(200).json({ suggestions: [] });

  const debug = req.query.debug === '1';

  const [kw, addr] = await Promise.all([
    kakaoKeyword(q, key),
    kakaoAddress(q, key),
  ]);

  // 입력 토큰 수 = 사용자가 의도한 깊이 (도 구조는 아래에서 보정)
  const qTokens = q.split(/\s+/).filter(Boolean);

  // 카카오 결과를 계층 파싱
  const parsedList: Parsed[] = [];
  for (const d of kw) {
    const p = parseAddress(d.address_name ?? '', parseFloat(d.y ?? '0'), parseFloat(d.x ?? '0'));
    if (p) parsedList.push(p);
  }
  for (const d of addr) {
    const a = d.address;
    if (a?.region_1depth_name) {
      parsedList.push({
        sido: shortSido(a.region_1depth_name),
        guPath: a.region_2depth_name ?? '',
        gu: (a.region_2depth_name ?? '').split(/\s+/).reverse().find((t) => GU_RE.test(t)) ?? '',
        dong: a.region_3depth_name && DONG_RE.test(a.region_3depth_name) ? a.region_3depth_name : '',
        lat: parseFloat(d.y ?? '0'),
        lng: parseFloat(d.x ?? '0'),
      });
    } else {
      const p = parseAddress(d.address_name ?? '', parseFloat(d.y ?? '0'), parseFloat(d.x ?? '0'));
      if (p) parsedList.push(p);
    }
  }

  // 레벨별 대표(첫 등장 좌표) 수집
  const cityMap = new Map<string, Parsed>();
  const distMap = new Map<string, Parsed>();
  const dongMap = new Map<string, Parsed>();
  for (const p of parsedList) {
    if (!p.sido || !p.lat || !p.lng) continue;
    if (!cityMap.has(p.sido)) cityMap.set(p.sido, p);
    if (p.guPath) {
      const dk = `${p.sido} ${p.guPath}`;
      if (!distMap.has(dk)) distMap.set(dk, p);
    }
    if (p.guPath && p.dong) {
      const nk = `${p.sido} ${p.guPath} ${p.dong}`;
      if (!dongMap.has(nk)) dongMap.set(nk, p);
    }
  }

  const suggestions: RegionSuggestion[] = [];

  const cityList = [...cityMap.entries()];
  const distList = [...distMap.entries()];
  const dongList = [...dongMap.entries()];

  // 깊이 판정: 입력 토큰 수 기준. 단, guPath가 "시 구"(2단어)인 도 구조면 한 단계 깊게 본다.
  const looksDong = dongList.length > 0 && qTokens.length >= 3;
  const looksDistrict = distList.length > 0 && qTokens.length >= 2;

  if (looksDong) {
    for (const [nk, p] of dongList) {
      suggestions.push({
        level: 'dong',
        label: nk,
        query: nk,
        sido: p.sido, gu: p.gu, dong: p.dong,
        matchTokens: [p.gu || p.sido, p.dong].filter(Boolean),
        lat: p.lat, lng: p.lng,
      });
    }
  }

  if (looksDistrict) {
    for (const [dk, p] of distList) {
      suggestions.push({
        level: 'district',
        label: dk,
        query: dk,
        sido: p.sido, gu: p.gu,
        matchTokens: [p.sido, p.gu].filter(Boolean),
        lat: p.lat, lng: p.lng,
      });
    }
  }

  // 시(도) 레벨은 항상 후보에 (특히 1토큰 입력 시 최상단)
  for (const [c, p] of cityList) {
    suggestions.push({
      level: 'city',
      label: `${c} 전체`,
      query: c,
      sido: c,
      matchTokens: [c],
      lat: p.lat, lng: p.lng,
    });
  }

  // 입력 토큰이 모두 label에 포함되는 제안만 (부분 입력 좁히기)
  const filtered = suggestions.filter((s) =>
    qTokens.every((t) => s.label.replace(/\s/g, '').includes(t.replace(/\s/g, '')) || s.query.replace(/\s/g, '').includes(t.replace(/\s/g, ''))),
  );

  // 레벨 우선순위: 입력 깊이에 맞는 레벨을 위로. dong>district>city 또는 반대(1토큰이면 city 위로)
  const levelRank = (lv: RegionLevel): number => {
    if (qTokens.length >= 3) return { dong: 0, district: 1, city: 2 }[lv];
    if (qTokens.length === 2) return { district: 0, dong: 1, city: 2 }[lv];
    return { city: 0, district: 1, dong: 2 }[lv];
  };
  filtered.sort((a, b) => levelRank(a.level) - levelRank(b.level));

  const out = filtered.slice(0, 8);

  return res.status(200).json({
    suggestions: out,
    ...(debug ? { _debug: { qTokens, kwCount: kw.length, addrCount: addr.length, parsedSample: parsedList.slice(0, 8), kwAddresses: kw.map((d) => d.address_name).slice(0, 15) } } : {}),
  });
}
