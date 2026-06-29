import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import KeywordSelect from '../components/KeywordSelect';

type Phase = 'step0' | 'step1' | 'done';

const ATMOSPHERE_OPTIONS = [
  { key: 'noise_loud', label: '🎉 시끌벅적' },
  { key: 'noise_quiet', label: '🤫 조용하게' },
];

const BUDGET_OPTIONS = ['~2만원', '2~4만원', '4만원+', '상관없음'];

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

  const [locValue, setLocValue] = useState('');
  const [locSelected, setLocSelected] = useState(false);
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);

  const [atmosphere, setAtmosphere] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expectedCount, setExpectedCount] = useState<number | null>(null);
  const [members, setMembers] = useState<{ member_name: string }[]>([]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const locInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionId && sessionStorage.getItem(`mint_joined_${sessionId}`)) {
      setPhase('done');
    }
  }, [sessionId]);

  useEffect(() => {
    if (phase !== 'done' || !sessionId) return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/session-get?id=${encodeURIComponent(sessionId!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setExpectedCount(data.expected_count ?? null);
        setMembers(Array.isArray(data.members) ? data.members : []);
      } catch {
        // ignore
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
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
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
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
          vibe_atmosphere: atmosphere,
          vibe_budget: budget,
          vibe_keywords: keywords.length > 0 ? keywords : null,
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

  const stepIndex = phase === 'step0' ? 0 : 1;

  return (
    <div className="h-[100dvh] bg-[#F5FBF8] flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 text-center pt-5 px-4">
        <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
      </div>

      {/* 스텝 프로그레스 */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2">
        <div className="flex gap-2 mb-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= stepIndex ? 'bg-[#3CDBC0]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-medium text-gray-400">
          <span className={stepIndex >= 0 ? 'text-[#2AB5A0]' : ''}>출발지</span>
          <span className={stepIndex >= 1 ? 'text-[#2AB5A0]' : ''}>취향</span>
        </div>
      </div>

      {/* 스텝 제목 */}
      <div className="flex-shrink-0 text-center px-4 pt-2 pb-1">
        <h2 className="text-xl font-black text-gray-800">
          {phase === 'step0' && '이름과 출발지를 알려주세요'}
          {phase === 'step1' && '어떤 분위기를 원하시나요?'}
        </h2>
        {phase === 'step1' && (
          <p className="text-xs text-gray-400 mt-1">선택하지 않아도 괜찮아요</p>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-4">
        {phase === 'step0' && (
          <div className="flex flex-col gap-5">
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
          <div className="flex flex-col gap-5">
            {/* 분위기 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                분위기 <span className="text-xs font-normal text-gray-400">(선택)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ATMOSPHERE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setAtmosphere((cur) => (cur === opt.key ? null : opt.key))}
                    className={`py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 border-2 ${
                      atmosphere === opt.key
                        ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/20'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 예산 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                예산 <span className="text-xs font-normal text-gray-400">(선택)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBudget((cur) => (cur === opt ? null : opt))}
                    className={`py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 border-2 ${
                      budget === opt
                        ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/20'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* 키워드 */}
            <KeywordSelect selected={keywords} onChange={setKeywords} />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex-shrink-0 px-5 pt-2 pb-8 flex flex-col gap-2">
        {phase === 'step0' ? (
          <>
            <button
              onClick={() => setPhase('step1')}
              disabled={!canGoStep1}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
                canGoStep1
                  ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              다음
            </button>
            {!canGoStep1 && (
              <p className="text-xs text-gray-400 text-center">이름과 출발지를 입력해주세요</p>
            )}
          </>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('step0')}
              className="w-14 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-lg hover:border-gray-300 transition-all active:scale-95"
            >
              ←
            </button>
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
          </div>
        )}
      </div>
    </div>
  );
}
