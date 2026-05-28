// Supabase 마이그레이션 필요:
//   ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_seconds integer;
// (Supabase 대시보드 > SQL Editor에서 실행)

import { supabase } from './supabase';

type EventType = 'landing_view' | 'cta_click' | 'reservation_attempt' | 'session_duration' | 'kakao_share';

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

export async function getAnalytics() {
  const { data } = await supabase.from('events').select('type, duration_seconds');
  if (!data) return { landingViews: 0, ctaClicks: 0, reservationAttempts: 0, kakaoShares: 0, avgStaySeconds: null as number | null };
  const sessions = data.filter((e) => e.type === 'session_duration' && e.duration_seconds != null);
  const avgStaySeconds: number | null = sessions.length > 0
    ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.duration_seconds as number), 0) / sessions.length)
    : null;
  return {
    landingViews: data.filter((e) => e.type === 'landing_view').length,
    ctaClicks: data.filter((e) => e.type === 'cta_click').length,
    reservationAttempts: data.filter((e) => e.type === 'reservation_attempt').length,
    kakaoShares: data.filter((e) => e.type === 'kakao_share').length,
    avgStaySeconds,
  };
}
