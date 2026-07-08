import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

function publicUrl(path: string): string {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${url}/storage/v1/object/public/pilot-feedback/${encodeURI(path)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았어요.' });
  }

  const body = (req.body ?? {}) as { password?: string };
  if (body.password !== adminPassword) return res.status(401).json({ error: '비밀번호가 틀렸어요' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  try {
    const { data, error } = await supabase
      .from('pilot_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const feedback = (data ?? []).map((r) => {
      const recPaths = Array.isArray(r.recommendation_image_paths) ? r.recommendation_image_paths : [];
      const payPaths = Array.isArray(r.payment_image_paths) ? r.payment_image_paths : [];
      return {
        id: r.id,
        createdAt: r.created_at,
        fitRating: r.fit_rating,
        fitText: r.fit_text,
        extraText: r.extra_text,
        contact: r.contact,
        recommendationImageUrls: recPaths.map(publicUrl),
        paymentImageUrls: payPaths.map(publicUrl),
      };
    });

    return res.status(200).json({ feedback });
  } catch (e) {
    console.error('[pilot-admin-feedback] failed', e);
    return res.status(500).json({ error: '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
