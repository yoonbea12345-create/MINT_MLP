import { useState } from 'react';

export interface PurposeValue {
  first: string | null;
  firstRaw: '밥' | '술' | '카페' | '기타' | null;
  second: string | null;
  secondRaw: '밥' | '술' | '카페' | '기타' | '없음' | null;
  relation: string | null;
  occasion: string | null;
}

interface Props {
  value: PurposeValue;
  onChange: (v: PurposeValue) => void;
}

const OPTIONS: { value: '밥' | '술' | '카페' | '기타'; emoji: string }[] = [
  { value: '밥', emoji: '🍽️' },
  { value: '술', emoji: '🍻' },
  { value: '카페', emoji: '☕' },
  { value: '기타', emoji: '✏️' },
];

const RELATION_OPTIONS: { value: string; emoji: string }[] = [
  { value: '친구들', emoji: '👥' },
  { value: '연인', emoji: '💑' },
  { value: '가족', emoji: '👨‍👩‍👧' },
  { value: '직장동료', emoji: '💼' },
];

const OCCASION_OPTIONS: { value: string; emoji: string }[] = [
  { value: '생일', emoji: '🎂' },
  { value: '기념일', emoji: '💕' },
  { value: '소개팅', emoji: '💫' },
  { value: '축하', emoji: '🎉' },
  { value: '위로', emoji: '🤗' },
];

export default function PurposeSelect({ value, onChange }: Props) {
  const [firstText, setFirstText] = useState<string>(
    value.firstRaw === '기타' && value.first ? value.first : ''
  );
  const [secondText, setSecondText] = useState<string>(
    value.secondRaw === '기타' && value.second ? value.second : ''
  );

  function selectFirst(opt: '밥' | '술' | '카페' | '기타') {
    const newSecondRaw = value.secondRaw === opt ? null : value.secondRaw;
    const newSecond = value.secondRaw === opt ? null : value.second;
    if (opt === '기타') {
      onChange({ ...value, first: firstText.trim() || null, firstRaw: '기타', second: newSecond, secondRaw: newSecondRaw });
    } else {
      onChange({ ...value, first: opt, firstRaw: opt, second: newSecond, secondRaw: newSecondRaw });
    }
  }

  function handleFirstText(text: string) {
    setFirstText(text);
    onChange({ ...value, first: text.trim() || null });
  }

  function selectSecond(opt: '밥' | '술' | '카페' | '기타' | '없음') {
    if (opt === '없음') {
      onChange({ ...value, second: '없음', secondRaw: '없음' });
    } else if (opt === '기타') {
      onChange({ ...value, second: secondText.trim() || null, secondRaw: '기타' });
    } else {
      onChange({ ...value, second: opt, secondRaw: opt });
    }
  }

  function handleSecondText(text: string) {
    setSecondText(text);
    onChange({ ...value, second: text.trim() || null });
  }

  function toggleRelation(rel: string) {
    onChange({ ...value, relation: value.relation === rel ? null : rel });
  }

  function toggleOccasion(occ: string) {
    onChange({ ...value, occasion: value.occasion === occ ? null : occ });
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
                    placeholder="입력"
                    maxLength={10}
                    className="w-full px-1 text-center text-xs font-bold text-[#2AB5A0] bg-transparent outline-none placeholder:text-[#3CDBC0]/50 placeholder:font-medium"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-xl mb-1 leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                      {opt.value}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2차 목적 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">2차 목적</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {OPTIONS.map((opt) => {
            const isDisabled = opt.value !== '기타' && opt.value === value.firstRaw;
            const selected = value.secondRaw === opt.value;
            const showInput = selected && opt.value === '기타';
            return (
              <button
                key={opt.value}
                onClick={() => !isDisabled && selectSecond(opt.value)}
                disabled={isDisabled}
                className={`flex flex-col items-center justify-center h-[72px] rounded-2xl border-2 transition-all duration-200 ${
                  isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                    : selected
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
                    placeholder="입력"
                    maxLength={10}
                    className="w-full px-1 text-center text-xs font-bold text-[#2AB5A0] bg-transparent outline-none placeholder:text-[#3CDBC0]/50 placeholder:font-medium"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-xl mb-1 leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>
                      {opt.value}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

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

      {/* 오늘 모임은요? */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">오늘 모임은요?</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RELATION_OPTIONS.map((opt) => {
            const selected = value.relation === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => toggleRelation(opt.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${
                  selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-sm shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#3CDBC0]/50'
                }`}
              >
                <span>{opt.emoji}</span>
                <span>{opt.value}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 특별한 날인가요? */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">특별한 날인가요?</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {OCCASION_OPTIONS.map((opt) => {
            const selected = value.occasion === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => toggleOccasion(opt.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${
                  selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-sm shadow-[#3CDBC0]/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#3CDBC0]/50'
                }`}
              >
                <span>{opt.emoji}</span>
                <span>{opt.value}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
