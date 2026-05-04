// 환경변수: VITE_KAKAO_REST_API_KEY (이미 설정된 키 사용)
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return '1분 미만';
  if (m < 60) return `약 ${m}분`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}시간 ${min}분` : `${h}시간`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { origins, destination } = req.body as { origins: Origin[]; destination: { lat: number; lng: number } };
  const apiKey = process.env.VITE_KAKAO_REST_API_KEY ?? process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    return res.status(200).json(
      origins.map((o) => ({ label: o.label, formatted: '키 미설정', error: true }))
    );
  }

  const results = await Promise.all(
    origins.map(async (origin) => {
      try {
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&priority=RECOMMEND`;
        const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
        if (!resp.ok) throw new Error('api error');
        const data = await resp.json();
        const duration: number | undefined = data.routes?.[0]?.summary?.duration;
        if (!duration) throw new Error('no duration');
        return { label: origin.label, formatted: formatDuration(duration), durationSeconds: duration };
      } catch {
        return { label: origin.label, formatted: '계산 불가', error: true };
      }
    })
  );

  return res.status(200).json(results);
}
