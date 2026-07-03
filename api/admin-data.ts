import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

// 어드민 데이터 API — 비밀번호는 서버 env(ADMIN_PASSWORD)에서만 검증.
// 기존에는 클라이언트 하드코딩 비밀번호 + anon 키 직접 select였다(누구나 예약자 명단 열람 가능).
// 이 엔드포인트 + RLS 차단(sql/security.sql)으로 이전.

interface EventRow {
  type: string;
  duration_seconds: number | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았어요. Vercel 대시보드에서 설정해주세요.' });
  }

  const body = (req.body ?? {}) as { password?: string; action?: string; id?: string };
  if (body.password !== adminPassword) {
    return res.status(401).json({ error: '비밀번호가 틀렸어요' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase 설정이 없습니다.' });

  try {
    switch (body.action) {
      case 'delete_reservation': {
        if (!body.id) return res.status(400).json({ error: 'id가 필요해요.' });
        await supabase.from('reservations').delete().eq('id', body.id);
        return res.status(200).json({ ok: true });
      }
      case 'clear_reservations': {
        await supabase.from('reservations').delete().not('id', 'is', null);
        return res.status(200).json({ ok: true });
      }
      case 'clear_events': {
        await supabase.from('events').delete().not('id', 'is', null);
        return res.status(200).json({ ok: true });
      }
      default: {
        // 'load' — 분석 지표 + 예약 목록
        const [eventsRes, reservationsRes] = await Promise.all([
          supabase.from('events').select('type, duration_seconds'),
          supabase.from('reservations').select('*').order('created_at', { ascending: false }),
        ]);

        const events = (eventsRes.data ?? []) as EventRow[];
        const sessions = events.filter((e) => e.type === 'session_duration' && e.duration_seconds != null);
        const analytics = {
          landingViews: events.filter((e) => e.type === 'landing_view').length,
          ctaClicks: events.filter((e) => e.type === 'cta_click').length,
          reservationAttempts: events.filter((e) => e.type === 'reservation_attempt').length,
          kakaoShares: events.filter((e) => e.type === 'kakao_share').length,
          avgStaySeconds: sessions.length > 0
            ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds as number), 0) / sessions.length)
            : null,
        };

        const reservations = (reservationsRes.data ?? []).map((r) => ({
          id: r.id,
          placeName: r.place_name,
          address: r.address,
          guestName: r.guest_name,
          people: r.people,
          arrivalTime: r.arrival_time,
          createdAt: r.created_at,
        }));

        return res.status(200).json({ analytics, reservations });
      }
    }
  } catch (e) {
    console.error('[admin-data] failed', e);
    return res.status(500).json({ error: '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
