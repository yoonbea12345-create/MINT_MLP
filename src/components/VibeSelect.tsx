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

// 값은 서버(recommend.ts)·집계(groupAggregate BUDGET_ORDER)와 반드시 일치시켜야 검색 프리픽스/예산 반영이 작동한다
const BUDGET_OPTIONS = [
  { value: '~2만원',  label: '~2만원',  emoji: '💵', sub: '가성비' },
  { value: '2~4만원', label: '2~4만원', emoji: '🍽️', sub: '적당히' },
  { value: '4만원+',  label: '4만원+',  emoji: '💎', sub: 'special' },
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
  excludeFoods?: string[];
  onExcludeFoodsChange?: (f: string[]) => void;
  // 'all'(기본)=전체 한 화면 / 'mood'=분위기·취향 카드만 / 'extras'=못먹는음식·편의시설만
  // 그룹 참여(MemberInput)에서 취향을 2개 스텝으로 나눠 4단계로 맞추기 위한 스위치
  section?: 'all' | 'mood' | 'extras';
}

export default function VibeSelect({ value, onChange, purpose, budget = null, onBudgetChange, keywords = [], onKeywordsChange, excludeFoods = [], onExcludeFoodsChange, section = 'all' }: Props) {
  const showMood = section === 'all' || section === 'mood';
  const showExtras = section === 'all' || section === 'extras';
  const [customInput, setCustomInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

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

  function removeExcludeFood(label: string) {
    if (!onExcludeFoodsChange) return;
    onExcludeFoodsChange(excludeFoods.filter((f) => f !== label));
  }

  // 쉼표/공백 구분 여러 개 한 번에 입력 지원 ("회, 오이, 곱창" → 3개 태그)
  function addExcludeFoods() {
    if (!onExcludeFoodsChange) return;
    const items = excludeInput
      .split(/[,，]/)
      .map((s) => s.trim().slice(0, 20))
      .filter((s) => s && !excludeFoods.includes(s));
    if (items.length > 0) {
      onExcludeFoodsChange([...excludeFoods, ...items].slice(0, 8));
    }
    setExcludeInput('');
  }

  function toggle(groupLabel: string, key: string) {
    const g = value[groupLabel] ?? { first: null, second: null };
    let { first, second } = g;
    const isFirst = first === key;
    const isSecond = second === key;
    if (isFirst && isSecond) {
      // 1차+2차 동시 지정 상태 → 해제
      first = null;
      second = null;
    } else if (isFirst) {
      // 1차만 지정됨: 2차가 비었으면 같은 분위기를 2차로도(중복 허용), 아니면 1차 해제
      if (second === null) second = key;
      else { first = second; second = null; }
    } else if (isSecond) {
      // 2차만 지정됨: 1차가 비었으면 같은 분위기를 1차로도, 아니면 2차 해제
      if (first === null) first = key;
      else second = null;
    } else {
      // 미선택: 빈 슬롯에 채우고, 둘 다 차있으면 밀어낸다
      if (first === null) first = key;
      else if (second === null) second = key;
      else { first = second; second = key; }
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

  // 편식 필터는 음식이 나오는 모임에서만 — 카페만 가는 모임에선 숨김
  const isFoodPurpose = (p?: string | null) => !!p && p !== '없음' && p !== '카페';
  const showExcludeFoods =
    !!onExcludeFoodsChange && (!purpose?.first || isFoodPurpose(purpose.first) || isFoodPurpose(purpose.second));

  return (
    <div className="px-4 pt-3 pb-6 flex flex-col gap-5">
      {/* 1차/2차 토글 안내 — 처음 쓰는 사람이 배지 의미를 알 수 있게 */}
      {showMood && hasSecond && (
        <div className="bg-[#E8F8F5] border border-[#3CDBC0]/30 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-base">💡</span>
          <p className="text-[11px] text-[#2AB5A0] leading-snug">
            탭할 때마다 <span className="font-black">1차 → 1·2차 → 해제</span> · 1차·2차에 <span className="font-black">같은 분위기</span>도 돼요
          </p>
        </div>
      )}
      {showMood && GROUPS.map((group, groupIdx) => {
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
                const isBoth = isFirst && isSecond;
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
                    {isBoth ? (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-gradient-to-r from-[#1E9E8C] to-orange-400 text-white px-1.5 py-0.5 rounded-full leading-none z-10 shadow-sm">1·2차</span>
                    ) : isFirst ? (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-[#1E9E8C] text-white px-1.5 py-0.5 rounded-full leading-none z-10 shadow-sm">1차</span>
                    ) : isSecond ? (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-orange-400 text-white px-1.5 py-0.5 rounded-full leading-none z-10 shadow-sm">2차</span>
                    ) : null}
                    <span className="text-lg mb-1 leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 예산 — 1인 기준. 서버가 검색 키워드에 '가성비/고급' 프리픽스 + AI 예산 제약으로 반영 */}
      {showExtras && onBudgetChange && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">💰 예산</p>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">1인 기준 · 선택사항</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BUDGET_OPTIONS.map((opt) => {
              const isActive = budget === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onBudgetChange(isActive ? null : opt.value)}
                  className={`flex flex-col items-center justify-center h-16 rounded-xl border-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${
                    isActive
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-lg mb-0.5 leading-none">{opt.emoji}</span>
                  <span>{opt.label}</span>
                  <span className={`text-[9px] font-medium ${isActive ? 'text-[#2AB5A0]/70' : 'text-gray-400'}`}>{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 키워드 — 자유 입력 강조 섹션. 분위기·취향에 없는 조건은 물론 편의시설·메뉴까지 뭐든지 */}
      {showExtras && onKeywordsChange && (
        <div className="rounded-2xl border-2 border-[#3CDBC0]/40 bg-[#F0FDF9] p-4">
          <p className="text-sm font-black text-[#2AB5A0] mb-1 break-keep">🔎 원하는 키워드는 뭐든지!</p>
          <p className="text-[11px] text-gray-500 mb-2.5 leading-relaxed break-keep">
            편의시설·분위기·조건 뭐든 자유롭게 추가하세요.<br />예: 단체룸, 주차, 루프탑, 노포, 뷰맛집, 조용한 곳
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomKeyword(); } }}
              onBlur={addCustomKeyword}
              placeholder="키워드 입력 후 Enter (여러 개 가능)"
              className="flex-1 border-2 border-[#3CDBC0]/50 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] bg-white transition-colors"
            />
            <button
              onClick={addCustomKeyword}
              className="flex-shrink-0 px-4 rounded-xl bg-[#3CDBC0] text-white text-sm font-bold transition-all active:scale-95 hover:bg-[#2AB5A0]"
            >
              추가
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {keywords.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleKeyword(k)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#3CDBC0]/50 text-[#2AB5A0] text-xs font-bold transition-all active:scale-95"
                >
                  <span>#{k}</span>
                  <span className="text-[#2AB5A0]/60">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 편식 필터 — 못 먹는 음식은 입력만 하면 추천에서 확실히 제외 */}
      {showExtras && showExcludeFoods && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">🚫 못 먹는 음식</p>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항 · 확실히 빼드려요</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={excludeInput}
              maxLength={60}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExcludeFoods();
                }
              }}
              onBlur={() => { if (excludeInput.trim()) addExcludeFoods(); }}
              placeholder="예: 회, 오이, 곱창 (쉼표로 여러 개)"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors"
            />
            {/* 추가 버튼은 편의시설과 동일한 민트로 통일 — 빨강은 '제외' 신호로 태그에만 사용 */}
            <button
              onClick={addExcludeFoods}
              className="flex-shrink-0 px-4 rounded-xl bg-[#3CDBC0] text-white text-sm font-bold transition-all active:scale-95 hover:bg-[#2AB5A0]"
            >
              추가
            </button>
          </div>

          {/* 입력한 제외 음식 태그 — 탭하면 삭제 */}
          {excludeFoods.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {excludeFoods.map((f) => (
                <button
                  key={f}
                  onClick={() => removeExcludeFood(f)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-500 text-xs font-bold transition-all active:scale-95"
                >
                  <span>🚫 {f}</span>
                  <span className="text-red-300">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
