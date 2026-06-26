import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomId(len = 8): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }

  try {
    const body = (req.body ?? {}) as { expected_count?: number };
    const expected = Math.min(6, Math.max(2, Number(body.expected_count) || 2));
    const supabase = createClient(url, key);

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomId();
      const { error } = await supabase
        .from('mint_sessions')
        .insert({ id, expected_count: expected, status: 'waiting' });

      if (!error) return res.status(200).json({ id });
      if (error.code !== '23505') {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(409).json({ error: '세션 ID 생성에 실패했어요. 다시 시도해주세요.' });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
