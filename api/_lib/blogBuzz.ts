import { getSupabaseAdmin } from './supabaseAdmin';
import { placeKey } from './placeKey';

export interface BubbleResult {
  bubbleScore: number;
  sponsoredRatio: number;
  burstiness: number;
  recentSpike: number;
  revisitRatio: number;
  buzzCount: number;
}

const ZERO_RESULT: BubbleResult = {
  bubbleScore: 0,
  sponsoredRatio: 0,
  burstiness: 0,
  recentSpike: 0,
  revisitRatio: 0,
  buzzCount: 0,
};

const SPONSORED_MARKERS = [
  '협찬', '체험단', '원고료', '제공받아', '제공 받아', '지원받아', '초청', '무상으로', '서포터즈',
];
const REVISIT_MARKERS = [
  '재방문', '또 왔', '단골', '번째', '자주 가', '자주 오',
];

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// postdate(YYYYMMDD)들을 월 단위로 버킷팅해 3개월 슬라이딩 윈도우 중 최대 밀집도 계산
function computeBurstiness(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const months = dates.map((d) => d.getFullYear() * 12 + d.getMonth()).sort((a, b) => a - b);
  let maxWindowCount = 0;
  for (let i = 0; i < months.length; i++) {
    const windowEnd = months[i] + 2;
    let count = 0;
    for (let j = i; j < months.length && months[j] <= windowEnd; j++) count++;
    maxWindowCount = Math.max(maxWindowCount, count);
  }
  return maxWindowCount / dates.length;
}

export function computeBubbleScore(
  items: { title: string; description: string; postdate: string }[],
  total: number,
): BubbleResult {
  const buzzCount = total;
  if (items.length < 3) {
    return { ...ZERO_RESULT, buzzCount };
  }

  const texts = items.map((it) => `${it.title}${it.description}`);
  const sponsoredRatio = texts.filter((t) => SPONSORED_MARKERS.some((m) => t.includes(m))).length / items.length;
  const revisitRatio = texts.filter((t) => REVISIT_MARKERS.some((m) => t.includes(m))).length / items.length;

  const dates = items
    .map((it) => it.postdate)
    .filter((d) => /^\d{8}$/.test(d))
    .map((d) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`));

  const burstiness = computeBurstiness(dates);

  const now = Date.now();
  const recentSpike = dates.filter((d) => now - d.getTime() <= RECENT_WINDOW_MS).length / items.length;

  const bubbleScore = clamp(
    sponsoredRatio * 45 + burstiness * 30 + recentSpike * 25 - revisitRatio * 30,
    0,
    100,
  );

  return { bubbleScore, sponsoredRatio, burstiness, recentSpike, revisitRatio, buzzCount };
}

// 네이버 블로그 검색 1회 → bubbleScore 계산 (캐시 없이 라이브 조회)
async function fetchBlogBuzz(placeName: string, areaName: string): Promise<BubbleResult | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const query = `${placeName} ${areaName}`.trim();
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=30&sort=date`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      total?: number;
      items?: { title: string; description: string; postdate: string }[];
    };
    const items = (data.items ?? []).map((it) => ({
      title: it.title.replace(/<[^>]*>/g, ''),
      description: it.description.replace(/<[^>]*>/g, ''),
      postdate: it.postdate,
    }));
    return computeBubbleScore(items, data.total ?? items.length);
  } catch (e) {
    console.error(`[blogBuzz] ERROR query="${placeName} ${areaName}"`, e);
    return null;
  }
}

// L2 프롬프트 주입용: 라이브 API 호출 없이 캐시만 벌크 조회(place_buzz_cache 1회 IN 쿼리).
// 파이널리스트 확정 전(=아직 어떤 후보가 최종 후보인지 모름) 단계라 전체 네이버 후보에 대해
// 굳이 라이브 블로그 검색을 하지 않는다 — 이전 요청에서 이미 분석해 캐시된 것만 참고로 노출.
export async function getBubbleScoresCacheOnly(
  keys: { name: string; address: string }[],
): Promise<Map<string, BubbleResult>> {
  const result = new Map<string, BubbleResult>();
  const supabase = getSupabaseAdmin();
  if (!supabase || keys.length === 0) return result;

  const keyToPlaceKey = new Map(keys.map((k) => [`${k.name}|${k.address}`, placeKey(k.name, k.address)]));
  const placeKeys = [...new Set(keyToPlaceKey.values())];

  try {
    const { data } = await supabase
      .from('place_buzz_cache')
      .select('place_key, bubble_score, sponsored_ratio, burstiness, recent_spike, revisit_ratio, buzz_count, analyzed_at')
      .in('place_key', placeKeys);

    const rowByPlaceKey = new Map((data ?? []).map((r) => [r.place_key, r]));
    for (const [origKey, pk] of keyToPlaceKey) {
      const row = rowByPlaceKey.get(pk);
      if (row && Date.now() - new Date(row.analyzed_at).getTime() < CACHE_TTL_MS) {
        result.set(origKey, {
          bubbleScore: row.bubble_score,
          sponsoredRatio: row.sponsored_ratio,
          burstiness: row.burstiness,
          recentSpike: row.recent_spike,
          revisitRatio: row.revisit_ratio,
          buzzCount: row.buzz_count,
        });
      }
    }
  } catch (e) {
    console.error('[blogBuzz] cache-only bulk read failed', e);
  }
  return result;
}

// place_buzz_cache 조회(TTL 14일) → 미스 시 라이브 분석 후 upsert. 항상 폴백 가능한 값을 반환.
export async function getBubbleScoreCached(
  name: string,
  address: string,
  areaName: string,
): Promise<BubbleResult> {
  const key = placeKey(name, address);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      const { data } = await supabase
        .from('place_buzz_cache')
        .select('bubble_score, sponsored_ratio, burstiness, recent_spike, revisit_ratio, buzz_count, analyzed_at')
        .eq('place_key', key)
        .maybeSingle();

      if (data && Date.now() - new Date(data.analyzed_at).getTime() < CACHE_TTL_MS) {
        return {
          bubbleScore: data.bubble_score,
          sponsoredRatio: data.sponsored_ratio,
          burstiness: data.burstiness,
          recentSpike: data.recent_spike,
          revisitRatio: data.revisit_ratio,
          buzzCount: data.buzz_count,
        };
      }
    } catch (e) {
      console.error('[blogBuzz] cache read failed', e);
    }
  }

  const result = await fetchBlogBuzz(name, areaName);
  if (!result) return ZERO_RESULT;

  if (supabase) {
    try {
      await supabase.from('place_buzz_cache').upsert({
        place_key: key,
        bubble_score: result.bubbleScore,
        sponsored_ratio: result.sponsoredRatio,
        burstiness: result.burstiness,
        recent_spike: result.recentSpike,
        revisit_ratio: result.revisitRatio,
        buzz_count: result.buzzCount,
        analyzed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[blogBuzz] cache write failed', e);
    }
  }

  return result;
}
