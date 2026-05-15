import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

interface Destination {
  lat: number;
  lng: number;
}

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
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

function estimateTransitMin(km: number): number {
  if (km <= 3)  return Math.round(7   + km * 3.5);
  if (km <= 10) return Math.round(17.5 + (km -  3) * 2.5);
  if (km <= 25) return Math.round(35  + (km - 10) * 2.0);
  return        Math.round(65  + (km - 25) * 1.8);
}

function estimateDrivingMin(km: number): number {
  if (km <= 3)  return Math.round(3 + km * 2);
  if (km <= 10) return Math.round(9 + (km - 3) * 1.8);
  if (km <= 25) return Math.round(21.6 + (km - 10) * 1.5);
  return        Math.round(44 + (km - 25) * 1.2);
}

async function calcTimes(
  origins: Origin[],
  dest: Destination,
  mode: 'transit' | 'driving',
  apiKey: string | undefined,
): Promise<TravelResult[]> {
  return Promise.all(
    origins.map(async (origin) => {
      if (apiKey) {
        try {
          let url: string;
          if (mode === 'transit') {
            url = `https://apis-navi.kakaomobility.com/v1/transit/route?origin=${origin.lng},${origin.lat}&destination=${dest.lng},${dest.lat}`;
          } else {
            url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${dest.lng},${dest.lat}&priority=RECOMMEND`;
          }
          const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
          if (resp.ok) {
            const data = await resp.json();
            const duration: number | undefined =
              mode === 'transit'
                ? data.routes?.[0]?.summary?.duration
                : data.routes?.[0]?.summary?.duration;
            if (duration) {
              return { label: origin.label, formatted: formatDuration(Math.round(duration / 60)), source: mode };
            }
          }
        } catch {}
      }
      const km = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
      const m = mode === 'transit' ? estimateTransitMin(km) : estimateDrivingMin(km);
      return { label: origin.label, formatted: formatDuration(m), source: 'estimate' };
    })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { origins, destinations } = req.body as {
    origins: Origin[];
    destinations: { first: Destination; second?: Destination };
  };

  const apiKey = process.env.VITE_KAKAO_REST_API_KEY ?? process.env.KAKAO_REST_API_KEY;
  const hasSecond = !!(destinations.second?.lat && destinations.second?.lng);

  // 모든 조합 병렬 계산: 1차transit, 1차driving, 2차transit(있으면), 2차driving(있으면)
  const [firstTransit, firstDriving, secondTransit, secondDriving] = await Promise.all([
    calcTimes(origins, destinations.first, 'transit', apiKey),
    calcTimes(origins, destinations.first, 'driving', apiKey),
    hasSecond ? calcTimes(origins, destinations.second!, 'transit', apiKey) : Promise.resolve([]),
    hasSecond ? calcTimes(origins, destinations.second!, 'driving', apiKey) : Promise.resolve([]),
  ]);

  return res.status(200).json({
    first: { transit: firstTransit, driving: firstDriving },
    second: hasSecond ? { transit: secondTransit, driving: secondDriving } : null,
  });
}
