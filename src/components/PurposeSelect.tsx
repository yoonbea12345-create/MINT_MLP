import { useState } from 'react';

export interface PurposeValue {
  first: string | null;
  firstRaw: '밥' | '술' | '카페' | '기타' | null;
  second: string | null;
  secondRaw: '밥' | '술' | '카페' | '기타' | '없음' | null;
  relation: string | null;
  occasion: string | null;
  // 장르 좁히기 (선택) — 밥이면 한식/중식/…, 술이면 소주·맥주/와인/… 미선택 = 전체
  firstGenre?: string | null;
  secondGenre?: string | null;
}

// 목적별 장르 선택지 — 서버 검색 키워드 풀(GENRE_KEYWORDS)과 라벨이 일치해야 한다
export const PURPOSE_GENRES: Record<string, string[]> = {
  '밥': ['한식', '중식', '일식', '양식', '아시안'],
  '술': ['소주·맥주', '와인', '칵테일', '이자카야'],
};

interface Props {
  value: PurposeValue;
  onChange: (v: PurposeValue) => void;
}

// 기타는 "직접 입력"으로 표기 — 원하는 장르를 자유롭게 쓸 수 있다는 걸 한눈에 알리기 위함
const OPTIONS: { value: '밥' | '술' | '카페' | '기타'; label?: string; emoji: string }[] = [
  { value: '밥', emoji: '🍽️' },
  { value: '술', emoji: '🍻' },
  { value: '카페', emoji: '☕' },
  { value: '기타', label: '직접 입력', emoji: '✏️' },
];


export default function PurposeSelect({ value, onChange }: Props) {
  const [firstText, setFirstText] = useState<string>(
    value.firstRaw === '기타' && value.first ? value.first : ''
  );
  const [secondText, setSecondText] = useState<string>(
    value.secondRaw === '기타' && value.second ? value.second : ''
  );

  function selectFirst(opt: '밥' | '술' | '카페' | '기타') {
    if (opt === '기타') {
      onChange({ ...value, first: firstText.trim() || null, firstRaw: '기타', firstGenre: null });
    } else {
      // 목적이 바뀌면 이전 장르 선택은 무효
      onChange({ ...value, first: opt, firstRaw: opt, ...(opt !== value.firstRaw ? { firstGenre: null } : {}) });
    }
  }

  function handleFirstText(text: string) {
    setFirstText(text);
    onChange({ ...value, first: text.trim() || null });
  }

  function selectSecond(opt: '밥' | '술' | '카페' | '기타' | '없음') {
    if (opt === '없음') {
      onChange({ ...value, second: '없음', secondRaw: '없음', secondGenre: null });
    } else if (opt === '기타') {
      onChange({ ...value, second: secondText.trim() || null, secondRaw: '기타', secondGenre: null });
    } else {
      onChange({ ...value, second: opt, secondRaw: opt, ...(opt !== value.secondRaw ? { secondGenre: null } : {}) });
    }
  }

  function toggleGenre(slot: 'first' | 'second', genre: string) {
    if (slot === 'first') {
      onChange({ ...value, firstGenre: value.firstGenre === genre ? null : genre });
    } else {
      onChange({ ...value, secondGenre: value.secondGenre === genre ? null : genre });
    }
  }

  function handleSecondText(text: string) {
    setSecondText(text);
    onChange({ ...value, second: text.trim() || null });
  }

  const isNoneSelected = value.secondRaw === '없음' || value.secondRaw === null;

  return (
    <div className="px-4 py-3 flex flex-col gap-5">
      {/* 1차 목적 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">1차 목적</p>
          <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {OPTIONS.map((opt) => {
            const selected = value.firstRaw === opt.value;
            const showInput = selected && opt.value === '기타';
            return (
              <button
                key={opt.value}
                onClick={() => selectFirst(opt.value)}
                className={`flex flex-col items-center justify-center h-[72px] rounded-2xl border-2 transition-all duration-200 ${
                  selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                }`}
              >
                {showInput ? (
                  <input
                    type="text"
                    value={firstText}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleFirstText(e.target.value)}
                    placeholder="예: 쌀국수"
                    maxLength={10}
                    className="w-full px-1 text-center text-xs font-bold text-[#2AB5A0] bg-transparent outline-none placeholder:text-[#3CDBC0]/50 placeholder:font-medium"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-xl mb-1 leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                      {opt.label ?? opt.value}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* 장르 좁히기 (선택) — 밥/술 선택 시에만 노출 */}
        {value.firstRaw && PURPOSE_GENRES[value.firstRaw] && (
          <div className="mt-2.5 animate-fade-in-up">
            <p className="text-[10px] text-gray-400 mb-1.5">장르를 좁히고 싶다면 골라주세요 (선택)</p>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSE_GENRES[value.firstRaw].map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre('first', g)}
                  className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all active:scale-95 ${
                    value.firstGenre === g
                      ? 'border-[#3CDBC0] bg-[#3CDBC0] text-white shadow-md shadow-[#3CDBC0]/30'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-[#3CDBC0]/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2차 목적 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">2차 목적</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {OPTIONS.map((opt) => {
            const selected = value.secondRaw === opt.value;
            const showInput = selected && opt.value === '기타';
            return (
              <button
                key={opt.value}
                onClick={() => selectSecond(opt.value)}
                className={`flex flex-col items-center justify-center h-[72px] rounded-2xl border-2 transition-all duration-200 ${
                  selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                }`}
              >
                {showInput ? (
                  <input
                    type="text"
                    value={secondText}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleSecondText(e.target.value)}
                    placeholder="예: 포차"
                    maxLength={10}
                    className="w-full px-1 text-center text-xs font-bold text-[#2AB5A0] bg-transparent outline-none placeholder:text-[#3CDBC0]/50 placeholder:font-medium"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-xl mb-1 leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                      {opt.label ?? opt.value}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* 2차 장르 좁히기 (선택) — 안내문구는 1차와 중복이라 짧게 */}
        {value.secondRaw && PURPOSE_GENRES[value.secondRaw] && (
          <div className="mb-2.5 animate-fade-in-up">
            <p className="text-[10px] text-gray-400 mb-1.5">2차 장르 (선택)</p>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSE_GENRES[value.secondRaw].map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre('second', g)}
                  className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all active:scale-95 ${
                    value.secondGenre === g
                      ? 'border-orange-400 bg-orange-400 text-white shadow-md shadow-orange-200/60'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 없음 — 풀너비, 기본 선택 */}
        <button
          onClick={() => selectSecond('없음')}
          className={`w-full py-3.5 rounded-2xl border-2 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isNoneSelected
              ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
              : 'border-gray-200 bg-white text-gray-600 hover:border-[#3CDBC0]/50'
          }`}
        >
          <span>✋</span>
          <span>2차 없음</span>
        </button>
      </div>

    </div>
  );
}
