const ANALYTICS_KEY = 'mint_analytics';

interface AnalyticsEvent {
  type: 'landing_view' | 'cta_click' | 'reservation_attempt';
  timestamp: string;
}

export function trackEvent(type: AnalyticsEvent['type']): void {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const events: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    events.push({ type, timestamp: new Date().toISOString() });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  } catch {
    // localStorage 실패 시 무시
  }
}

export function getAnalytics() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const events: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    return {
      landingViews: events.filter((e) => e.type === 'landing_view').length,
      ctaClicks: events.filter((e) => e.type === 'cta_click').length,
      reservationAttempts: events.filter((e) => e.type === 'reservation_attempt').length,
    };
  } catch {
    return { landingViews: 0, ctaClicks: 0, reservationAttempts: 0 };
  }
}

export function getConversionRate(): string {
  const { landingViews, ctaClicks } = getAnalytics();
  if (landingViews === 0) return '0.0';
  return ((ctaClicks / landingViews) * 100).toFixed(1);
}
