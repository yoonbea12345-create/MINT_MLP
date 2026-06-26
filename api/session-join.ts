import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }

  try {
    const body = (req.body ?? {}) as {
      session_id?: string;
      member_name?: string;
      location_name?: string;
      location_lat?: number;
      location_lng?: number;
      vibe_atmosphere?: string | null;
      vibe_budget?: string | null;
    };

    const { session_id, member_name, location_name } = body;
    const location_lat = Number(body.location_lat);
    const location_lng = Number(body.location_lng);

    if (!session_id || !member_name || !location_name || Number.isNaN(location_lat) || Number.isNaN(location_lng)) {
      return res.status(400).json({ error: '필수 항목이 누락되었어요.' });
    }

    const supabase = createClient(url, key);
    const { error } = await supabase.from('mint_session_members').insert({
      session_id,
      member_name,
      location_name,
      location_lat,
      location_lng,
      vibe_atmosphere: body.vibe_atmosphere ?? null,
      vibe_budget: body.vibe_budget ?? null,
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
