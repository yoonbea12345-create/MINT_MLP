import { useState, useEffect } from 'react';
import type { Coordinates } from '../services/midpoint';
import type { LocationEntry } from './LocationInput';

interface TravelResult {
  label: string;
  formatted: string;
  durationSeconds?: number;
  error?: boolean;
}

interface Props {
  areaName: string;
  midpoint: Coordinates;
  locations: LocationEntry[];
  onConfirm: () => void;
  onBack: () => void;
}

export default function MidpointConfirm({ areaName, midpoint, locations, onConfirm, onBack }: Props) {
  const [travelTimes, setTravelTimes] = useState<TravelResult[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    if (validLocs.length === 0) { setFetching(false); return; }

    fetch('/api/travel-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origins: validLocs.map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name })),
        destination: midpoint,
      }),
    })
      .then((r) => r.json())
      .then((data: TravelResult[]) => { setTravelTimes(data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-8 pb-10">

        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← 이전</button>
          <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
          <div className="w-12" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-gray-800">이 지점은 어때요?</h2>
          <p className="text-sm text-gray-400 mt-1">모두의 출발지에서 계산했어요</p>
        </div>

        {/* 중간지점 카드 */}
        <div className="bg-white rounded-2xl border-2 border-[#3CDBC0] p-5 mb-4 shadow-sm">
          <div className="text-xs text-[#3CDBC0] font-bold mb-2">중간 지점</div>
          <div className="text-2xl font-black text-gray-800">📍 {areaName}</div>
          <div className="text-sm text-gray-400 mt-1">이 지역 인근 장소를 추천해드려요</div>
        </div>

        {/* 소요시간 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black text-gray-600">출발지별 소요시간</span>
            <span className="text-xs text-gray-400">자동차 기준</span>
          </div>

          {fetching ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
              <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
              계산 중...
            </div>
          ) : travelTimes.length === 0 ? (
            <p className="text-sm text-gray-400">출발지 좌표 정보가 없어요</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {travelTimes.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate max-w-[55%]">{t.label}</span>
                  <span className={`text-sm font-black ${t.error ? 'text-gray-400' : 'text-[#3CDBC0]'}`}>
                    {t.formatted}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-4 bg-[#3CDBC0] text-white font-black text-base rounded-2xl shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-all active:scale-95"
        >
          이 지점으로 추천받기 ✨
        </button>
      </div>
    </div>
  );
}
