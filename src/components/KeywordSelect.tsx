interface Props {
  selected: string[];
  onChange: (keys: string[]) => void;
}

const KEYWORD_GROUPS = [
  {
    label: '공간',
    items: [
      { key: '룸있는', emoji: '🚪' },
      { key: '단체석', emoji: '👥' },
      { key: '야외테라스', emoji: '🌿' },
      { key: '넓은공간', emoji: '📐' },
    ],
  },
  {
    label: '편의',
    items: [
      { key: '주차가능', emoji: '🅿️' },
      { key: '웨이팅없는', emoji: '⚡' },
      { key: '예약가능', emoji: '📋' },
    ],
  },
  {
    label: '감성',
    items: [
      { key: '2030감성', emoji: '✨' },
      { key: '인스타감성', emoji: '📸' },
      { key: '힙한', emoji: '🔥' },
      { key: '레트로감성', emoji: '🎞️' },
    ],
  },
  {
    label: '기타',
    items: [
      { key: '새벽까지영업', emoji: '🌙' },
      { key: '브런치', emoji: '🥐' },
      { key: '반려동물가능', emoji: '🐾' },
      { key: '뷰맛집', emoji: '🏙️' },
    ],
  },
];

export default function KeywordSelect({ selected, onChange }: Props) {
  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">키워드</p>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
      </div>
      <div className="flex flex-col gap-2">
        {KEYWORD_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-wrap gap-1.5">
            {group.items.map((item) => {
              const active = selected.includes(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => toggle(item.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 border ${
                    active
                      ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-sm shadow-[#3CDBC0]/30'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span>{item.emoji}</span>
                  <span>#{item.key}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
