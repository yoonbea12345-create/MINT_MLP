import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp, checkRateLimit } from './_lib/guard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }
  const supabase = createClient(url, key);

  // POST { id, result } — 호스트가 그룹 추천 결과 요약을 세션에 저장(게스트 폴링이 수신)
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { id?: string; result?: unknown };
    const sid = String(body.id ?? '');
    if (!/^[a-z0-9]{4,32}$/.test(sid)) return res.status(400).json({ error: '잘못된 요청이에요.' });
    const result = body.result;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return res.status(400).json({ error: '잘못된 요청이에요.' });
    }
    let raw = '';
    try { raw = JSON.stringify(result); } catch { /* noop */ }
    // 24KB — v:2 요약은 3개 장소 × (긴 네이버 썸네일 URL + 해시태그)가 실려 10KB를 넘을 수 있다.
    if (!raw || raw.length > 24_000) return res.status(400).json({ error: '결과 데이터가 너무 커요.' });

    const gate = await checkRateLimit(supabase, 'session-result', clientIp(req), 10, 2000);
    if (!gate.allowed) return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });

    let { error } = await supabase.from('mint_sessions')
      .update({ result_json: result, result_at: new Date().toISOString() })
      .eq('id', sid);
    if (error?.code === '42703') {
      ({ error } = await supabase.from('mint_sessions').update({ result_json: result }).eq('id', sid));
    }
    if (error) {
      if (error.code !== '42703') console.error('[session-get] result save failed', error);
      return res.status(200).json({ ok: false, disabled: true }); // 컬럼 미생성 등 — 조용히 off
    }
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ error: 'session id가 필요해요.' });

  try {

    // has_second 포함 시도, 없으면 fallback
    let { data: session, error: sErr } = await supabase
      .from('mint_sessions')
      .select('expected_count, has_second, result_json')
      .eq('id', id)
      .single();

    if (sErr?.code === '42703') {
      ({ data: session, error: sErr } = await supabase
        .from('mint_sessions')
        .select('expected_count, has_second')
        .eq('id', id)
        .single());
    }
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
    // members는 두 쿼리(컬럼 수 다름) 결과를 모두 받으므로 넓은 타입으로 선언한다.
    const primary = await supabase
      .from('mint_session_members')
      .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget, vibe_keywords, purpose_first, purpose_second')
      .eq('session_id', id)
      .order('submitted_at', { ascending: true });

    let members: Record<string, unknown>[] | null = primary.data;
    let mErr = primary.error;

    if (mErr?.code === '42703') {
      // 일부 컬럼 없을 수 있음, 기본 필드만 조회
      const fallback = await supabase
        .from('mint_session_members')
        .select('member_name, location_name, location_lat, location_lng, vibe_atmosphere, vibe_budget')
        .eq('session_id', id)
        .order('submitted_at', { ascending: true });
      members = fallback.data;
      mErr = fallback.error;
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
      result_json: (session as Record<string, unknown>).result_json ?? null,
      members: parsedMembers,
    });
  } catch (e) {
    console.error('[session-get] failed', e);
    return res.status(500).json({ error: '세션 정보를 불러오지 못했어요.' });
  }
}
