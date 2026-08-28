import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp, checkRateLimit } from './_lib/guard.js';

// ── 그룹 세션 단일 엔드포인트 ────────────────────────────────────────────────
// Vercel Hobby 플랜의 서버리스 함수 상한(12개)에 딱 차서 새 기능을 못 붙이는 상태였다.
// 원래 session-create / session-join / session-get(+result 저장 POST) 3개 함수였던 것을
// 이 파일 하나로 합쳐 여유를 만든다. 각 분기 로직은 원본 그대로 이식했고
// 로그 태그([session-create] 등)와 rate limit 키도 Vercel 로그·api_hits 이력 연속성을 위해 유지한다.
//
// 라우팅은 "경로"가 아니라 "메서드 + 바디 필드"로만 판별한다.
// vercel.json의 rewrite로 옛 경로(/api/session-create 등)가 여기로 들어오기 때문에
// 원경로 헤더에 의존하면 안 된다.

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomId(len = 8): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });
  }
  const supabase = createClient(url, key);

  if (req.method === 'GET') return handleGet(req, res, supabase);

  const body = (req.body ?? {}) as Record<string, unknown>;

  // 1) 신 번들은 action을 명시해 보낸다 — 명시가 추론을 이겨야 로그만 보고 디버깅이 된다.
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'create') return handleCreate(req, res, supabase);
  if (action === 'join') return handleJoin(req, res, supabase);
  if (action === 'result') return handleResult(req, res, supabase);

  // 2) action이 없으면 필드로 추론한다 — rewrite를 타고 들어온 옛 번들 호환용 폴백이다.
  //    세 바디의 판별 키는 실측상 상호 배타적이다.
  //    result 판별에 id를 쓰지 않는 이유: id는 너무 흔해 오판 위험이 크다.
  if (body.session_id !== undefined) return handleJoin(req, res, supabase);
  if (body.result !== undefined) return handleResult(req, res, supabase);
  if (body.expected_count !== undefined) return handleCreate(req, res, supabase);

  // 옛 create는 빈 바디도 기본값 2로 만들어줬지만, 여기선 400이다.
  // 실제 클라는 항상 expected_count를 보내므로 회귀가 없고,
  // 빈 바디를 create로 기본 라우팅하면 의도치 않은 세션 대량 생성 통로가 열린다.
  return res.status(400).json({ error: '잘못된 요청이에요.' });
}

// ── create: 그룹 세션 생성 (구 api/session-create.ts) ────────────────────────
async function handleCreate(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient) {
  try {
    const body = (req.body ?? {}) as { expected_count?: number; has_second?: boolean };
    const expected = Math.min(6, Math.max(2, Number(body.expected_count) || 2));
    const has_second = body.has_second === true;

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

// ── join: 게스트 참여 제출 (구 api/session-join.ts) ──────────────────────────
async function handleJoin(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient) {
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

    const { session_id, member_name } = body;
    // 출발지는 '중간지점 자동' 모드에서만 필요 — 임의 지역 모드 게스트는 미입력이므로 선택적으로 처리
    const location_name = body.location_name ?? '';
    const hasCoords = body.location_lat != null && body.location_lng != null
      && !Number.isNaN(Number(body.location_lat)) && !Number.isNaN(Number(body.location_lng));
    const location_lat = hasCoords ? Number(body.location_lat) : null;
    const location_lng = hasCoords ? Number(body.location_lng) : null;

    if (!session_id || !member_name) {
      return res.status(400).json({ error: '필수 항목이 누락되었어요.' });
    }
    if (member_name.length > 20 || location_name.length > 80) {
      return res.status(400).json({ error: '입력값이 올바르지 않아요.' });
    }
    if (hasCoords && (location_lat! < 33 || location_lat! > 39 || location_lng! < 124 || location_lng! > 132)) {
      return res.status(400).json({ error: '출발지 좌표가 올바르지 않아요.' });
    }

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

    // 출발지 없는(임의 지역) 멤버 삽입 헬퍼 — location 컬럼이 아직 NOT NULL이면(마이그레이션 전)
    // 좌표 자리에 서울 중심을 넣어 삽입만 성공시킨다. 임의 지역 모드에선 이 좌표를 추천에 쓰지 않는다.
    async function insertWithFallback(data: Record<string, unknown>) {
      const { data: inserted, error } = await supabase
        .from('mint_session_members')
        .insert(data)
        .select('id')
        .single();
      if (!error) return { error: null, insertedId: (inserted as { id?: number } | null)?.id ?? null };
      // NOT NULL 위반 → 좌표 자리에 서울 중심 채워 재시도
      if (error.code === '23502' && data.location_lat == null) {
        return insertWithFallback({ ...data, location_lat: 37.5665, location_lng: 126.978 });
      }
      return { error, insertedId: null };
    }

    let insertResult = await insertWithFallback(fullData);

    // 아직 없는 컬럼(purpose/vibe_keywords) 때문이면 기본 데이터로 재시도
    if (insertResult.error && insertResult.error.code === '42703') {
      insertResult = await insertWithFallback(baseData);
    }

    if (insertResult.error) {
      console.error('[session-join] insert failed', insertResult.error);
      return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    const { count: afterCount } = await supabase
      .from('mint_session_members')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id);
    if ((afterCount ?? 0) > (session.expected_count ?? 6)) {
      if (insertResult.insertedId != null) {
        await supabase.from('mint_session_members').delete().eq('id', insertResult.insertedId);
      }
      return res.status(409).json({ error: '방금 모든 인원이 입력을 마친 세션이에요.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[session-join] failed', e);
    return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}

// ── result: 호스트가 그룹 추천 결과 요약을 세션에 저장(게스트 폴링이 수신) ──
// 구 api/session-get.ts의 POST 분기 — 별도 함수가 아니었다.
async function handleResult(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient) {
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

// ── get: 세션 조회(호스트·게스트 폴링) (구 api/session-get.ts의 GET 분기) ────
async function handleGet(req: VercelRequest, res: VercelResponse, supabase: SupabaseClient) {
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
