export interface PurposeValue {
  first: string | null;
  second: string | null;
}

type PurposeOption = '밥' | '술' | '카페';

interface Props {
  value: PurposeValue;
  onChange: (v: PurposeValue) => void;
}

const OPTIONS: { value: PurposeOption; emoji: string; desc: string }[] = [
  { value: '밥', emoji: '🍽️', desc: '맛있는 거 먹자' },
  { value: '술', emoji: '🍻', desc: '한 잔 하자' },
  { value: '카페', emoji: '☕', desc: '커피나 차 한 잔' },
];

const SECOND_EXTRA = { value: '없음' as const, emoji: '✋', desc: '1차만 할게요' };

export default function PurposeSelect({ value, onChange }: Props) {
  function selectFirst(v: PurposeOption) {
    onChange({
      first: v,
      second: value.second === v ? null : value.second,
    });
  }

  function selectSecond(v: PurposeOption | '없음') {
    onChange({ ...value, second: v });
  }

  return (
    <div className="px-4 flex flex-col gap-6">
      {/* 1차 목적 */}
      <div>
        <p className="text-sm font-bold text-gray-600 mb-3">1차 목적</p>
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => selectFirst(opt.value)}
              className={`vibe-card flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all duration-200 ${
                value.first === opt.value
                  ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                  : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
              }`}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <span className={`text-base font-bold ${value.first === opt.value ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                {opt.value}
              </span>
              <span className="text-xs text-gray-400">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2차 목적 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-bold text-gray-600">2차 목적</p>
          <span className="text-xs text-gray-400">(선택사항)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([...OPTIONS, SECOND_EXTRA] as { value: PurposeOption | '없음'; emoji: string; desc: string }[]).map((opt) => {
            const isDisabled = opt.value !== '없음' && opt.value === value.first;
            const isSelected = value.second === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !isDisabled && selectSecond(opt.value)}
                disabled={isDisabled}
                className={`vibe-card flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200 ${
                  isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className={`text-sm font-bold ${isSelected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                  {opt.value}
                </span>
                <span className="text-xs text-gray-400">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
