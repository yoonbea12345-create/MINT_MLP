import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

// 어드민 데이터 API — 비밀번호는 서버 env(ADMIN_PASSWORD)에서만 검증.
// 기존에는 클라이언트 하드코딩 비밀번호 + anon 키 직접 select였다(누구나 예약자 명단 열람 가능).
// 이 엔드포인트 + RLS 차단(sql/security.sql)으로 이전.
//
// 기획점검(fable5) 반영: analytics.ts EventType 15종을 전부 집계해 어드민에 노출한다.
// (이전에는 5종만 집계 — reject/retry/deeplink 등 알고리즘 개선 신호가 버려졌음)

interface EventRow {
  type: string;
  duration_seconds: number | null;
  created_at: string;
}

const STAY_CAP_SECONDS = 1800; // 탭 방치 아웃라이어가 평균을 왜곡하지 않도록 상한 캡

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ISO 문자열이면 반환, 아니면 null (신뢰할 수 없는 입력 방어)
function toIso(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았어요. Vercel 대시보드에서 설정해주세요.' });
  }

  const body = (req.body ?? {}) as { password?: string; action?: string; id?: string; from?: string; to?: string };
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
        // 'load' — 분석 지표 + 예약 목록. from/to(ISO)로 기간 필터 가능.
        const from = toIso(body.from);
        const to = toIso(body.to);

        let eventsQuery = supabase.from('events').select('type, duration_seconds, created_at');
        let reservationsQuery = supabase.from('reservations').select('*').order('created_at', { ascending: false });
        if (from) { eventsQuery = eventsQuery.gte('created_at', from); reservationsQuery = reservationsQuery.gte('created_at', from); }
        if (to) { eventsQuery = eventsQuery.lte('created_at', to); reservationsQuery = reservationsQuery.lte('created_at', to); }

        const [eventsRes, reservationsRes] = await Promise.all([eventsQuery, reservationsQuery]);

        const events = (eventsRes.data ?? []) as EventRow[];

        // 타입별 카운트 맵 (단일 순회) — 데이터가 쌓여도 순회 1회로 처리
        const counts: Record<string, number> = {};
        const stays: number[] = [];
        for (const e of events) {
          counts[e.type] = (counts[e.type] ?? 0) + 1;
          if (e.type === 'session_duration' && e.duration_seconds != null) {
            stays.push(Math.min(e.duration_seconds, STAY_CAP_SECONDS));
          }
        }
        const c = (t: string) => counts[t] ?? 0;

        const reservations = (reservationsRes.data ?? []).map((r) => ({
          id: r.id,
          placeName: r.place_name,
          address: r.address,
          guestName: r.guest_name,
          people: r.people,
          arrivalTime: r.arrival_time,
          createdAt: r.created_at,
        }));

        const analytics = {
          // 퍼널 핵심
          landingViews: c('landing_view'),
          ctaClicks: c('cta_click'),
          sessions: c('session_duration'),          // 앱 진입 프록시(세션 종료 기록 수)
          reservationAttempts: c('reservation_attempt'),
          reservationCompleted: reservations.length, // reservations 테이블 실건수(이벤트와 소스 다름)
          // 추천 퍼널 — 노출(분모)·성공률·실패
          recommendRequests: c('recommend_request'),
          recommendShown: c('recommend_shown'),
          recommendErrors: c('recommend_error'),
          // 선택 신호(ground truth) — 어떤 순위를 클릭했나
          placeClickRank1: c('place_click_rank1'),
          placeClickSecond: c('place_click_second'),
          placeClickCandidate: c('place_click_candidate'),
          placeClickThird: c('place_click_third'),
          // 결과 화면 상호작용
          candidatesExpand: c('candidates_expand'),
          certBadgeOpen: c('cert_badge_open'),
          // 입력 단계 이탈 퍼널
          stepNext0: c('step_next_0'),
          stepNext1: c('step_next_1'),
          stepNext2: c('step_next_2'),
          // 지역 검색 실패
          locationSearchZero: c('location_search_zero'),
          locationSearchError: c('location_search_error'),
          // PWA 설치 결과 & 그룹
          pwaInstallAccepted: c('pwa_install_accepted'),
          pwaInstallDismissed: c('pwa_install_dismissed'),
          groupSessionCreate: c('group_session_create'),
          // 예약 딥링크(실제 예약 채널)
          deeplinkCatchtable: c('reserve_deeplink_catchtable'),
          deeplinkNaver: c('reserve_deeplink_naver'),
          deeplinkKakaomap: c('reserve_deeplink_kakaomap'),
          // 거절 사유 — 추천 알고리즘 개선의 핵심 신호
          rejectExpensive: c('reject_expensive'),
          rejectFar: c('reject_far'),
          rejectVibe: c('reject_vibe'),
          // 재시도
          retryFresh: c('retry_fresh'),
          retryAdjust: c('retry_adjust'),
          // 공유 & 기타
          kakaoShares: c('kakao_share'),
          kakaoShareFallbacks: c('kakao_share_fallback'),
          pwaInstallClicks: c('pwa_install_click'),
          demoPlaceClicks: c('landing_demo_place_click'),
          // 체류시간 (아웃라이어 캡 후 평균·중앙값)
          avgStaySeconds: stays.length > 0
            ? Math.round(stays.reduce((sum, s) => sum + s, 0) / stays.length)
            : null,
          medianStaySeconds: median(stays),
        };

        return res.status(200).json({ analytics, reservations });
      }
    }
  } catch (e) {
    console.error('[admin-data] failed', e);
    return res.status(500).json({ error: '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
