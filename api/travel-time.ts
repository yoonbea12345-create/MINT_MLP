import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `약 ${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 프론트엔드 midpoint.ts 와 동일한 구간 공식 사용 (일관성)
function estimateTransitMin(km: number): number {
  if (km <= 3)  return Math.round(7   + km * 3.5);
  if (km <= 10) return Math.round(17.5 + (km -  3) * 2.5);
  if (km <= 25) return Math.round(35  + (km - 10) * 2.0);
  return        Math.round(65  + (km - 25) * 1.8);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { origins, destination } = req.body as {
    origins: Origin[];
    destination: { lat: number; lng: number };
  };
  const apiKey = process.env.VITE_KAKAO_REST_API_KEY ?? process.env.KAKAO_REST_API_KEY;

  const results = await Promise.all(
    origins.map(async (origin) => {
      // 1) 카카오 대중교통 API 시도
      if (apiKey) {
        try {
          const url = `https://apis-navi.kakaomobility.com/v1/transit/route?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`;
          const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
          if (resp.ok) {
            const data = await resp.json();
            const duration: number | undefined = data.routes?.[0]?.summary?.duration;
            if (duration) {
              return {
                label: origin.label,
                formatted: formatDuration(Math.round(duration / 60)),
                source: 'transit',
              };
            }
          }
        } catch {}
      }

      // 2) 직선거리 기반 추정 (자동차 API × 환산 제거 — 오차 큼)
      const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
      const m = estimateTransitMin(km);
      return { label: origin.label, formatted: formatDuration(m), source: 'estimate' };
    })
  );

  return res.status(200).json(results);
}
