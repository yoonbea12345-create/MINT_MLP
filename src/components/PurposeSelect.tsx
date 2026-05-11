export interface PurposeValue {
  first: string | null;
  second: string | null;
}

type PurposeOption = '밥' | '술' | '카페';

interface Props {
  value: PurposeValue;
  onChange: (v: PurposeValue) => void;
}

const OPTIONS: { value: PurposeOption; emoji: string }[] = [
  { value: '밥', emoji: '🍽️' },
  { value: '술', emoji: '🍻' },
  { value: '카페', emoji: '☕' },
];

const SECOND_EXTRA = { value: '없음' as const, emoji: '✋' };

export default function PurposeSelect({ value, onChange }: Props) {
  function selectFirst(v: PurposeOption) {
    onChange({ first: v, second: value.second === v ? null : value.second });
  }

  function selectSecond(v: PurposeOption | '없음') {
    onChange({ ...value, second: v });
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-5">
      {/* 1차 목적 */}
      <div>
        <p className="text-xs font-bold text-gray-500 mb-2.5 uppercase tracking-wide">1차 목적</p>
        <div className="grid grid-cols-3 gap-2.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => selectFirst(opt.value)}
              className={`vibe-card flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200 ${
                value.first === opt.value
                  ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                  : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className={`text-sm font-bold ${value.first === opt.value ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                {opt.value}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2차 목적 */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">2차 목적</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">선택사항</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {([...OPTIONS, SECOND_EXTRA] as { value: PurposeOption | '없음'; emoji: string }[]).map((opt) => {
            const isDisabled = opt.value !== '없음' && opt.value === value.first;
            const isSelected = value.second === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !isDisabled && selectSecond(opt.value)}
                disabled={isDisabled}
                className={`vibe-card flex flex-row items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-200 ${
                  isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className={`text-sm font-bold ${isSelected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                  {opt.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
