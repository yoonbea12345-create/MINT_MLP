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

    // 출발지 없는(임의 지역) 멤버 삽입 헬퍼 — location 컬럼이 아직 NOT NULL이면(마이그레이션 전)
    // 좌표 자리에 서울 중심을 넣어 삽입만 성공시킨다. 임의 지역 모드에선 이 좌표를 추천에 쓰지 않는다.
    async function insertWithFallback(data: Record<string, unknown>) {
      const { error } = await supabase.from('mint_session_members').insert(data);
      if (!error) return null;
      // NOT NULL 위반 → 좌표 자리에 서울 중심 채워 재시도
      if (error.code === '23502' && data.location_lat == null) {
        return insertWithFallback({ ...data, location_lat: 37.5665, location_lng: 126.978 });
      }
      return error;
    }

    let error = await insertWithFallback(fullData);

    // 아직 없는 컬럼(purpose/vibe_keywords) 때문이면 기본 데이터로 재시도
    if (error && error.code === '42703') {
      error = await insertWithFallback(baseData);
    }

    if (error) {
      console.error('[session-join] insert failed', error);
      return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[session-join] failed', e);
    return res.status(500).json({ error: '제출에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
