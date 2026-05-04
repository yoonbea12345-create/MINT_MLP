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
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTransitMinutes(km: number): number {
  // 직선거리 × 1.3 도로계수 / 30km/h(대중교통 평균속도) + 환승·대기 7분
  return Math.round(km * 1.3 / 30 * 60 + 7);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { origins, destination } = req.body as { origins: Origin[]; destination: { lat: number; lng: number } };
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
              return { label: origin.label, formatted: formatDuration(Math.round(duration / 60)), source: 'transit' };
            }
          }
        } catch {}
      }

      // 2) 카카오 자동차 API 시도
      if (apiKey) {
        try {
          const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&priority=RECOMMEND`;
          const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
          if (resp.ok) {
            const data = await resp.json();
            const duration: number | undefined = data.routes?.[0]?.summary?.duration;
            if (duration) {
              const m = Math.round(duration / 60 * 1.25); // 차량 시간 × 1.25 = 대중교통 추정
              return { label: origin.label, formatted: formatDuration(m), source: 'estimate' };
            }
          }
        } catch {}
      }

      // 3) 직선거리 기반 추정 (최후 폴백)
      const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
      const m = estimateTransitMinutes(km);
      return { label: origin.label, formatted: formatDuration(m), source: 'estimate' };
    })
  );

  return res.status(200).json(results);
}
