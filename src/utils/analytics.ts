// Supabase 마이그레이션 필요(SQL Editor에서 실행):
//   ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_seconds integer;
//   ALTER TABLE events ADD COLUMN IF NOT EXISTS session_key TEXT;   -- 탐색 에피소드 조인 키
//   ALTER TABLE events ADD COLUMN IF NOT EXISTS payload JSONB;      -- 이벤트 맥락(place_key/priceRange/query 등)
// ⚠️ 아직 실행 안 됐어도 안전: 새 컬럼 insert가 실패하면 자동으로 {type}만 재삽입(폴백)해 수집이 끊기지 않는다.

import { supabase } from './supabase';

type EventType = 'landing_view' | 'cta_click' | 'reservation_attempt' | 'session_duration' | 'kakao_share' | 'kakao_share_fallback' | 'pwa_install_click' | 'landing_demo_place_click'
  | 'retry_fresh' | 'retry_adjust' | 'reject_expensive' | 'reject_far' | 'reject_vibe'
  | 'reserve_deeplink_catchtable' | 'reserve_deeplink_naver' | 'reserve_deeplink_kakaomap'
  // 추천 퍼널 — 노출(분모)·실패율. 추천 요청/노출/에러
  | 'recommend_request' | 'recommend_shown' | 'recommend_error'
  // 선택 신호(ground truth) — 노출된 후보 중 실제로 어떤 순위를 클릭했나
  | 'place_click_rank1' | 'place_click_second' | 'place_click_candidate' | 'place_click_third'
  // 결과 화면 품질 상호작용
  | 'candidates_expand' | 'cert_badge_open'
  // PWA 설치 결과(클릭≠설치)
  | 'pwa_install_accepted' | 'pwa_install_dismissed'
  // 입력 단계 이탈 퍼널 (step N → N+1 진행) & 지역검색 실패
  | 'step_next_0' | 'step_next_1' | 'step_next_2'
  | 'location_search_zero' | 'location_search_error'
  // 그룹 링크 생성(바이럴 루프 분해)
  | 'group_session_create'
  // A. 방문 인증 + 포인트 — 추천→실제 방문 전환율 씨앗
  | 'visit_cert_open' | 'visit_cert_done' | 'visit_cert_fail' | 'points_store_teaser_click'
  // B. 총무 플랜 가짜 문 — 가격 검증(frame별 전환율)
  | 'plan_entry_click' | 'plan_detail_view' | 'plan_preregister' | 'plan_detail_close'
  // C. 참석 확정(가요/못가요)
  | 'rsvp_submit'
  // D. 찜(발굴) 기록 — 1호 발굴자 소급 씨앗
  | 'wishlist_add' | 'wishlist_remove' | 'wishlist_open'
  // E. 탭 셸 — 어떤 탭이 실제로 쓰이나 + 민트샵 쿠폰 수요(가짜 문)
  | 'tab_click' | 'shop_coupon_click';

const PAUSE_KEY = 'mint_tracking_paused';

export function isTrackingPaused(): boolean {
  try { return localStorage.getItem(PAUSE_KEY) === 'true'; } catch { return false; }
}

export function setTrackingPaused(paused: boolean): void {
  try { localStorage.setItem(PAUSE_KEY, paused ? 'true' : 'false'); } catch {}
}

declare global {
  interface Window { dataLayer: Record<string, unknown>[] }
}

function pushDataLayer(event: string) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event });
}

// ── 세션키: 한 탐색 에피소드(초기 추천→재시도→거절→선택)를 묶는 익명 키 ──
// Home이 추천 시작 시 발급/설정하고, 이후 발생하는 모든 이벤트에 자동으로 태깅된다.
let currentSessionKey: string | null = null;

export function newSessionKey(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* 폴백으로 진행 */ }
  return `sk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function setSessionKey(key: string | null): void {
  currentSessionKey = key;
}

type EventPayload = Record<string, unknown>;

export function trackEvent(type: Exclude<EventType, 'session_duration'>, payload?: EventPayload): void {
  if (isTrackingPaused()) return;
  pushDataLayer(type);
  const row: Record<string, unknown> = { type };
  if (currentSessionKey) row.session_key = currentSessionKey;
  if (payload && Object.keys(payload).length > 0) row.payload = payload;
  supabase.from('events').insert(row).then(({ error }) => {
    // 마이그레이션 전(session_key/payload 컬럼 부재 등)이면 최소 필드로 폴백 — 수집 자체는 절대 끊기지 않게
    if (error) supabase.from('events').insert({ type }).then(() => {});
  });
}

export function trackSessionDuration(seconds: number): void {
  if (isTrackingPaused()) return;
  const row: Record<string, unknown> = { type: 'session_duration', duration_seconds: seconds };
  if (currentSessionKey) row.session_key = currentSessionKey;
  supabase.from('events').insert(row).then(({ error }) => {
    if (error) supabase.from('events').insert({ type: 'session_duration', duration_seconds: seconds }).then(() => {});
  });
}

// 분석 지표 조회는 /api/admin-data(서버)로 이전 — anon select 제거
