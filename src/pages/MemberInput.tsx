import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import VibeSelect, { VIBE_KEY_TO_LABEL } from '../components/VibeSelect';
import type { VibeState } from '../components/VibeSelect';
import StepProgress from '../components/StepProgress';
import { EXCLUDE_FOOD_PREFIX, SECOND_KEYWORD_PREFIX, SECOND_VIBE_PREFIX } from '../utils/groupAggregate';
import { decodeHostContext } from '../utils/groupLink';
import type { HostContext } from '../utils/groupLink';

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

// 호스트가 정한 코스 텍스트 ("밥 → 술") + 지역 텍스트
function courseText(ctx: HostContext | null): string {
  if (!ctx?.purposeFirst) return '';
  const first = ctx.firstGenre ? `${ctx.purposeFirst}(${ctx.firstGenre})` : ctx.purposeFirst;
  const hasSecond = ctx.purposeSecond && ctx.purposeSecond !== '없음';
  if (!hasSecond) return first;
  const second = ctx.secondGenre ? `${ctx.purposeSecond}(${ctx.secondGenre})` : ctx.purposeSecond!;
  return `${first} → ${second}`;
}
function regionText(ctx: HostContext | null): string {
  if (!ctx) return '';
  return ctx.regionType === 'auto' ? '중간지점 자동 계산' : (ctx.regionName || '호스트 지정 지역');
}

// 호스트가 정한 코스·지역을 보여주는 읽기 전용 배너
function HostContextBanner({ ctx }: { ctx: HostContext | null }) {
  if (!ctx?.purposeFirst) return null;
  return (
    <div className="mx-5 mb-1 bg-[#E8F8F5] border border-[#3CDBC0]/40 rounded-2xl px-4 py-3">
      <p className="text-[10px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-1.5">호스트가 정한 모임</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1 font-bold text-gray-800">🍀 {courseText(ctx)}</span>
        <span className="flex items-center gap-1 font-bold text-gray-800">📍 {regionText(ctx)}</span>
      </div>
    </div>
  );
}

