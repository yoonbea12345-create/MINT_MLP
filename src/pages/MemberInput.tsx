import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';

type Phase = 'input' | 'done';

const ATMOSPHERE_OPTIONS = [
  { key: 'noise_loud', label: '시끌벅적' },
  { key: 'noise_quiet', label: '조용하게' },
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

  const [phase, setPhase] = useState<Phase>('input');
  const [name, setName] = useState('');

  const [locValue, setLocValue] = useState('');
  const [locSelected, setLocSelected] = useState(false);
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);

  const [atmosphere, setAtmosphere] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expectedCount, setExpectedCount] = useState<number | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number>(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const locInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      try {
        const res = await fetch(`/api/session-get?id=${encodeURIComponent(sessionId!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setExpectedCount(data.expected_count ?? null);
        setSubmittedCount(Array.isArray(data.members) ? data.members.length : 0);
      } catch {
        // 폴링 실패는 조용히 무시
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
        // 무시
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

  const canSubmit = name.trim().length > 0 && locSelected && locLat != null && locLng != null;

  async function handleSubmit() {
    if (!sessionId) {
      setError('잘못된 링크예요. 호스트에게 링크를 다시 받아주세요.');
      return;
    }
    if (!canSubmit) return;
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
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F5FBF8] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#3CDBC0] flex items-center justify-center mb-5 shadow-lg shadow-[#3CDBC0]/30">
          <span className="text-white text-3xl font-black">✓</span>
        </div>
        <h1 className="text-xl font-black text-gray-800 mb-2">제출 완료!</h1>
        <p className="text-sm text-gray-500 mb-6">호스트가 모두의 취향을 모아 장소를 추천해드릴 거예요.</p>
        <div className="bg-white shadow-sm rounded-2xl px-8 py-5">
          <p className="text-xs text-gray-400 mb-1">현재 입력 현황</p>
          <p className="text-3xl font-black text-[#2AB5A0]">
            {submittedCount}
            <span className="text-gray-300"> / {expectedCount ?? '?'}</span>
            <span className="text-base text-gray-400 font-bold"> 명</span>
          </p>
        </div>
        <p className="text-xs text-gray-300 mt-4">3초마다 자동 새로고침돼요</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-5 pt-6 pb-28">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
          <p className="text-sm text-gray-500 mt-1">모임 장소 정하기에 참여해요</p>
        </div>

        {/* 이름 */}
        <div className="mb-5">
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
        <div className="mb-5">
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

        {/* 분위기 */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            분위기 <span className="text-xs font-normal text-gray-400">(선택)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ATMOSPHERE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setAtmosphere((cur) => (cur === opt.key ? null : opt.key))}
                className={`py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 border-2 ${
                  atmosphere === opt.key
                    ? 'bg-[#3CDBC0] text-white border-[#3CDBC0]'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 예산 */}
        <div className="mb-2">
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
                    ? 'bg-[#3CDBC0] text-white border-[#3CDBC0]'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F5FBF8] border-t border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
              canSubmit && !submitting
                ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
          {!canSubmit && (
            <p className="text-xs text-gray-400 text-center mt-2">이름과 출발지를 입력해주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}
