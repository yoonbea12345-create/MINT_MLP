import { useState } from 'react';

export type GroupVibeState = { first: string | null; second: string | null };
export type VibeState = Record<string, GroupVibeState>;

export const VIBE_KEY_TO_LABEL: Record<string, string> = {
  atm_loud:     '시끌벅적',
  atm_quiet:    '조용하게',
  atm_cozy:     '아늑한',
  atm_trendy:   '트렌디한',
  atm_mood:     '감성적인',
  atm_hip:      '힙한',
  pref_new:     '새로운 곳',
  pref_known:   '검증된 곳',
  pref_view:    '뷰 좋은 곳',
  pref_insta:   '인스타감성',
  pref_spacious:'넓은 공간',
  pref_quick:   '웨이팅 없음',
};

const GROUPS = [
  {
    label: '분위기',
    options: [
      { key: 'atm_loud',     label: '시끌벅적', emoji: '🎵' },
      { key: 'atm_quiet',    label: '조용하게',  emoji: '🌿' },
      { key: 'atm_cozy',     label: '아늑한',    emoji: '🕯️' },
      { key: 'atm_trendy',   label: '트렌디한',  emoji: '✨' },
      { key: 'atm_mood',     label: '감성적인',  emoji: '🌸' },
      { key: 'atm_hip',      label: '힙한',      emoji: '😎' },
    ],
  },
  {
    label: '취향',
    options: [
      { key: 'pref_new',      label: '새로운 곳',   emoji: '🗺️' },
      { key: 'pref_known',    label: '검증된 곳',   emoji: '👍' },
      { key: 'pref_view',     label: '뷰 좋은 곳',  emoji: '🌅' },
      { key: 'pref_insta',    label: '인스타감성',  emoji: '📸' },
      { key: 'pref_spacious', label: '넓은 공간',   emoji: '🏠' },
      { key: 'pref_quick',    label: '웨이팅 없음', emoji: '⚡' },
    ],
  },
];

const KEYWORD_CHIPS = [
  { label: '단체룸', emoji: '🚪' },
  { label: '야외테라스', emoji: '🌿' },
  { label: '주차가능', emoji: '🚗' },
  { label: '루프탑', emoji: '🏙️' },
  { label: '포토존', emoji: '📷' },
  { label: '야경맛집', emoji: '🌃' },
  { label: '24시간', emoji: '🌙' },
  { label: '반려동물', emoji: '🐾' },
  { label: '혼잡하지않은', emoji: '😌' },
];

interface Props {
  value: VibeState;
  onChange: (v: VibeState) => void;
  purpose?: { first: string | null; second?: string | null };
  budget?: string | null;
  onBudgetChange?: (b: string | null) => void;
  keywords?: string[];
  onKeywordsChange?: (k: string[]) => void;
  vibeCustom?: Record<string, string>;
  onVibeCustomChange?: (label: string, text: string) => void;
}

const PRESET_CHIP_LABELS = ['단체룸', '야외테라스', '주차가능', '루프탑', '포토존', '야경맛집', '24시간', '반려동물', '혼잡하지않은'];

export default function VibeSelect({ value, onChange, purpose, keywords = [], onKeywordsChange }: Props) {
  const [customInput, setCustomInput] = useState('');

  function addCustomKeyword() {
    if (!onKeywordsChange) return;
    const trimmed = customInput.trim();
    if (!trimmed || keywords.includes(trimmed)) {
      setCustomInput('');
      return;
    }
    onKeywordsChange([...keywords, trimmed]);
    setCustomInput('');
  }

  function toggle(groupLabel: string, key: string) {
    const g = value[groupLabel] ?? { first: null, second: null };
    let { first, second } = g;
    if (first === key) {
      first = second;
      second = null;
    } else if (second === key) {
      second = null;
    } else if (first === null) {
      first = key;
    } else if (second === null) {
      second = key;
    } else {
      first = second;
      second = key;
    }
    onChange({ ...value, [groupLabel]: { first, second } });
  }

  function toggleKeyword(label: string) {
    if (!onKeywordsChange) return;
    if (keywords.includes(label)) {
      onKeywordsChange(keywords.filter((k) => k !== label));
    } else {
      onKeywordsChange([...keywords, label]);
    }
  }

  const hasSecond = purpose?.second && purpose.second !== '없음';

  return (
    <div className="px-4 pt-3 pb-6 flex flex-col gap-5">
      {GROUPS.map((group, groupIdx) => {
        const g = value[group.label] ?? { first: null, second: null };
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{group.label}</p>
              {groupIdx === 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black bg-[#1E9E8C] text-white px-2 py-0.5 rounded-full">
                    🍀 {purpose?.first ? `1차: ${purpose.first}` : '1차'}
                  </span>
                  {hasSecond && (
                    <span className="text-[10px] font-black bg-orange-400 text-white px-2 py-0.5 rounded-full">
                      🔥 2차: {purpose!.second}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {group.options.map((opt) => {
                const isFirst = g.first === opt.key;
                const isSecond = g.second === opt.key;
                const isActive = isFirst || isSecond;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggle(group.label, opt.key)}
                    className={`relative flex flex-col items-center justify-center h-16 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                      isFirst
                        ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                        : isSecond
                        ? 'border-orange-400 bg-orange-50 text-orange-500 shadow-md shadow-orange-200/50'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                    }`}
                  >
                    {isFirst && (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-[#1E9E8C] text-white px-1.5 py-0.5 rounded-full leading-none z-10 shadow-sm">1차</span>
                    )}
                    {isSecond && (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-orange-400 text-white px-1.5 py-0.5 rounded-full leading-none z-10 shadow-sm">2차</span>
                    )}
                    <span className="text-lg mb-1 leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 편의시설 키워드 */}
      {onKeywordsChange && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">편의시설</p>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KEYWORD_CHIPS.map((chip) => {
              const isActive = keywords.includes(chip.label);
              return (
                <button
                  key={chip.label}
                  onClick={() => toggleKeyword(chip.label)}
                  className={`flex flex-col items-center justify-center h-16 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                    isActive
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-lg mb-1 leading-none">{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* 키워드 직접 입력 */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomKeyword();
                }
              }}
              placeholder="원하는 키워드 직접 입력"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors"
            />
            <button
              onClick={addCustomKeyword}
              className="flex-shrink-0 px-4 rounded-xl bg-[#3CDBC0] text-white text-sm font-bold transition-all active:scale-95 hover:bg-[#2AB5A0]"
            >
              추가
            </button>
          </div>

          {/* 직접 입력한 키워드 태그 */}
          {keywords.filter((k) => !PRESET_CHIP_LABELS.includes(k)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {keywords
                .filter((k) => !PRESET_CHIP_LABELS.includes(k))
                .map((k) => (
                  <button
                    key={k}
                    onClick={() => toggleKeyword(k)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E8F8F5] border border-[#3CDBC0]/40 text-[#2AB5A0] text-xs font-bold transition-all active:scale-95"
                  >
                    <span>#{k}</span>
                    <span className="text-[#2AB5A0]/60">×</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
