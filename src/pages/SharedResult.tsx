import { useEffect, useState } from 'react';
import type { PlaceRecommendation } from '../services/ai';
import { congestionDotClass } from '../services/seoulData';
import MiniMap from '../components/MiniMap';

export default function SharedResult() {
  const [result, setResult] = useState<PlaceRecommendation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('data');
      if (!data) throw new Error('no data');
      setResult(JSON.parse(decodeURIComponent(data)));
    } catch {
      setError(true);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex flex-col items-center justify-center p-8 text-center">
        <div className="text-4xl mb-4">😔</div>
        <p className="text-gray-600 mb-6">링크가 올바르지 않아요.</p>
        <a href="/" className="px-6 py-3 bg-[#3CDBC0] text-white rounded-2xl font-bold">
          MINT로 직접 정하기
        </a>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pb-10 pt-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#2AB5A0]">MINT</h1>
          <p className="text-sm text-gray-400 mt-1">오늘의 추천 장소</p>
        </div>

        {/* 메인 카드 */}
        <div className="result-gradient rounded-3xl p-5 text-white shadow-xl shadow-[#3CDBC0]/30 mb-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold opacity-80 bg-white/20 px-2.5 py-1 rounded-full">
              {result.category}
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${congestionDotClass(result.congestionLevel as Parameters<typeof congestionDotClass>[0])}`} />
              <span className="text-xs opacity-90">{result.congestionLevel}</span>
            </div>
          </div>

          <h2 className="text-2xl font-black mt-3 mb-1 leading-tight">
            오늘은<br /><span className="text-3xl">{result.placeName}</span>
          </h2>
          <p className="text-sm opacity-90 mb-3">{result.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {result.vibeTags.map((tag) => (
              <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>

          <div className="bg-white/15 rounded-2xl p-3 flex flex-col gap-1.5">
            <div className="flex items-start gap-2 text-sm">
              <span className="opacity-70 shrink-0">📍</span>
              <span className="opacity-90">{result.address || result.area}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-70">💰</span>
              <span className="opacity-90">{result.priceRange}</span>
            </div>
          </div>
        </div>

        {result.lat && result.lng && (
          <div className="mb-4 animate-fade-in-up">
            <MiniMap lat={result.lat} lng={result.lng} placeName={result.placeName} />
          </div>
        )}

        {result.secondPlace && (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 mb-4 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">2차</span>
              <span className="text-sm font-bold text-gray-800">{result.secondPlace.placeName}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{result.secondPlace.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>🚶 도보 {result.secondPlace.walkingMinutes}분</span>
              <span>·</span>
              <span>{result.secondPlace.category}</span>
            </div>
          </div>
        )}

        <a
          href="/"
          className="block w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base text-center shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-colors"
        >
          🌿 나도 MINT로 정하기
        </a>
      </div>
    </div>
  );
}
