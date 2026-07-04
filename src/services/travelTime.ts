// 소요시간 계산 (클라이언트) — 대중교통은 ODsay 실측, 자차는 직선거리 추정.
// ODsay를 브라우저에서 직접 호출하는 이유: Vercel 서버리스는 나가는 IP가 동적이라
// ODsay Server 키(IP 기반)가 불안정하다. URI 키는 도메인에 묶여 브라우저 노출도 안전.

export interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

export interface TravelTimeData {
  first: { transit: TravelResult[]; driving: TravelResult[] };
  second: { transit: TravelResult[]; driving: TravelResult[] } | null;
}

interface Point { lat: number; lng: number }
interface Origin extends Point { label: string }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTransitMin(km: number): number {
  if (km <= 3) return Math.round(7 + km * 3.5);
  if (km <= 10) return Math.round(17.5 + (km - 3) * 2.5);
  if (km <= 25) return Math.round(35 + (km - 10) * 2.0);
  return Math.round(65 + (km - 25) * 1.8);
}

function estimateDrivingMin(km: number): number {
  if (km <= 3) return Math.round(3 + km * 2);
  if (km <= 10) return Math.round(9 + (km - 3) * 1.8);
  if (km <= 25) return Math.round(21.6 + (km - 10) * 1.5);
  return Math.round(44 + (km - 25) * 1.2);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `약 ${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

const ODSAY_KEY: string = import.meta.env.VITE_ODSAY_API_KEY ?? '';

// ODsay 대중교통 경로 총 소요(분). 실패/CORS/에러 시 null → 추정 폴백.
async function odsayTransitMin(origin: Point, dest: Point): Promise<number | null> {
  if (!ODSAY_KEY) return null;
  try {
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${origin.lng}&SY=${origin.lat}&EX=${dest.lng}&EY=${dest.lat}&apiKey=${encodeURIComponent(ODSAY_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { error?: unknown; result?: { path?: { info?: { totalTime?: number } }[] } };
    if (data.error) return null;
    const t = data.result?.path?.[0]?.info?.totalTime;
    return typeof t === 'number' && t > 0 ? t : null;
  } catch {
    return null;
  }
}

async function transitTimes(origins: Origin[], dest: Point): Promise<TravelResult[]> {
  return Promise.all(origins.map(async (o) => {
    const real = await odsayTransitMin(o, dest);
    if (real != null) return { label: o.label, formatted: formatDuration(real), source: 'transit' };
    const km = haversineKm(o.lat, o.lng, dest.lat, dest.lng);
    return { label: o.label, formatted: formatDuration(estimateTransitMin(km)), source: 'estimate' };
  }));
}

function drivingTimes(origins: Origin[], dest: Point): TravelResult[] {
  return origins.map((o) => {
    const km = haversineKm(o.lat, o.lng, dest.lat, dest.lng);
    return { label: o.label, formatted: formatDuration(estimateDrivingMin(km)), source: 'estimate' };
  });
}

export async function computeTravelTimes(
  origins: Origin[],
  destinations: { first: Point; second?: Point },
): Promise<TravelTimeData> {
  const hasSecond = !!(destinations.second?.lat && destinations.second?.lng);
  const [firstTransit, secondTransit] = await Promise.all([
    transitTimes(origins, destinations.first),
    hasSecond ? transitTimes(origins, destinations.second!) : Promise.resolve([] as TravelResult[]),
  ]);
  return {
    first: { transit: firstTransit, driving: drivingTimes(origins, destinations.first) },
    second: hasSecond ? { transit: secondTransit, driving: drivingTimes(origins, destinations.second!) } : null,
  };
}
