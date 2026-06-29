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

    const { data: session, error: sErr } = await supabase
      .from('mint_sessions')
      .select('expected_count')
      .eq('id', id)
      .single();

    if (sErr || !session) {
      return res.status(404).json({ error: '세션을 찾을 수 없어요.' });
    }

    // Try with keywords; fallback without if column doesn't exist (pg error 42703)
    let { data: members, error: mErr } = await supabase
      .from('mint_session_members')
      .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget, vibe_keywords')
      .eq('session_id', id)
      .order('submitted_at', { ascending: true });

    if (mErr?.code === '42703') {
      ({ data: members, error: mErr } = await supabase
        .from('mint_session_members')
        .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget')
        .eq('session_id', id)
        .order('submitted_at', { ascending: true }));
    }

    if (mErr) return res.status(500).json({ error: mErr.message });

    // Parse vibe_keywords from JSON string back to array
    const parsedMembers = (members ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      vibe_keywords: m.vibe_keywords
        ? (() => { try { return JSON.parse(m.vibe_keywords as string); } catch { return []; } })()
        : [],
    }));

    return res.status(200).json({
      expected_count: session.expected_count,
      members: parsedMembers,
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