export default function MemberInput() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('id');
  // 호스트가 링크에 실어 보낸 코스·지역 컨텍스트 (구버전 링크는 null)
  const [hostCtx] = useState<HostContext | null>(() => decodeHostContext(params));
  // 중간지점 자동 모드에서만 출발지 입력을 받는다. 컨텍스트 없는 구버전 링크는 안전하게 출발지 요구.
  const showLocation = !hostCtx || hostCtx.regionType === 'auto';

  const [phase, setPhase] = useState<Phase>('step0');
  const [name, setName] = useState('');

  // 출발지
  const [locValue, setLocValue] = useState('');
  const [locSelected, setLocSelected] = useState(false);
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);

  // 분위기 + 예산 + 키워드 + 편식
  const [vibe, setVibe] = useState<VibeState>({});
  const [budget, setBudget] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsSecond, setKeywordsSecond] = useState<string[]>([]);
  const [excludeFoods, setExcludeFoods] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 정보 (완료 화면 현황)
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
      if (document.hidden) return;
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
    // 출발지는 사용자가 고른 정확한 좌표를 그대로 사용 (중간지점 계산 정확도)
    setLocValue(place.place_name);
    setLocLat(parseFloat(place.y));
    setLocLng(parseFloat(place.x));
    setLocSelected(true);
    setSuggestions([]);
    setSearching(false);
  }

  const canGoStep1 = name.trim().length > 0 && (!showLocation || (locSelected && locLat != null && locLng != null));

  async function handleSubmit() {
    if (!sessionId) {
      setError('잘못된 링크예요. 호스트에게 링크를 다시 받아주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 멤버가 고른 vibe 전체(분위기·취향 그룹의 1·2차 모두) 수집.
      // 대표 분위기 1개만 vibe_atmosphere로 보내면 취향·2차 선택이 유실되므로,
      // 대표 1개는 집계 투표용으로, 나머지는 라벨로 vibe_keywords에 실어 추천에 빠짐없이 반영한다.
      const allVibeKeys = Object.values(vibe).flatMap((g) => [g.first, g.second]).filter((k): k is string => !!k);
      const primaryAtm = vibe['분위기']?.first ?? allVibeKeys[0] ?? null;
      const extraVibeLabels = allVibeKeys
        .filter((k) => k !== primaryAtm)
        .map((k) => VIBE_KEY_TO_LABEL[k] ?? k);
      const secondVibeKeys = Object.values(vibe)
        .map((g) => g.second)
        .filter((k): k is string => !!k);

      const res = await fetch('/api/session-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          member_name: name.trim(),
          // 출발지는 중간지점 모드에서만 전송 — 임의 지역 모드는 좌표 없이 참여
          ...(showLocation && locLat != null && locLng != null
            ? { location_name: locValue, location_lat: locLat, location_lng: locLng }
            : {}),
          // 코스는 호스트가 정한 값을 그대로 실어 멤버 기록을 일관되게 유지
          purpose_first: hostCtx?.purposeFirst ?? null,
          purpose_second: hostCtx?.purposeSecond && hostCtx.purposeSecond !== '없음' ? hostCtx.purposeSecond : null,
          vibe_atmosphere: primaryAtm,
          vibe_budget: budget,
          vibe_keywords: (() => {
            // 대표 외 vibe + 편의시설 키워드 + 편식(접두사) 모두 합쳐 전송. 편식은 호스트가 집계 시 분리.
            const all = [
              ...extraVibeLabels,
              ...secondVibeKeys.map((k) => `${SECOND_VIBE_PREFIX}${k}`),
              ...keywords,
              ...keywordsSecond.map((k) => `${SECOND_KEYWORD_PREFIX}${k}`),
              ...excludeFoods.map((f) => `${EXCLUDE_FOOD_PREFIX}${f}`),
            ];
            return all.length > 0 ? Array.from(new Set(all)) : null;
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

  // 내가 고른 취향 요약 (완료 화면용)
  const myVibeLabels = Object.values(vibe)
    .flatMap((g) => [g.first, g.second])
    .filter((k): k is string => !!k)
    .map((k) => VIBE_KEY_TO_LABEL[k] ?? k);

  if (phase === 'done') {
    // 호스트는 코스·지역을 정한 첫 참여자로 항상 1명 포함(멤버 행은 아니지만 인원수엔 든다).
    // 표시용 목록 맨 앞에 호스트 슬롯을 넣어 "N명 중 N명"이 호스트 포함 정원과 맞게 한다.
    const displayMembers = [{ member_name: '호스트' }, ...members];
    const total = expectedCount ?? displayMembers.length;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center bg-[#F5FBF8] px-6 pt-12 pb-10">
        <div className="w-16 h-16 rounded-full bg-[#3CDBC0] flex items-center justify-center mb-5 shadow-lg shadow-[#3CDBC0]/30">
          <span className="text-white text-3xl font-black">✓</span>
        </div>
        <h1 className="text-xl font-black text-gray-800 mb-1">제출 완료!</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">호스트가 모두 모이면 장소를 추천받을 거예요.</p>

        {/* 호스트가 정한 코스·지역 */}
        {hostCtx?.purposeFirst && (
          <div className="w-full max-w-xs bg-white shadow-sm rounded-2xl px-5 py-4 mb-3">
            <p className="text-[10px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-2">이 모임</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center gap-2"><span className="text-gray-400 w-9 flex-shrink-0">코스</span><span className="font-bold text-gray-800">🍀 {courseText(hostCtx)}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-400 w-9 flex-shrink-0">지역</span><span className="font-bold text-gray-800">📍 {regionText(hostCtx)}</span></div>
            </div>
          </div>
        )}

        {/* 내가 고른 것 */}
        {(myVibeLabels.length > 0 || budget || excludeFoods.length > 0 || keywords.length > 0) && (
          <div className="w-full max-w-xs bg-white shadow-sm rounded-2xl px-5 py-4 mb-3">
            <p className="text-[10px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-2">내가 고른 취향</p>
            <div className="flex flex-wrap gap-1.5">
              {myVibeLabels.map((l) => (
                <span key={l} className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">{l}</span>
              ))}
              {budget && <span className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">💰 {budget}</span>}
              {keywords.map((k) => (
                <span key={k} className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">{k}</span>
              ))}
              {excludeFoods.map((f) => (
                <span key={f} className="bg-red-50 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full">🚫 {f}</span>
              ))}
            </div>
          </div>
        )}

        {/* 참여 현황 */}
        <div className="bg-white shadow-sm rounded-2xl px-6 py-5 w-full max-w-xs">
          <p className="text-xs text-gray-400 mb-3 text-center">
            입력 현황 <span className="font-black text-[#2AB5A0]">{displayMembers.length}</span>
            <span className="text-gray-300"> / {total}</span>
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: total }).map((_, i) => {
              const member = displayMembers[i];
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
  const stepLabels = [showLocation ? '출발지' : '이름', '분위기', '취향', '완료'];

  return (
    <div className="h-[100dvh] bg-[#F5FBF8] flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 text-center pt-4 px-4">
        <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
      </div>

      {/* 스텝 프로그레스 — 전 화면 4단계 고정 */}
      <div className="flex-shrink-0">
        <StepProgress current={stepIndex} total={4} labels={stepLabels} />
      </div>

      {/* 호스트가 정한 코스·지역 배너 (스텝 내내 노출) */}
      <div className="flex-shrink-0">
        <HostContextBanner ctx={hostCtx} />
      </div>

      {/* 스텝 제목 */}
      <div className="flex-shrink-0 text-center px-4 pt-2 pb-1">
        <h2 className="text-xl font-black text-gray-800">
          {phase === 'step0' && (showLocation ? '이름과 출발지를 알려주세요' : '이름을 알려주세요')}
          {phase === 'step1' && '원하는 분위기를 골라봐요'}
          {phase === 'step2' && '예산·취향을 더해요'}
        </h2>
        {phase === 'step1' && (
          <p className="text-xs text-gray-400 mt-1">눈치 안 보고 각자 원하는 대로 (많이 고를수록 정확해져요)</p>
        )}
        {phase === 'step2' && (
          <p className="text-xs text-gray-400 mt-1">예산·편의시설·키워드·못 먹는 음식 — 모두 선택사항</p>
        )}
      </div>

      {/* 콘텐츠 — 텍스트 입력 스텝은 키보드가 올라와도 편하게 상단정렬 유지 */}
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
            {/* 출발지 — 중간지점 자동 모드에서만 */}
            {showLocation && (
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
                <p className="text-xs text-gray-400 mt-2">전원 출발지로 중간지점을 계산해요</p>
              </div>
            )}
          </div>
        )}

        {phase === 'step1' && (
          <VibeSelect
            value={vibe}
            onChange={setVibe}
            purpose={{ first: hostCtx?.purposeFirst ?? null, second: hostCtx?.purposeSecond ?? null }}
            section="mood"
          />
        )}

        {phase === 'step2' && (
          <VibeSelect
            value={vibe}
            onChange={setVibe}
            purpose={{ first: hostCtx?.purposeFirst ?? null, second: hostCtx?.purposeSecond ?? null }}
            budget={budget}
            onBudgetChange={setBudget}
            keywords={keywords}
            onKeywordsChange={setKeywords}
            keywordsSecond={keywordsSecond}
            onKeywordsSecondChange={setKeywordsSecond}
            excludeFoods={excludeFoods}
            onExcludeFoodsChange={setExcludeFoods}
            section="extras"
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
      <div className="flex-shrink-0 px-5 pt-2 pb-[max(2rem,calc(env(safe-area-inset-bottom)+0.75rem))] flex flex-col gap-2">
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (stepIndex === 0) window.location.href = '/';
              else setPhase((['step0', 'step1', 'step2'] as const)[stepIndex - 1]);
            }}
            className="w-14 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-lg hover:border-gray-300 transition-all active:scale-95"
          >
            ←
          </button>

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
              className="flex-1 py-4 rounded-2xl font-black text-base bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-all active:scale-95"
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
          <p className="text-xs text-gray-400 text-center">
            {showLocation ? '이름과 출발지를 입력해주세요' : '이름을 입력해주세요'}
          </p>
        )}
      </div>
    </div>
  );
}
