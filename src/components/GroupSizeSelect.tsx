type GroupSize = '2명' | '3~4명' | '5명 이상';

interface Props {
  value: GroupSize | null;
  onChange: (v: GroupSize) => void;
}

const OPTIONS: { value: GroupSize; emoji: string; desc: string }[] = [
  { value: '2명', emoji: '👫', desc: '둘이서' },
  { value: '3~4명', emoji: '👥', desc: '소규모' },
  { value: '5명 이상', emoji: '🎉', desc: '단체로' },
];

export default function GroupSizeSelect({ value, onChange }: Props) {
  return (
    <div className="px-4 h-full flex flex-col justify-center">
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`vibe-card flex flex-col items-center gap-2.5 py-7 rounded-2xl border-2 transition-all duration-200 ${
              value === opt.value
                ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
            }`}
          >
            <span className="text-4xl">{opt.emoji}</span>
            <span className={`text-base font-bold ${value === opt.value ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
              {opt.value}
            </span>
            <span className="text-xs text-gray-400">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
