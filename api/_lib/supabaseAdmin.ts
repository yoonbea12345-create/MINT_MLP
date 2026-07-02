import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

// service role 키 없으면 null 반환 — 호출부는 캐시/로깅 스킵으로 폴백
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  cached = url && key ? createClient(url, key) : null;
  return cached;
}
