export interface VibeAnswers {
  noise: '시끌벅적' | '조용하게';
  pace: '빠르게 한잔' | '오래 즐기기';
  novelty: '새로운 곳' | '검증된 곳';
}

interface Props {
  value: Partial<VibeAnswers>;
  onChange: (v: Partial<VibeAnswers>) => void;
}

const QUESTIONS: {
  key: keyof VibeAnswers;
  label: string;
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
}[] = [
  {
    key: 'noise',
    label: '분위기',
    left: { label: '시끌벅적', emoji: '🎵' },
    right: { label: '조용하게', emoji: '🌿' },
  },
  {
    key: 'pace',
    label: '페이스',
    left: { label: '빠르게 한잔', emoji: '⚡' },
    right: { label: '오래 즐기기', emoji: '🌙' },
  },
  {
    key: 'novelty',
    label: '취향',
    left: { label: '새로운 곳', emoji: '✨' },
    right: { label: '검증된 곳', emoji: '👍' },
  },
];

export default function VibeSelect({ value, onChange }: Props) {
  const selectedCount = Object.keys(value).length;

  function select(key: keyof VibeAnswers, val: string) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">많이 선택할수록 추천이 정확해져요 🎯</p>
        {selectedCount > 0 && (
          <span className="text-xs font-bold text-white bg-[#3CDBC0] px-2.5 py-0.5 rounded-full">
            {selectedCount}개 선택됨
          </span>
        )}
      </div>

      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{q.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {[q.left, q.right].map((opt) => {
              const selected = value[q.key] === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => select(q.key, opt.label)}
                  className={`vibe-card flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                    selected
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{opt.emoji}</span>
                  <span className={`text-sm font-bold leading-tight ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
