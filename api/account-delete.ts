import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

// 회원 탈퇴 — auth.users 삭제만 하면 mint_profiles/mint_activity_log는 FK on delete cascade로 함께 지워진다.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = (req.body ?? {}) as { access_token?: string };
  const accessToken = (body.access_token ?? '').trim();
  if (!accessToken) {
    return res.status(400).json({ error: '로그인 정보가 없어요. 다시 로그인해주세요.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  try {
    // 토큰으로 본인 확인 — 남의 계정을 지울 수 없게 하는 유일한 방어선
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      return res.status(401).json({ error: '로그인이 만료됐어요. 다시 로그인해주세요.' });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error('[account-delete] delete failed', deleteError);
      return res.status(500).json({ error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[account-delete] failed', e);
    return res.status(500).json({ error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
