import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ error: 'session id가 필요해요.' });

  try {
    const supabase = createClient(url, key);

    // has_second 포함 시도, 없으면 fallback
    let { data: session, error: sErr } = await supabase
      .from('mint_sessions')
      .select('expected_count, has_second')
      .eq('id', id)
      .single();

    if (sErr?.code === '42703') {
      ({ data: session, error: sErr } = await supabase
        .from('mint_sessions')
        .select('expected_count')
        .eq('id', id)
        .single());
    }

    if (sErr || !session) {
      return res.status(404).json({ error: '세션을 찾을 수 없어요.' });
    }

    // 멤버 조회 (purpose + keywords 포함 시도, 없으면 fallback)
    let { data: members, error: mErr } = await supabase
      .from('mint_session_members')
      .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget, vibe_keywords, purpose_first, purpose_second')
      .eq('session_id', id)
      .order('submitted_at', { ascending: true });

    if (mErr?.code === '42703') {
      // 일부 컬럼 없을 수 있음, 기본 필드만 조회
      ({ data: members, error: mErr } = await supabase
        .from('mint_session_members')
        .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget')
        .eq('session_id', id)
        .order('submitted_at', { ascending: true }));
    }

    if (mErr) {
      console.error('[session-get] members fetch failed', mErr);
      return res.status(500).json({ error: '세션 정보를 불러오지 못했어요.' });
    }

    const parsedMembers = (members ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      vibe_keywords: m.vibe_keywords
        ? (() => { try { return JSON.parse(m.vibe_keywords as string); } catch { return []; } })()
        : [],
    }));

    return res.status(200).json({
      expected_count: session.expected_count,
      has_second: (session as Record<string, unknown>).has_second ?? false,
      members: parsedMembers,
    });
  } catch (e) {
    console.error('[session-get] failed', e);
    return res.status(500).json({ error: '세션 정보를 불러오지 못했어요.' });
  }
}
