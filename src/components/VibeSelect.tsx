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

interface Props {
  value: VibeState;
  onChange: (v: VibeState) => void;
  purpose?: { first: string | null; second?: string | null };
}

export default function VibeSelect({ value, onChange, purpose }: Props) {
  // 같은 카드에 1차+2차가 모두 붙었다가 2차 제거된 직후 여부 (그룹별 추적)
  const [wasDoubled, setWasDoubled] = useState<Record<string, boolean>>({});

  function toggle(groupLabel: string, key: string) {
    const g = value[groupLabel] ?? { first: null, second: null };
    let { first, second } = g;
    const nextDoubled = { ...wasDoubled };

    if (first === key && second === key) {
      // 같은 카드에 1차+2차 → 2차 제거, "연속 제거 모드" 진입
      second = null;
      nextDoubled[groupLabel] = true;
    } else if (wasDoubled[groupLabel] && first === key && second === null) {
      // 연속 제거 모드: 2차 제거 직후 다시 클릭 → 1차 제거
      first = null;
      nextDoubled[groupLabel] = false;
    } else if (first === key && second !== null) {
      // 1차가 이 카드, 2차는 다른 카드 → 1차 제거
      first = null;
      nextDoubled[groupLabel] = false;
    } else if (second === key) {
      // 2차가 이 카드 → 2차 제거
      second = null;
      nextDoubled[groupLabel] = false;
    } else if (first === null) {
      // 1차 자리 비어있음 → 1차 배정
      first = key;
      nextDoubled[groupLabel] = false;
    } else if (second === null) {
      // 1차 있음, 2차 자리 비어있음 → 2차 배정 (같은 카드 가능)
      second = key;
      nextDoubled[groupLabel] = false;
    }
    // else: 두 자리 모두 다른 카드 → 무시

    setWasDoubled(nextDoubled);
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
      {GROUPS.map((group, groupIdx) => {
        const g = value[group.label] ?? { first: null, second: null };
        return (
          <div key={group.label}>
            {/* 첫 번째 그룹: 리마인드 + 범례를 라벨 위/오른쪽에 배치 */}
            {groupIdx === 0 && reminderText && (
              <div className="flex justify-end mb-1">
                <span className="text-[11px] text-gray-400 font-medium">{reminderText}</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {group.label}
              </p>
              {groupIdx === 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full">🍀 1차</span>
                  <span className="text-[10px] font-black bg-[#3CDBC0] text-white px-2 py-0.5 rounded-full">🍀 2차</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((opt) => {
                const hasFirst = g.first === opt.key;
                const hasSecond = g.second === opt.key;
                const isActive = hasFirst || hasSecond;
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
                    {/* 클로버 스티커 */}
                    {isActive && (
                      <div className="absolute top-1.5 left-1.5 flex gap-0.5">
                        {hasFirst && (
                          <span className="text-[9px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                            🍀 1차
                          </span>
                        )}
                        {hasSecond && (
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
    </div>
  );
}
