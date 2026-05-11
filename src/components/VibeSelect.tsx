export type GroupVibeState = { first: string | null; second: string | null };
export type VibeState = Record<string, GroupVibeState>;

export const VIBE_KEY_TO_LABEL: Record<string, string> = {
  noise_loud:    '시끌벅적',
  noise_quiet:   '조용하게',
  pace_fast:     '빠르게 한잔',
  pace_slow:     '오래 즐기기',
  novelty_new:   '새로운 곳',
  novelty_known: '검증된 곳',
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
  function toggle(groupLabel: string, key: string) {
    const g = value[groupLabel] ?? { first: null, second: null };
    let { first, second } = g;

    if (first === key && second === key) {
      // 같은 카드에 1차+2차 → 2차 먼저 제거
      second = null;
    } else if (first === key) {
      // 이 카드가 1차만 → 1차 제거
      first = null;
    } else if (second === key) {
      // 이 카드가 2차만 → 2차 제거
      second = null;
    } else if (first === null) {
      // 1차 자리 비어있음 → 1차 배정
      first = key;
    } else if (second === null) {
      // 1차는 다른 카드, 2차 자리 비어있음 → 2차 배정
      second = key;
    }
    // 두 자리 모두 다른 카드에 있으면 무시

    onChange({ ...value, [groupLabel]: { first, second } });
  }

  let reminderText = '';
  if (purpose?.first) {
    reminderText = (purpose.second && purpose.second !== '없음')
      ? `1차: ${purpose.first}  ·  2차: ${purpose.second}`
      : `목적: ${purpose.first}`;
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {reminderText && (
        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-1.5">
            <span className="text-xs text-gray-500 font-medium">{reminderText}</span>
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-3 justify-center">
        <span className="text-xs font-bold bg-[#3CDBC0] text-white px-3 py-1 rounded-full">1차</span>
        <span className="text-xs font-bold bg-[#F5A623] text-white px-3 py-1 rounded-full">2차</span>
      </div>

      <p className="text-center text-[11px] text-gray-400">
        최소 1개 이상 선택 · 많이 고를수록 추천이 정확해져요
      </p>

      {GROUPS.map((group) => {
        const g = value[group.label] ?? { first: null, second: null };
        return (
          <div key={group.label}>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((opt) => {
                const hasFirst = g.first === opt.key;
                const hasSecond = g.second === opt.key;
                const isActive = hasFirst || hasSecond;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggle(group.label, opt.key)}
                    className={`relative pt-5 pb-3.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5 active:scale-[0.97] ${
                      isActive
                        ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-1.5 left-1.5 flex gap-1">
                        {hasFirst && (
                          <span className="text-[10px] font-black bg-[#3CDBC0] text-white px-1.5 py-0.5 rounded-full leading-none">
                            1차
                          </span>
                        )}
                        {hasSecond && (
                          <span className="text-[10px] font-black bg-[#F5A623] text-white px-1.5 py-0.5 rounded-full leading-none">
                            2차
                          </span>
                        )}
                      </div>
                    )}
                    <span className="text-lg leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
