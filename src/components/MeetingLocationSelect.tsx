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
    <div className="px-4 py-3">
      <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-4 flex flex-col gap-4">

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
                className={`rounded-xl border-2 p-3 text-left active:scale-[0.97] transition-all ${
                  isManualSelected(r.id)
                    ? 'border-[#3CDBC0] bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]'
                }`}
              >
                <div className="text-sm font-black text-gray-800 truncate">{r.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{r.desc}</div>
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
                className={`rounded-xl border-2 p-3 text-left active:scale-[0.97] transition-all ${
                  isManualSelected(r.id)
                    ? 'border-[#3CDBC0] bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]'
                }`}
              >
                <div className="text-sm font-black text-gray-800 truncate">{r.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{r.desc}</div>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
