import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchNeighborhoods, geocodeArea } from '../services/kakaoMap';
import type { Neighborhood } from '../services/kakaoMap';

export type MeetingLocation =
  | { type: 'auto' }
  // 직접 입력 지역은 실제 좌표(lat/lng)를 함께 담아야 추천이 그 지역으로 검색된다.
  // 프리셋 지역(regionId 있음)은 좌표가 서비스(PRESET_REGIONS)에 있어 생략 가능.
  | { type: 'manual'; regionId: string; area: string; lat?: number; lng?: number };

interface Props {
  value: MeetingLocation | null;
  onSelect: (loc: MeetingLocation) => void;
}

const HOT_REGIONS = [
  { id: 'seongsu',    label: '성수/건대', desc: '성수역·건대입구·뚝섬' },
  { id: 'hongdae',    label: '홍대/마포', desc: '홍대입구·합정·망원'   },
  { id: 'myeongdong', label: '명동/시청', desc: '명동·을지로·중구'      },
];

const MORE_REGIONS = [
  { id: 'gangnam',  label: '강남/서초',   desc: '강남역·서초역·교대'   },
  { id: 'itaewon',  label: '이태원/한남', desc: '이태원역·한남동'       },
  { id: 'jongno',   label: '종로/혜화',   desc: '종각역·인사동·광화문' },
  { id: 'yeouido',  label: '여의도',      desc: '여의도역·IFC몰'        },
  { id: 'sinchon',  label: '신촌/연대',   desc: '신촌역·이대역·연세대' },
  { id: 'jamsil',   label: '잠실/송파',   desc: '잠실역·롯데월드'       },
];

// 동네(시/구/동) 자동완성 드롭다운 (body 포털 + fixed 위치)
function SuggestionDropdown({
  suggestions,
  anchorEl,
  onPick,
}: {
  suggestions: Neighborhood[];
  anchorEl: HTMLDivElement | null;
  onPick: (nb: Neighborhood) => void;
}) {
  if (!suggestions.length || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  return createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
    >
      {suggestions.map((nb) => (
        <button
          key={nb.area}
          onMouseDown={() => onPick(nb)}
          className="w-full text-left px-4 py-3 hover:bg-[#E8F8F5] transition-colors border-b border-gray-100 last:border-0 flex items-center gap-2"
        >
          <span className="text-sm">📍</span>
          <span className="text-sm font-medium text-gray-800">{nb.area}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function MeetingLocationSelect({ value, onSelect }: Props) {
  const [search, setSearch] = useState(
    value?.type === 'manual' && value.regionId === '' ? value.area : ''
  );
  const [suggestions, setSuggestions] = useState<Neighborhood[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 직접 입력 검색으로 좌표가 확정된 상태인지
  const customSelected =
    value?.type === 'manual' && value.regionId === '' && value.lat != null && value.lng != null;

  function handleSearchChange(v: string) {
    setSearch(v);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 1) return;
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchNeighborhoods(v.trim());
        setSuggestions(results);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 200);
  }

  // 동네(시/구/동) 선택 → 동 대표 좌표로 스냅해 확정 (스냅 실패 시 제안 좌표 사용)
  async function pickPlace(nb: Neighborhood) {
    setSearch(nb.area);
    setSuggestions([]);
    setSearching(true);
    const c = await geocodeArea(nb.area);
    setSearching(false);
    onSelect({ type: 'manual', regionId: '', area: nb.area, lat: c?.lat ?? nb.lat, lng: c?.lng ?? nb.lng });
  }

  function isManualSelected(regionId: string) {
    return value?.type === 'manual' && (value as { type: 'manual'; regionId: string }).regionId === regionId;
  }

  function selectPreset(id: string, label: string) {
    setSearch('');
    setSuggestions([]);
    onSelect({ type: 'manual', regionId: id, area: label });
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {/* 자동 중간지점 카드 */}
      <button
        onClick={() => { setSearch(''); setSuggestions([]); onSelect({ type: 'auto' }); }}
        className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-[#3CDBC0]/25 ${
          value?.type === 'auto'
            ? 'bg-[#3CDBC0] border-4 border-[#2AB58C]'
            : 'bg-[#3CDBC0]'
        }`}
      >
        <div className="text-2xl">🧭</div>
        <div className="flex-1">
          <div className="font-black text-white text-base">자동 중간지점 찾기</div>
          <div className="text-xs text-white/80 mt-0.5">모든 출발지 기준 최적 중간 지점 계산</div>
        </div>
        <div className="text-xs font-bold text-[#3CDBC0] bg-white px-2.5 py-1 rounded-full flex-shrink-0">
          추천
        </div>
      </button>

      <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-4 flex flex-col gap-4">

        {/* 카드 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8F8F5] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3CDBC0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-black text-gray-800 text-base">직접 입력하기</div>
            <div className="text-xs text-gray-400 mt-0.5">만날 지역을 검색해서 선택</div>
          </div>
        </div>

        {/* 검색창 — 자동완성(출발지 검색과 동일) */}
        <div ref={wrapperRef} className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="예: 대흥동, 홍대, 강남, 성수동..."
            className={`w-full pl-4 pr-9 py-3 rounded-xl border-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none transition-colors bg-white ${
              customSelected ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-[#3CDBC0] focus:ring-2 focus:ring-[#3CDBC0]/20'
            }`}
          />
          {searching && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {customSelected && !searching && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <span className="text-[#3CDBC0] text-sm font-bold">✓</span>
            </div>
          )}
          <SuggestionDropdown suggestions={suggestions} anchorEl={wrapperRef.current} onPick={pickPlace} />
        </div>
        {customSelected && (
          <p className="-mt-2 text-xs text-[#2AB5A0] font-medium">📍 {(value as { area: string }).area} 주변으로 추천해요</p>
        )}

        {/* 핫 지역 */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            🔥 지금 핫한 지역
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HOT_REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => selectPreset(r.id, r.label)}
                className={`rounded-xl border-2 px-3 py-2.5 text-center active:scale-[0.97] transition-all ${
                  isManualSelected(r.id)
                    ? 'border-[#3CDBC0] bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]'
                }`}
              >
                <div className="text-sm font-black text-gray-800 truncate">{r.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 더 많은 지역 */}
        {!showMore ? (
          <button
            onClick={() => setShowMore(true)}
            className="text-center text-xs text-[#3CDBC0] font-bold hover:text-[#2AB5A0] transition-colors py-0.5"
          >
            다른 지역 선택하기 →
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2 animate-fade-in-up">
            {MORE_REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => selectPreset(r.id, r.label)}
                className={`rounded-xl border-2 px-3 py-2.5 text-center active:scale-[0.97] transition-all ${
                  isManualSelected(r.id)
                    ? 'border-[#3CDBC0] bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]'
                }`}
              >
                <div className="text-sm font-black text-gray-800 truncate">{r.label}</div>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
