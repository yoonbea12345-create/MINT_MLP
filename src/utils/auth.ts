import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getDeviceId } from './points';

// 카카오 기본 로그인 — 로그인은 어디까지나 '선택'이다.
// 비로그인 사용자의 추천·찜·포인트는 localStorage로 그대로 동작하며, 여기의 어떤 함수도 그 흐름을 막지 않는다.
// supabase-js v2는 detectSessionInUrl/persistSession이 기본 true라 OAuth 콜백 파싱·세션 저장은 자동이다.

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithKakao(): Promise<void> {
  // 로그인 후 프로필 탭으로 복귀 (커스텀 라우터는 pathname만 보므로 ?tab=profile은 /app으로 매칭된다)
  await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${window.location.origin}/app?tab=profile` },
  });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// user_metadata 필드명은 provider·시점에 따라 달라서 후보를 순서대로 훑는다.
function pick(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
}

export function getNickname(user: User | null): string | null {
  if (!user) return null;
  return pick(user.user_metadata ?? {}, ['name', 'full_name', 'preferred_username', 'nickname', 'user_name']);
}

export function getAvatarUrl(user: User | null): string | null {
  if (!user) return null;
  return pick(user.user_metadata ?? {}, ['avatar_url', 'picture', 'profile_image_url', 'profile_image']);
}

export async function syncProfile(): Promise<void> {
  try {
    const session = await getSession();
    const user = session?.user;
    if (!user) return;

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const kakaoId =
      pick(meta, ['provider_id', 'sub', 'kakao_id', 'id']) ??
      (user.identities?.[0]?.id ?? null);

    await supabase.from('mint_profiles').upsert(
      {
        id: user.id,
        kakao_id: kakaoId,
        nickname: getNickname(user),
        avatar_url: getAvatarUrl(user),
        device_id: getDeviceId(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {
    /* 프로필 동기화 실패는 무해 — 로그인 자체는 유지된다 */
  }
}

export interface ActivityPayload {
  placeName: string;
  secondPlaceName?: string | null;
  areaName?: string | null;
  purposeFirst?: string | null;
  groupSize?: string | null;
}

// 로그인 사용자만 가벼운 활동 로그를 남긴다. 비로그인이면 즉시 no-op.
// 추천 플로우를 절대 깨면 안 되므로 어떤 실패도 조용히 삼킨다.
export async function logActivityIfSignedIn(payload: ActivityPayload): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user) return;

    await supabase.from('mint_activity_log').insert({
      user_id: session.user.id,
      device_id: getDeviceId(),
      place_name: payload.placeName,
      second_place_name: payload.secondPlaceName ?? null,
      area_name: payload.areaName ?? null,
      purpose_first: payload.purposeFirst ?? null,
      group_size: payload.groupSize ?? null,
    });
  } catch {
    /* 로그 실패는 사용자에게 보이지 않는다 */
  }
}

export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.access_token) return { ok: false, error: '로그인 상태가 아니에요.' };

  try {
    const res = await fetch('/api/account-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: session.access_token }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.' };

    await signOut();
    return { ok: true };
  } catch {
    return { ok: false, error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.' };
  }
}
