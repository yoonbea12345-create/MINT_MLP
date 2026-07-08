import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { clientIp, checkRateLimit } from './_lib/guard.js';

function validPaths(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((p) =>
    typeof p === 'string' &&
    p.length <= 300 &&
    !p.includes('..') &&
    /^[a-z0-9/_\-.]+$/i.test(p)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  const gate = await checkRateLimit(supabase, 'pilot-feedback', clientIp(req), 10, 1000);
  if (!gate.allowed) return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });

  const body = (req.body ?? {}) as {
    id?: string;
    recommendationImagePaths?: unknown;
    paymentImagePaths?: unknown;
    fitRating?: number;
    fitText?: string;
    extraText?: string;
    contact?: string | null;
  };

  const id = (body.id ?? '').trim();
  const fitRating = Number(body.fitRating);
  const fitText = (body.fitText ?? '').trim();
  const extraText = (body.extraText ?? '').trim();
  const contact = typeof body.contact === 'string' ? body.contact.trim() : null;

  if (!/^pf[a-z0-9]{14}$/i.test(id) ||
      !validPaths(body.recommendationImagePaths) ||
      !validPaths(body.paymentImagePaths) ||
      !Number.isInteger(fitRating) || fitRating < 1 || fitRating > 5 ||
      fitText.length < 1 || fitText.length > 2000 ||
      extraText.length < 1 || extraText.length > 2000 ||
      (contact != null && contact.length > 100)) {
    return res.status(400).json({ error: '필수 항목을 확인해주세요.' });
  }

  try {
    const { error } = await supabase.from('pilot_feedback').insert({
      id,
      recommendation_image_paths: body.recommendationImagePaths,
      payment_image_paths: body.paymentImagePaths,
      fit_rating: fitRating,
      fit_text: fitText,
      extra_text: extraText,
      contact,
    });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[pilot-feedback] insert failed', e);
    return res.status(500).json({ error: '제출을 저장하지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
