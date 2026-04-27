type Purpose = '밥' | '술' | '카페' | '밥+술';

interface Props {
  value: Purpose | null;
  onChange: (v: Purpose) => void;
}

const OPTIONS: { value: Purpose; emoji: string; desc: string }[] = [
  { value: '밥', emoji: '🍽️', desc: '맛있는 거 먹자' },
  { value: '술', emoji: '🍻', desc: '한 잔 하자' },
  { value: '카페', emoji: '☕', desc: '커피나 차 한 잔' },
  { value: '밥+술', emoji: '🍛', desc: '먹고 마시자' },
];

export default function PurposeSelect({ value, onChange }: Props) {
  return (
    <div className="px-4">
      <p className="text-center text-sm text-gray-500 mb-4">오늘의 목적은?</p>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`vibe-card flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all duration-200 ${
              value === opt.value
                ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
            }`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className={`text-lg font-bold ${value === opt.value ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
              {opt.value}
            </span>
            <span className="text-xs text-gray-400">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
