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
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
}[] = [
  {
    key: 'noise',
    left: { label: '시끌벅적', emoji: '🎵' },
    right: { label: '조용하게', emoji: '🌿' },
  },
  {
    key: 'pace',
    left: { label: '빠르게 한잔', emoji: '⚡' },
    right: { label: '오래 즐기기', emoji: '🌙' },
  },
  {
    key: 'novelty',
    left: { label: '새로운 곳', emoji: '✨' },
    right: { label: '검증된 곳', emoji: '👍' },
  },
];

export default function VibeSelect({ value, onChange }: Props) {
  function select(key: keyof VibeAnswers, val: string) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="px-4 flex flex-col gap-4">
      <p className="text-center text-sm text-gray-500">오늘의 바이브를 골라요</p>
      {QUESTIONS.map((q, qi) => (
        <div key={q.key} className="animate-fade-in-up" style={{ animationDelay: `${qi * 0.1}s` }}>
          <div className="grid grid-cols-2 gap-3">
            {[q.left, q.right].map((opt) => {
              const selected = value[q.key] === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => select(q.key, opt.label)}
                  className={`vibe-card flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border-2 transition-all duration-200 ${
                    selected
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-lg shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span
                    className={`text-sm font-bold text-center leading-tight ${
                      selected ? 'text-[#2AB5A0]' : 'text-gray-700'
                    }`}
                  >
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
