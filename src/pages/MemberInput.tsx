import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import PurposeSelect from '../components/PurposeSelect';
import type { PurposeValue } from '../components/PurposeSelect';
import VibeSelect from '../components/VibeSelect';
import type { VibeState } from '../components/VibeSelect';
import StepProgress from '../components/StepProgress';
import { EXCLUDE_FOOD_PREFIX } from '../utils/groupAggregate';

type Phase = 'step0' | 'step1' | 'step2' | 'done';

function SuggestionDropdown({
  suggestions,
  anchorEl,
  onSelect,
}: {
  suggestions: KakaoPlace[];
  anchorEl: HTMLDivElement | null;
  onSelect: (place: KakaoPlace) => void;
}) {
  if (!suggestions.length || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  return createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
    >
      {suggestions.map((place) => (
        <button
          key={place.id}
          onMouseDown={() => onSelect(place)}
          className="w-full text-left px-4 py-3 hover:bg-[#E8F8F5] transition-colors border-b border-gray-100 last:border-0"
        >
          <div className="text-sm font-medium text-gray-800">{place.place_name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{place.road_address_name || place.address_name}</div>
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function MemberInput() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('id');

  const [phase, setPhase] = useState<Phase>('step0');
  const [name, setName] = useState('');

  // 출발지
  const [locValue, setLocValue] = useState('');
  const [locSelected, setLocSelected] = useState(false);
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);

  // 목적
  const [purpose, setPurpose] = useState<PurposeValue>({
    first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null,
  });

  // 분위기 + 예산 + 키워드
  const [vibe, setVibe] = useState<VibeState>({});
  const [budget, setBudget] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludeFoods, setExcludeFoods] = useState<string[]>([]);
  const [vibeCustom, setVibeCustom] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 정보
  const [expectedCount, setExpectedCount] = useState<number | null>(null);
  const [members, setMembers] = useState<{ member_name: string }[]>([]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const locInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 이미 제출했으면 done으로
  useEffect(() => {
    if (sessionId && sessionStorage.getItem(`mint_joined_${sessionId}`)) {
      setPhase('done');
    }
  }, [sessionId]);

  // done 화면 폴링
  useEffect(() => {
    if (phase !== 'done' || !sessionId) return;
    let active = true;

    async function poll() {
      if (document.hidden) return; // 백그라운드 탭에서는 폴링 중지
      try {
        const res = await fetch(`/api/session-get?id=${encodeURIComponent(sessionId!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setExpectedCount(data.expected_count ?? null);
        setMembers(Array.isArray(data.members) ? data.members : []);
      } catch { /* ignore */ }
    }

    poll();
    const interval = setInterval(poll, 3000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [phase, sessionId]);

  function handleLocChange(value: string) {
    setLocValue(value);
    setLocSelected(false);
    setLocLat(null);
    setLocLng(null);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 1) return;
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(value);
        setSuggestions(results.slice(0, 5));
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 200);
  }

  function selectPlace(place: KakaoPlace) {
    setLocValue(place.place_name);
    setLocLat(parseFloat(place.y));
    setLocLng(parseFloat(place.x));
    setLocSelected(true);
    setSuggestions([]);
    setSearching(false);
  }

  const canGoStep1 = name.trim().length > 0 && locSelected && locLat != null && locLng != null;
  const canGoStep2 = !!purpose.first;

  async function handleSubmit() {
    if (!sessionId) {
      setError('잘못된 링크예요. 호스트에게 링크를 다시 받아주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/session-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          member_name: name.trim(),
          location_name: locValue,
          location_lat: locLat,
          location_lng: locLng,
          purpose_first: purpose.first,
          purpose_second: purpose.second !== '없음' ? purpose.second : null,
          vibe_atmosphere: Object.values(vibe).find((g) => g.first)?.first ?? null,
          vibe_budget: budget,
          vibe_keywords: (() => {
            // 편식은 DB 컬럼 추가 없이 접두사로 키워드에 실어 보냄 — 호스트가 집계 시 분리
            // 장르 선택(한식/와인 등)은 일반 키워드로 실어 검색·프롬프트에 자연 반영
            const all = [
              ...keywords,
              ...Object.values(vibeCustom).filter(Boolean),
              ...(purpose.firstGenre ? [purpose.firstGenre] : []),
              ...(purpose.secondGenre && purpose.second !== '없음' ? [purpose.secondGenre] : []),
              ...excludeFoods.map((f) => `${EXCLUDE_FOOD_PREFIX}${f}`),
            ];
            return all.length > 0 ? all : null;
          })(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '제출에 실패했어요. 다시 시도해주세요.');
      }
      sessionStorage.setItem(`mint_joined_${sessionId}`, '1');
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F5FBF8] px-6 text-center">
        <p className="text-2xl mb-3">🔗</p>
        <p className="font-bold text-gray-800 mb-1">유효하지 않은 링크예요</p>
        <p className="text-sm text-gray-400">호스트에게 참여 링크를 다시 받아주세요.</p>
      </div>
    );
  }

  if (phase === 'done') {
    const total = expectedCount ?? members.length;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F5FBF8] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#3CDBC0] flex items-center justify-center mb-5 shadow-lg shadow-[#3CDBC0]/30">
          <span className="text-white text-3xl font-black">✓</span>
        </div>
        <h1 className="text-xl font-black text-gray-800 mb-1">제출 완료!</h1>
        <p className="text-sm text-gray-500 mb-6">호스트가 모두 모이면 장소를 추천받을 거예요.</p>

        <div className="bg-white shadow-sm rounded-2xl px-6 py-5 w-full max-w-xs">
          <p className="text-xs text-gray-400 mb-3 text-center">
            입력 현황 <span className="font-black text-[#2AB5A0]">{members.length}</span>
            <span className="text-gray-300"> / {total}</span>
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: total }).map((_, i) => {
              const member = members[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
                    member ? 'bg-[#E8F8F5]' : 'bg-gray-50 border border-dashed border-gray-200'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      member ? 'bg-[#3CDBC0] text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {member ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-bold ${member ? 'text-[#2AB5A0]' : 'text-gray-300'}`}>
                    {member ? member.member_name : '대기 중...'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-gray-300 mt-4">3초마다 자동 새로고침</p>
      </div>
    );
  }

  const stepIndex = phase === 'step0' ? 0 : phase === 'step1' ? 1 : 2;

  return (
    <div className="h-[100dvh] bg-[#F5FBF8] flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 text-center pt-4 px-4 relative">
        <button
          onClick={() => window.location.href = '/'}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2AB5A0] transition-colors p-1 text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
      </div>

      {/* 스텝 프로그레스 */}
      <div className="flex-shrink-0">
        <StepProgress current={stepIndex} total={3} labels={['출발지', '코스', '취향']} />
      </div>

      {/* 스텝 제목 */}
      <div className="flex-shrink-0 text-center px-4 pt-2 pb-1">
        <h2 className="text-xl font-black text-gray-800">
          {phase === 'step0' && '이름과 출발지를 알려주세요'}
          {phase === 'step1' && '오늘의 코스 선택'}
          {phase === 'step2' && '원하는 분위기를 골라봐요'}
        </h2>
        {phase === 'step2' && (
          <p className="text-xs text-gray-400 mt-1">취향을 많이 고를수록 추천이 정확해져요</p>
        )}
      </div>

      {/* 콘텐츠 */}
      <div key={phase} className="flex-1 min-h-0 overflow-y-auto animate-fade-in-up">
        {phase === 'step0' && (
          <div className="px-5 pt-3 pb-4 flex flex-col gap-5">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력해주세요"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm outline-none focus:border-[#3CDBC0] transition-all"
              />
            </div>
            {/* 출발지 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">출발지</label>
              <div ref={wrapperRef} className="relative">
                <input
                  ref={locInputRef}
                  type="text"
                  value={locValue}
                  onChange={(e) => handleLocChange(e.target.value)}
                  onFocus={() => {
                    setTimeout(() => locInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                  }}
                  placeholder="예: 강남역, 합정역..."
                  className={`w-full pl-4 pr-9 py-3 rounded-2xl border-2 text-sm outline-none transition-all bg-white ${
                    locSelected ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200 focus:border-[#3CDBC0]'
                  }`}
                />
                {searching && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {locSelected && !searching && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <span className="text-[#3CDBC0] text-sm font-bold">✓</span>
                  </div>
                )}
                <SuggestionDropdown
                  suggestions={suggestions}
                  anchorEl={wrapperRef.current}
                  onSelect={selectPlace}
                />
              </div>
            </div>
          </div>
        )}

        {phase === 'step1' && (
          <PurposeSelect value={purpose} onChange={setPurpose} />
        )}

        {phase === 'step2' && (
          <VibeSelect
            value={vibe}
            onChange={setVibe}
            purpose={{ first: purpose.first, second: purpose.second }}
            budget={budget}
            onBudgetChange={setBudget}
            keywords={keywords}
            onKeywordsChange={setKeywords}
            excludeFoods={excludeFoods}
            onExcludeFoodsChange={setExcludeFoods}
            vibeCustom={vibeCustom}
            onVibeCustomChange={(label, text) => setVibeCustom((prev) => ({ ...prev, [label]: text }))}
          />
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex-shrink-0 mx-5 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex-shrink-0 px-5 pt-2 pb-8 flex flex-col gap-2">
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <button
              onClick={() => setPhase(stepIndex === 1 ? 'step0' : 'step1')}
              className="w-14 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-lg hover:border-gray-300 transition-all active:scale-95"
            >
              ←
            </button>
          )}

          {phase === 'step0' && (
            <button
              onClick={() => setPhase('step1')}
              disabled={!canGoStep1}
              className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
                canGoStep1
                  ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              다음
            </button>
          )}

          {phase === 'step1' && (
            <button
              onClick={() => setPhase('step2')}
              disabled={!canGoStep2}
              className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
                canGoStep2
                  ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              다음
            </button>
          )}

          {phase === 'step2' && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
                !submitting
                  ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          )}
        </div>

        {phase === 'step0' && !canGoStep1 && (
          <p className="text-xs text-gray-400 text-center">이름과 출발지를 입력해주세요</p>
        )}
        {phase === 'step1' && !canGoStep2 && (
          <p className="text-xs text-gray-400 text-center">1차 목적을 선택해주세요</p>
        )}
      </div>
    </div>
  );
}
