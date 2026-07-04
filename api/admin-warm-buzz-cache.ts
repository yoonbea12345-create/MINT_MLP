import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBubbleScoreCached } from './_lib/blogBuzz.js';

// 인기 지역 블로그 버즈 캐시 워밍업 배치 — 수동/크론 트리거 전용.
// place_buzz_cache를 미리 채워두면, 실제 추천의 후보 선정 단계(recommend.ts L2)에서
// Claude가 "언급량·협찬률" 신호를 보고 거품 가게를 애초에 덜 고르게 된다(C3+C4).
//
// 요청 예시 (지역 하나씩):
//   curl -X POST -H "x-admin-secret: ..." -H "content-type: application/json" \
//     -d '{"region": "성수동"}' https://.../api/admin-warm-buzz-cache
// 여러 지역 한 번에:
//   -d '{"regions": ["성수동","강남역","연남동"]}'

const TIME_BUDGET_MS = 50_000; // Vercel maxDuration(60s) 안에서 여유
const PLACES_PER_QUERY = 8;    // 지역·키워드당 상위 몇 곳 분석
const KEYWORDS = ['맛집', '술집', '카페']; // 밥/술/카페 대표

interface NaverItem { name: string; address: string }

async function searchNaver(query: string, clientId: string, clientSecret: string): Promise<NaverItem[]> {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${PLACES_PER_QUERY}&sort=comment`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: { title: string; roadAddress: string; address: string }[] };
    return (data.items ?? []).map((it) => ({
      name: it.title.replace(/<[^>]*>/g, ''),
      address: it.roadAddress || it.address,
    }));
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminSecret = process.env.ADMIN_REFRESH_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: '인증 실패' });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'NAVER 키 미설정' });

  const body = (req.body ?? {}) as { region?: string; regions?: string[] };
  const regions = Array.isArray(body.regions)
    ? body.regions
    : body.region
    ? [body.region]
    : [];
  if (regions.length === 0) {
    return res.status(400).json({ error: 'region 또는 regions가 필요해요 (예: {"region":"성수동"}).' });
  }

  const startedAt = Date.now();
  let analyzed = 0;
  let skipped = 0;
  const processedRegions: string[] = [];
  const seen = new Set<string>(); // 같은 배치 내 중복 분석 방지

  outer:
  for (const region of regions) {
    for (const kw of KEYWORDS) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break outer;
      const items = await searchNaver(`${region} ${kw}`, clientId, clientSecret);
      for (const it of items) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) break outer;
        const dedup = `${it.name}|${it.address}`;
        if (seen.has(dedup)) { skipped++; continue; }
        seen.add(dedup);
        // getBubbleScoreCached: 캐시 히트면 즉시 반환(무료), 미스면 라이브 분석 후 upsert
        await getBubbleScoreCached(it.name, it.address, region);
        analyzed++;
      }
    }
    processedRegions.push(region);
  }

  const done = processedRegions.length === regions.length;
  return res.status(200).json({
    done,
    analyzed,
    skipped,
    processedRegions,
    remainingRegions: done ? [] : regions.filter((r) => !processedRegions.includes(r)),
    elapsedMs: Date.now() - startedAt,
  });
}
