import { useState } from 'react';
import { PRESET_REGIONS } from '../services/midpoint';
import type { PresetRegion } from '../services/midpoint';

interface Props {
  onAutoSelect: () => void;
  onRegionSelect: (region: PresetRegion) => void;
  onBack: () => void;
}

export default function RegionSelect({ onAutoSelect, onRegionSelect, onBack }: Props) {
  const [showGrid, setShowGrid] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-8 pb-10">

        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">
            ← 이전
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
          </div>
          <div className="w-12" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-black text-gray-800">어느 지역에서 만날까요?</h2>
          <p className="text-sm text-gray-400 mt-1">추천 방식을 선택해주세요</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* 옵션 1: 자동 중간지점 */}
          <button
            onClick={onAutoSelect}
            className="w-full text-left bg-white border-2 border-[#3CDBC0] rounded-2xl p-5 shadow-sm hover:bg-[#E8F8F5] transition-all active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">🧭</div>
              <div>
                <div className="font-black text-gray-800 text-base">자동 중간지점 찾기</div>
                <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                  모두의 출발지 기준으로<br />
                  최적의 중간 지점을 계산해드려요
                </div>
                <div className="mt-2 inline-block text-xs font-bold text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">
                  추천
                </div>
              </div>
            </div>
          </button>

          {/* 옵션 2: 지역 직접 선택 */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowGrid((v) => !v)}
              className="w-full text-left p-5 hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">📍</div>
                <div className="flex-1">
                  <div className="font-black text-gray-800 text-base">지역 직접 선택</div>
                  <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                    특정 지역을 원한다면<br />
                    직접 골라보세요
                  </div>
                </div>
                <div className={`text-gray-400 text-lg transition-transform ${showGrid ? 'rotate-180' : ''}`}>
                  ↓
                </div>
              </div>
            </button>

            {showGrid && (
              <div className="px-4 pb-4 grid grid-cols-3 gap-2 animate-fade-in-up">
                {PRESET_REGIONS.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => onRegionSelect(region)}
                    className="flex flex-col items-center text-center bg-[#F5FBF8] hover:bg-[#E8F8F5] border-2 border-transparent hover:border-[#3CDBC0] rounded-xl px-2 py-3 transition-all active:scale-95"
                  >
                    <span className="font-black text-gray-800 text-xs leading-tight">{region.label}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{region.sublabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
