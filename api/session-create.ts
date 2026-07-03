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

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }

  try {
    const body = (req.body ?? {}) as { expected_count?: number; has_second?: boolean };
    const expected = Math.min(6, Math.max(2, Number(body.expected_count) || 2));
    const has_second = body.has_second === true;
    const supabase = createClient(url, key);

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomId();
      const { error } = await supabase
        .from('mint_sessions')
        .insert({ id, expected_count: expected, status: 'waiting', has_second });

      if (!error) return res.status(200).json({ id });
      if (error.code !== '23505') {
        // has_second 컬럼 없으면 fallback
        if (error.code === '42703') {
          const { error: e2 } = await supabase
            .from('mint_sessions')
            .insert({ id, expected_count: expected, status: 'waiting' });
          if (!e2) return res.status(200).json({ id });
        }
        console.error('[session-create] insert failed', error);
        return res.status(500).json({ error: '링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.' });
      }
    }

    return res.status(409).json({ error: '세션 ID 생성에 실패했어요. 다시 시도해주세요.' });
  } catch (e) {
    console.error('[session-create] failed', e);
    return res.status(500).json({ error: '링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
