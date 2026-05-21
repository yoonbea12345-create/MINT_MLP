import { useState } from 'react';

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

const BUDGET_OPTIONS: { value: string | null; label: string; emoji: string }[] = [
  { value: null,      label: '상관없음', emoji: '🤷' },
  { value: '~2만원',  label: '~2만원',  emoji: '💚' },
  { value: '2~4만원', label: '2~4만원', emoji: '💛' },
  { value: '4만원+',  label: '4만원+',  emoji: '💎' },
];

interface Props {
  value: VibeState;
  onChange: (v: VibeState) => void;
  purpose?: { first: string | null; second?: string | null };
  budget: string | null;
  onBudgetChange: (b: string | null) => void;
}

export default function VibeSelect({ value, onChange, purpose, budget, onBudgetChange }: Props) {
  const [wasDoubled, setWasDoubled] = useState<Record<string, boolean>>({});

  function toggle(groupLabel: string, key: string) {
    const g = value[groupLabel] ?? { first: null, second: null };
    let { first, second } = g;
    const nextDoubled = { ...wasDoubled };

    if (first === key && second === key) {
      second = null;
      nextDoubled[groupLabel] = true;
    } else if (wasDoubled[groupLabel] && first === key && second === null) {
      first = null;
      nextDoubled[groupLabel] = false;
    } else if (first === key && second !== null) {
      first = null;
      nextDoubled[groupLabel] = false;
    } else if (second === key) {
      second = null;
      nextDoubled[groupLabel] = false;
    } else if (first === null) {
      first = key;
      nextDoubled[groupLabel] = false;
    } else if (second === null) {
      second = key;
      nextDoubled[groupLabel] = false;
    }

    setWasDoubled(nextDoubled);
    onChange({ ...value, [groupLabel]: { first, second } });
  }

  const hasSecond = purpose?.second && purpose.second !== '없음';

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {GROUPS.map((group, groupIdx) => {
        const g = value[group.label] ?? { first: null, second: null };
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {group.label}
              </p>
              {groupIdx === 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full">
                    🍀 {purpose?.first ? `1차: ${purpose.first}` : '1차'}
                  </span>
                  {hasSecond && (
                    <span className="text-[10px] font-black bg-[#3CDBC0] text-white px-2 py-0.5 rounded-full">
                      🍀 2차: {purpose!.second}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((opt) => {
                const hasFirst = g.first === opt.key;
                const hasSecondFlag = g.second === opt.key;
                const isActive = hasFirst || hasSecondFlag;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggle(group.label, opt.key)}
                    className={`relative pt-6 pb-3.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5 active:scale-[0.97] ${
                      isActive
                        ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-1.5 left-1.5 flex gap-0.5">
                        {hasFirst && (
                          <span className="text-[9px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                            🍀 1차
                          </span>
                        )}
                        {hasSecondFlag && (
                          <span className="text-[9px] font-black bg-[#3CDBC0] text-white px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                            🍀 2차
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

      {/* 예산 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">예산</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {BUDGET_OPTIONS.map((opt) => {
            const selected = budget === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => onBudgetChange(budget === opt.value ? null : opt.value)}
                className={`flex flex-col items-center justify-center h-16 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                  selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#3CDBC0]/50'
                }`}
              >
                <span className="text-base mb-0.5">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
