import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(req.query as Record<string, string | string[]>).map(([k, v]) => [
        k,
        Array.isArray(v) ? v[0] : v,
      ])
    )
  );

  const kakaoRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.VITE_KAKAO_REST_API_KEY}`,
      },
    }
  );

  const data = await kakaoRes.json();
  res.status(kakaoRes.status).json(data);
}
