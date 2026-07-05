import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── 공용 요청 가드: IP 추출 · 레이트리밋 · recommend 입력 검증 ──

export function clientIp(req: VercelRequest): string {
  const xf = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xf) ? xf[0] : xf ?? '';
  return raw.split(',')[0].trim() || 'unknown';
}

/**
 * Supabase api_hits 테이블 기반 레이트리밋.
 * - perMinute: 같은 IP의 분당 허용 횟수
 * - perDay: 엔드포인트 전체의 일일 허용 횟수 (비용 서킷브레이커)
 * 테이블/DB 장애 시에는 서비스 가용성을 위해 통과(fail-open).
 */
export async function checkRateLimit(
  supabase: SupabaseClient | null,
  endpoint: string,
  ip: string,
  perMinute: number,
  perDay: number,
): Promise<{ allowed: boolean; reason?: 'rate' | 'daily' }> {
  if (!supabase) return { allowed: true };
  try {
    await supabase.from('api_hits').insert({ ip, endpoint });
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [minuteRes, dayRes] = await Promise.all([
      supabase.from('api_hits').select('*', { count: 'exact', head: true })
        .eq('endpoint', endpoint).eq('ip', ip).gte('ts', minuteAgo),
      supabase.from('api_hits').select('*', { count: 'exact', head: true })
        .eq('endpoint', endpoint).gte('ts', dayAgo),
    ]);
    if ((minuteRes.count ?? 0) > perMinute) return { allowed: false, reason: 'rate' };
    if ((dayRes.count ?? 0) > perDay) return { allowed: false, reason: 'daily' };
    return { allowed: true };
  } catch (e) {
    console.error('[guard] rate limit check failed (fail-open)', e);
    return { allowed: true };
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isShortStr(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

// recommend 요청 본문 검증 — 실패 시 사용자용 오류 메시지, 통과 시 null
export function validateRecommendBody(body: unknown): string | null {
  const invalid = '요청 형식이 올바르지 않아요. 새로고침 후 다시 시도해주세요.';
  if (!body || typeof body !== 'object') return invalid;
  const b = body as Record<string, unknown>;

  const input = b.input as Record<string, unknown> | undefined;
  if (!input || typeof input !== 'object') return invalid;

  // 출발지는 선택 입력 — 지역 직접 선택 플로우에서는 빈 배열로 온다
  const locations = input.locations;
  if (!Array.isArray(locations) || locations.length > 12) return invalid;
  for (const l of locations) {
    if (!l || typeof l !== 'object') return invalid;
    const name = (l as Record<string, unknown>).name;
    if (typeof name !== 'string' || name.length > 80) return invalid;
  }

  const purpose = input.purpose as Record<string, unknown> | undefined;
  if (!purpose || !isShortStr(purpose.first, 20)) return invalid;
  if (purpose.second != null && !isShortStr(purpose.second, 20)) return invalid;

  const midpoint = b.midpoint as Record<string, unknown> | undefined;
  if (!midpoint || !isFiniteNum(midpoint.lat) || !isFiniteNum(midpoint.lng)) return invalid;
  // 한반도 대략 범위 밖이면 거부
  if (midpoint.lat < 33 || midpoint.lat > 39 || midpoint.lng < 124 || midpoint.lng > 132) return invalid;

  const congestionData = b.congestionData;
  if (!Array.isArray(congestionData) || congestionData.length > 5) return invalid;

  if (input.keywords != null) {
    if (!Array.isArray(input.keywords) || input.keywords.length > 10) return invalid;
    for (const k of input.keywords) if (!isShortStr(k, 30)) return invalid;
  }
  if (input.occasion != null && !isShortStr(input.occasion, 40)) return invalid;
  if (input.relation != null && !isShortStr(input.relation, 20)) return invalid;
  if (input.budget != null && !isShortStr(input.budget, 20)) return invalid;

  return null;
}
