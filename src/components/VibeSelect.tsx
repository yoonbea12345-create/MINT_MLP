export type VibeState = Record<string, 'none' | 'first' | 'second'>;

export const VIBE_KEY_TO_LABEL: Record<string, string> = {
  noise_loud:   '시끌벅적',
  noise_quiet:  '조용하게',
  pace_fast:    '빠르게 한잔',
  pace_slow:    '오래 즐기기',
  novelty_new:  '새로운 곳',
  novelty_known:'검증된 곳',
};

const GROUPS = [
  {
    label: '분위기',
    options: [
      { key: 'noise_loud',    label: '시끌벅적',  emoji: '🎵' },
      { key: 'noise_quiet',   label: '조용하게',  emoji: '🌿' },
    ],
  },
  {
    label: '페이스',
    options: [
      { key: 'pace_fast',  label: '빠르게 한잔', emoji: '⚡' },
      { key: 'pace_slow',  label: '오래 즐기기', emoji: '🌙' },
    ],
  },
  {
    label: '취향',
    options: [
      { key: 'novelty_new',   label: '새로운 곳', emoji: '✨' },
      { key: 'novelty_known', label: '검증된 곳', emoji: '👍' },
    ],
  },
];

interface Props {
  value: VibeState;
  onChange: (v: VibeState) => void;
  purpose?: { first: string | null; second?: string | null };
}

export default function VibeSelect({ value, onChange, purpose }: Props) {
  function toggle(key: string) {
    const cur = value[key] ?? 'none';
    const next = cur === 'none' ? 'first' : cur === 'first' ? 'second' : 'none';
    if (next === 'none') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = value;
      onChange(rest as VibeState);
    } else {
      onChange({ ...value, [key]: next });
    }
  }

  const totalSelected = Object.values(value).filter(v => v !== 'none').length;
  const TOTAL = GROUPS.reduce((a, g) => a + g.options.length, 0);

  let reminderText = '';
  if (purpose?.first) {
    reminderText = (purpose.second && purpose.second !== '없음')
      ? `1차: ${purpose.first}  ·  2차: ${purpose.second}`
      : `목적: ${purpose.first}`;
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {/* 이전 선택 리마인드 */}
      {reminderText && (
        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-1.5">
            <span className="text-xs text-gray-500 font-medium">{reminderText}</span>
          </div>
        </div>
      )}

      {/* 안내 + 카운터 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">많이 고를수록 추천이 정확해져요 😊</p>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full transition-colors ${
          totalSelected > 0 ? 'text-white bg-[#3CDBC0]' : 'text-gray-400 bg-gray-100'
        }`}>
          {totalSelected}/{TOTAL}
        </span>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {group.options.map((opt) => {
              const state = value[opt.key] ?? 'none';
              return (
                <button
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  className={`relative py-3.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5 active:scale-[0.97] ${
                    state === 'first'
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                      : state === 'second'
                      ? 'border-[#F5A623] bg-[#FFF8E8] text-[#C87D10]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  {state === 'first' && (
                    <span className="absolute top-1.5 right-1.5 text-[10px] font-black bg-[#3CDBC0] text-white px-1.5 py-0.5 rounded-full leading-none">
                      1차
                    </span>
                  )}
                  {state === 'second' && (
                    <span className="absolute top-1.5 right-1.5 text-[10px] font-black bg-[#F5A623] text-white px-1.5 py-0.5 rounded-full leading-none">
                      2차
                    </span>
                  )}
                  <span className="text-lg leading-none">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 범례 */}
      <div className="flex items-center gap-5 justify-center mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black bg-[#3CDBC0] text-white px-1.5 py-0.5 rounded-full">1차</span>
          <span className="text-xs text-gray-400">꼭 반영</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black bg-[#F5A623] text-white px-1.5 py-0.5 rounded-full">2차</span>
          <span className="text-xs text-gray-400">있으면 좋음</span>
        </div>
      </div>
    </div>
  );
}
