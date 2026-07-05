import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { clientIp, checkRateLimit } from './_lib/guard.js';

// 공유 결과 페이지 멤버 투표.
// GET  ?id=<shareId>            → { counts: { [choice]: number } } (테이블 미생성/오류 시 { disabled: true })
// POST { shareId, voterId, choice, placeName } → { ok: true } (같은 voter 재투표는 upsert로 교체)
const ID_RE = /^[a-z0-9_-]{6,40}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(200).json({ disabled: true });

  if (req.method === 'GET') {
    const id = String(req.query.id ?? '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: '잘못된 요청이에요.' });
    const { data, error } = await supabase
      .from('mint_share_votes')
      .select('choice')
      .eq('share_id', id)
      .limit(500);
    // 테이블 미생성 등 — 투표 기능만 조용히 끈다 (공유 페이지 본문은 정상 동작)
    if (error) return res.status(200).json({ disabled: true });
    const counts: Record<number, number> = {};
    for (const row of data ?? []) counts[row.choice] = (counts[row.choice] ?? 0) + 1;
    return res.status(200).json({ counts });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { shareId?: string; voterId?: string; choice?: number; placeName?: string };
    const shareId = String(body.shareId ?? '');
    const voterId = String(body.voterId ?? '');
    const choice = Number(body.choice);
    if (!ID_RE.test(shareId) || !ID_RE.test(voterId) || !Number.isInteger(choice) || choice < 0 || choice > 5) {
      return res.status(400).json({ error: '잘못된 요청이에요.' });
    }

    const gate = await checkRateLimit(supabase, 'share-vote', clientIp(req), 20, 5000);
    if (!gate.allowed) return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });

    const { error } = await supabase
      .from('mint_share_votes')
      .upsert(
        {
          share_id: shareId,
          voter_id: voterId,
          choice,
          place_name: typeof body.placeName === 'string' ? body.placeName.slice(0, 80) : null,
        },
        { onConflict: 'share_id,voter_id' },
      );
    if (error) {
      console.error('[share-vote] upsert failed', error);
      return res.status(200).json({ ok: false, disabled: true });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
