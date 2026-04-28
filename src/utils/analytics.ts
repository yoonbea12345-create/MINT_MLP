import { supabase } from './supabase';

type EventType = 'landing_view' | 'cta_click' | 'reservation_attempt';

declare global {
  interface Window { dataLayer: Record<string, unknown>[] }
}

function pushDataLayer(event: string) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event });
}

export function trackEvent(type: EventType): void {
  pushDataLayer(type);
  supabase.from('events').insert({ type }).then(() => {});
}

export async function getAnalytics() {
  const { data } = await supabase.from('events').select('type');
  if (!data) return { landingViews: 0, ctaClicks: 0, reservationAttempts: 0 };
  return {
    landingViews: data.filter((e) => e.type === 'landing_view').length,
    ctaClicks: data.filter((e) => e.type === 'cta_click').length,
    reservationAttempts: data.filter((e) => e.type === 'reservation_attempt').length,
  };
}
