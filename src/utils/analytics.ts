// Supabase 마이그레이션 필요:
//   ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_seconds integer;
// (Supabase 대시보드 > SQL Editor에서 실행)

import { supabase } from './supabase';

type EventType = 'landing_view' | 'cta_click' | 'reservation_attempt' | 'session_duration' | 'kakao_share' | 'kakao_share_fallback' | 'pwa_install_click' | 'landing_demo_place_click'
  | 'retry_fresh' | 'retry_adjust' | 'reject_expensive' | 'reject_far' | 'reject_vibe'
  | 'reserve_deeplink_catchtable' | 'reserve_deeplink_naver';

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

export function trackEvent(type: Exclude<EventType, 'session_duration'>): void {
  if (isTrackingPaused()) return;
  pushDataLayer(type);
  supabase.from('events').insert({ type }).then(() => {});
}

export function trackSessionDuration(seconds: number): void {
  if (isTrackingPaused()) return;
  supabase.from('events').insert({ type: 'session_duration', duration_seconds: seconds }).then(() => {});
}

// 분석 지표 조회는 /api/admin-data(서버)로 이전 — anon select 제거
