import { useState } from 'react';

export type MeetingLocation =
  | { type: 'auto' }
  | { type: 'manual'; regionId: string; area: string };

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

export default function MeetingLocationSelect({ value, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [showMore, setShowMore] = useState(false);

  function handleSearch() {
    const trimmed = search.trim();
    if (trimmed) onSelect({ type: 'manual', regionId: '', area: trimmed });
  }

  function isManualSelected(regionId: string) {
    return value?.type === 'manual' && (value as { type: 'manual'; regionId: string }).regionId === regionId;
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {/* 자동 중간지점 카드 */}
      <button
        onClick={() => onSelect({ type: 'auto' })}
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
            <div className="text-xs text-gray-400 mt-0.5">만날 지역을 직접 입력</div>
          </div>
        </div>

        {/* 검색창 — 메인 */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="예: 홍대, 강남역, 성수동..."
            className="w-full bg-white border-2 border-[#3CDBC0] rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CDBC0]/20 transition-colors"
          />
          {search.trim() && (
            <button
              onClick={handleSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#3CDBC0] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              →
            </button>
          )}
        </div>

        {/* 핫 지역 */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            🔥 지금 핫한 지역
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HOT_REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect({ type: 'manual', regionId: r.id, area: r.label })}
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
                onClick={() => onSelect({ type: 'manual', regionId: r.id, area: r.label })}
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
