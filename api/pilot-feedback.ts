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

function publicUrl(path: string): string {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${url}/storage/v1/object/public/pilot-feedback/${encodeURI(path)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  const rawBody = (req.body ?? {}) as Record<string, unknown>;

  if (rawBody.action === 'admin-list') {
    const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim();
    if (!adminPassword) {
      return res.status(500).json({ error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았어요.' });
    }
    if (rawBody.password !== adminPassword) return res.status(401).json({ error: '비밀번호가 틀렸어요' });

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

      // 정성 요약 — 평균 적합도 + 1~5점 분포(알고리즘 품질 정량 지표)
      const ratings = feedback.map((f) => Number(f.fitRating)).filter((n) => Number.isFinite(n));
      const distribution = [1, 2, 3, 4, 5].map((score) => ratings.filter((n) => n === score).length);
      const avgFitRating = ratings.length > 0
        ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
        : null;

      return res.status(200).json({ feedback, summary: { count: feedback.length, avgFitRating, distribution } });
    } catch (e) {
      console.error('[pilot-feedback] admin list failed', e);
      return res.status(500).json({ error: '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' });
    }
  }

  const gate = await checkRateLimit(supabase, 'pilot-feedback', clientIp(req), 10, 1000);
  if (!gate.allowed) return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });

  const body = rawBody as {
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
