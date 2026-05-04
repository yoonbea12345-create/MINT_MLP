import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import type { PresetRegion } from '../services/midpoint';

interface Props {
  onAutoSelect: () => void;
  onRegionSelect: (region: PresetRegion) => void;
  onBack: () => void;
}

export default function RegionSelect({ onAutoSelect, onRegionSelect, onBack }: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSuggestions([]);
    if (timer.current) clearTimeout(timer.current);
    if (value.length < 1) return;
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(value);
        setSuggestions(results.slice(0, 5));
      } catch {}
      setSearching(false);
    }, 200);
  }

  function handleSelect(place: KakaoPlace) {
    setSuggestions([]);
    setQuery(place.place_name);
    onRegionSelect({
      id: place.id,
      label: place.place_name,
      sublabel: place.address_name,
      midpoint: { lat: parseFloat(place.y), lng: parseFloat(place.x) },
    });
  }

  const rect = wrapperRef.current?.getBoundingClientRect();

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-8 pb-10">

        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">
            ← 이전
          </button>
          <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
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

          {/* 옵션 2: 지역 직접 검색 */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-sm overflow-visible">
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="w-full text-left p-5 hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">📍</div>
                <div className="flex-1">
                  <div className="font-black text-gray-800 text-base">지역 직접 검색</div>
                  <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                    강남, 대전, 홍대 등<br />
                    원하는 지역을 검색해보세요
                  </div>
                </div>
                <div className={`text-gray-400 text-lg transition-transform ${showSearch ? 'rotate-180' : ''}`}>
                  ↓
                </div>
              </div>
            </button>

            {showSearch && (
              <div className="px-4 pb-4 animate-fade-in-up">
                <div ref={wrapperRef} className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="지역명 검색 (예: 대전, 홍대, 수원역...)"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3CDBC0] text-sm outline-none transition-all bg-[#F5FBF8]"
                  />
                  {searching && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
                    </div>
                  )}
                </div>

                {suggestions.length > 0 && rect && createPortal(
                  <div
                    style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                  >
                    {suggestions.map((place) => (
                      <button
                        key={place.id}
                        onMouseDown={() => handleSelect(place)}
                        className="w-full text-left px-4 py-3 hover:bg-[#E8F8F5] transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="text-sm font-medium text-gray-800">{place.place_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{place.road_address_name || place.address_name}</div>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
