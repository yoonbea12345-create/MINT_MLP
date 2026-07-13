import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import type { LocationEntry } from './LocationInput';

interface Props {
  value: LocationEntry | null;
  onChange: (loc: LocationEntry | null) => void;
}

// 그룹 auto(중간지점) 모드에서 호스트 본인의 출발지 1곳을 받는 단일 입력.
// 게스트 출발지들과 함께 중간지점 계산에 포함되어, 호스트가 빠진 채 중심이 계산되던 문제를 없앤다.
export default function HostLocationInput({ value, onChange }: Props) {
  const [text, setText] = useState(value?.name ?? '');
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const selected = value != null && value.lat != null;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setText(v);
    if (selected) onChange(null); // 재입력 시 기존 선택 해제
    setSuggestions([]);
    if (timer.current) clearTimeout(timer.current);
    if (v.length < 1) return;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(v);
        setSuggestions(results.slice(0, 5));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 200);
  }

  function pick(place: KakaoPlace) {
    setText(place.place_name);
    setSuggestions([]);
    setLoading(false);
    onChange({ name: place.place_name, lat: parseFloat(place.y), lng: parseFloat(place.x) });
  }

  const rect = wrapperRef.current?.getBoundingClientRect();

  return (
    <div className="px-4 py-3">
      <div ref={wrapperRef} className="relative flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#E8F8F5] border border-[#3CDBC0]/50 text-[#3CDBC0] text-xs font-black flex items-center justify-center flex-shrink-0">
          나
        </span>
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="내 출발지 (예: 서면역, 해운대...)"
            className={`w-full pl-4 pr-9 py-3.5 rounded-xl border-2 text-sm outline-none transition-all duration-200 bg-white ${
              selected ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200 focus:border-[#3CDBC0]'
            }`}
          />
          {loading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
            </div>
          )}
          {selected && !loading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <span className="text-[#3CDBC0] text-sm font-bold">✓</span>
            </div>
          )}
        </div>
      </div>
      {suggestions.length > 0 && rect && createPortal(
        <div
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((place) => (
            <button
              key={place.id}
              onMouseDown={() => pick(place)}
              className="w-full text-left px-4 py-3 hover:bg-[#E8F8F5] transition-colors border-b border-gray-100 last:border-0"
            >
              <div className="text-sm font-medium text-gray-800">{place.place_name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{place.road_address_name || place.address_name}</div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
