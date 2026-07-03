import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
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
      purpose_first?: string | null;
      purpose_second?: string | null;
      vibe_atmosphere?: string | null;
      vibe_budget?: string | null;
      vibe_keywords?: string[] | null;
    };

    const { session_id, member_name, location_name } = body;
    const location_lat = Number(body.location_lat);
    const location_lng = Number(body.location_lng);

    if (!session_id || !member_name || !location_name || Number.isNaN(location_lat) || Number.isNaN(location_lng)) {
      return res.status(400).json({ error: '필수 항목이 누락되었어요.' });
    }
    if (member_name.length > 20 || location_name.length > 80 ||
        location_lat < 33 || location_lat > 39 || location_lng < 124 || location_lng > 132) {
      return res.status(400).json({ error: '입력값이 올바르지 않아요.' });
    }

    const supabase = createClient(url, key);

    // 세션 존재 + 정원 검증 (기존엔 클라이언트 sessionStorage만 믿어서 무한 제출이 가능했다)
    const { data: session, error: sessionErr } = await supabase
      .from('mint_sessions')
      .select('expected_count')
      .eq('id', session_id)
      .maybeSingle();
    if (sessionErr) {
      console.error('[session-join] session lookup failed', sessionErr);
      return res.status(500).json({ error: '세션 확인 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.' });
    }
    if (!session) return res.status(404).json({ error: '존재하지 않는 세션이에요. 링크를 다시 확인해주세요.' });

    const { count: memberCount } = await supabase
      .from('mint_session_members')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id);
    if ((memberCount ?? 0) >= (session.expected_count ?? 6)) {
      return res.status(409).json({ error: '이미 모든 인원이 입력을 마친 세션이에요.' });
    }

    const baseData = {
      session_id,
      member_name,
      location_name,
      location_lat,
      location_lng,
      vibe_atmosphere: body.vibe_atmosphere ?? null,
      vibe_budget: body.vibe_budget ?? null,
    };

    const keywords = Array.isArray(body.vibe_keywords) && body.vibe_keywords.length > 0
      ? body.vibe_keywords
      : null;

    const fullData = {
      ...baseData,
      purpose_first: body.purpose_first ?? null,
      purpose_second: body.purpose_second ?? null,
      ...(keywords ? { vibe_keywords: JSON.stringify(keywords) } : {}),
    };

    const { error } = await supabase.from('mint_session_members').insert(fullData);

    if (error) {
      // 컬럼 없으면 기본 데이터로 fallback
      if (error.code === '42703') {
        const { error: e2 } = await supabase.from('mint_session_members').insert(baseData);
        if (e2) {
          console.error('[session-join] fallback insert failed', e2);
          return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
        }
        return res.status(200).json({ ok: true });
      }
      console.error('[session-join] insert failed', error);
      return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[session-join] failed', e);
    return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
