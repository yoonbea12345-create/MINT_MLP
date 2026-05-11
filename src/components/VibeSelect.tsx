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
  left: string;
  right: string;
}[] = [
  { key: 'noise',   label: '분위기', left: '시끌벅적',   right: '조용하게'   },
  { key: 'pace',    label: '페이스', left: '빠르게 한잔', right: '오래 즐기기' },
  { key: 'novelty', label: '취향',   left: '새로운 곳',   right: '검증된 곳'   },
];

const TOTAL = QUESTIONS.length;

export default function VibeSelect({ value, onChange }: Props) {
  const selectedCount = Object.keys(value).length;

  function select(key: keyof VibeAnswers, val: string) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {/* 안내 + 카운터 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">1개만 선택해도 추천받을 수 있어요</p>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full transition-colors ${
          selectedCount > 0 ? 'text-white bg-[#3CDBC0]' : 'text-gray-400 bg-gray-100'
        }`}>
          {selectedCount}/{TOTAL}
        </span>
      </div>

      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{q.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {[q.left, q.right].map((label) => {
              const selected = value[q.key] === label;
              return (
                <button
                  key={label}
                  onClick={() => select(q.key, label)}
                  className={`vibe-card py-3.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${
                    selected
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
