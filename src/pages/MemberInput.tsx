import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';
import VibeSelect, { VIBE_KEY_TO_LABEL } from '../components/VibeSelect';
import type { VibeState } from '../components/VibeSelect';
import StepProgress from '../components/StepProgress';
// SECOND_KEYWORD_PREFIX는 더 이상 생성하지 않는다(1차/2차 키워드 입력 통합).
// 파싱 쪽(groupAggregate)은 그대로 둔다 — 배포 시점에 구버전 링크로 제출 중인 게스트가 있을 수 있다.
import { EXCLUDE_FOOD_PREFIX, SECOND_VIBE_PREFIX } from '../utils/groupAggregate';
import { decodeHostContext } from '../utils/groupLink';
import type { HostContext } from '../utils/groupLink';
import { trackEvent } from '../utils/analytics';
import { getDeviceId } from '../utils/points';
import MiniMap from '../components/MiniMap';
import type { MapPin } from '../components/MiniMap';
import WishlistButton from '../components/WishlistButton';
import VisitCertModal from '../components/VisitCertModal';
import { GpsPin, hideOnError, parseOpenStatus, congestionInfo, FitScoreBar, kakaoUrl } from '../components/placeCardBits';
import { computeTravelTimes } from '../services/travelTime';
import type { TravelTimeData } from '../services/travelTime';

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
  const [conditions, setConditions] = useState<string[]>([]);
  const [excludeFoods, setExcludeFoods] = useState<string[]>([]);

  // 참석 여부는 따로 묻지 않는다 — 링크를 열고 조건까지 넣어 제출했다면 그게 곧 참석이다.
  // 링크에 실려온 마감시각(rsvp_by)은 "마감 전에 냈는지" 지표로만 남긴다.
  const rsvpBy = (() => { const v = Number(params.get('rsvp_by')); return Number.isFinite(v) && v > 0 ? v : null; })();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 정보 (완료 화면 현황)
  const [expectedCount, setExpectedCount] = useState<number | null>(null);
  const [members, setMembers] = useState<{ member_name: string }[]>([]);
  const [groupResult, setGroupResult] = useState<GroupResult | null>(null); // 호스트가 추천을 받으면 폴링으로 수신
  // 게스트 본인 컨텍스트(출발지·취향) — 제출 시 localStorage에 심어 새로고침(결과 도착 시점) 후에도 살린다.
  // 개인 이동시간·길찾기·"내 취향 반영" 배너의 원천.
  const [guestCtx, setGuestCtx] = useState<GuestCtx | null>(null);
  const [placeChangedToast, setPlaceChangedToast] = useState(false); // 호스트가 장소를 바꾸면 알림
  // 호스트가 링크를 무효화한 세션 — 계속 "다 모이면 추천해요"라고 기다리게 두면 안 된다
  const [cancelled, setCancelled] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const locInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevResultNameRef = useRef<string | null>(null); // 폴링 중 1차 상호 변경 감지용

  // 이미 제출했으면 done으로. 제출 시 저장한 게스트 컨텍스트도 복원(새로고침 대비).
  // '제출했음' 플래그는 반드시 localStorage — 카톡 인앱브라우저를 닫으면 sessionStorage는 통째로 사라져서
  // 결과 보러 링크를 다시 누른 게스트에게 입력 화면이 다시 뜨고, 채워 제출하면 정원을 하나 더 먹는 중복 멤버가 된다.
  // (sessionStorage 조회는 배포 직전 버전으로 이미 제출한 탭을 위한 1회성 폴백)
  useEffect(() => {
    if (!sessionId) return;
    if (localStorage.getItem(`mint_joined_${sessionId}`) || sessionStorage.getItem(`mint_joined_${sessionId}`)) setPhase('done');
    try {
      const raw = localStorage.getItem(`mint_guest_ctx_${sessionId}`);
      if (raw) setGuestCtx(JSON.parse(raw) as GuestCtx);
    } catch { /* ignore */ }
  }, [sessionId]);

  // done 화면 폴링 — 결과 도착 전에만 3초 간격으로 돈다.
  // 결과를 받으면 주기 폴링을 멈춘다(호스트 폴링도 결과 화면에선 멈춘다): 결과 화면을 켜둔 게스트마다
  // 분당 6요청이 무기한 쌓였다. 대신 탭으로 돌아올 때만 1회 조회해, 호스트가 재추천으로 장소를 바꾼 경우의
  // 변경 알림은 그대로 살린다.
  // 호스트가 링크를 무효화하면(status==='cancelled') 대기 화면 대신 취소 안내를 띄우고 폴링도 멈춘다.
  const hasResult = !!groupResult;
  useEffect(() => {
    if (phase !== 'done' || !sessionId || cancelled) return;
    let active = true;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/session?id=${encodeURIComponent(sessionId!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        // status는 신버전 서버에만 있다 — 없으면(구버전) 기존 동작 그대로.
        if (data.status === 'cancelled') { setCancelled(true); return; }
        setExpectedCount(data.expected_count ?? null);
        setMembers(Array.isArray(data.members) ? data.members : []);
        // 호스트가 추천을 완료하면 결과가 실려온다 — 게스트 화면을 결과 뷰로 전환(협업 루프 완결)
        const incoming = data.result_json?.first?.placeName as string | undefined;
        if (incoming) {
          // 이미 결과를 보던 중 호스트가 재추천으로 장소를 바꾸면 조용한 교체 대신 알림 토스트
          if (prevResultNameRef.current && prevResultNameRef.current !== incoming) {
            setPlaceChangedToast(true);
            setTimeout(() => setPlaceChangedToast(false), 5000);
          }
          prevResultNameRef.current = incoming;
          setGroupResult(data.result_json as GroupResult);
        }
      } catch { /* ignore */ }
    }

    poll();
    // 결과가 오면 주기 폴링 종료. 탭 복귀 시 1회 조회만 유지(장소 변경 감지용).
    const interval = hasResult ? null : setInterval(poll, 3000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, sessionId, hasResult, cancelled]);

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
      // 집계(vibe_atmosphere)는 대표 1개만 받으므로 '분위기' 1차의 첫 칩을 대표로 세운다.
      const allFirstKeys = Object.values(vibe).flatMap((g) => g.first);
      const secondVibeKeys = Object.values(vibe).flatMap((g) => g.second);
      const primaryAtm = vibe['분위기']?.first[0] ?? allFirstKeys[0] ?? null;
      // 조건도 여기 실어 보낸다 — 코스 구분이 없어 2차 접두사를 붙이지 않는다
      const extraVibeLabels = [...allFirstKeys.filter((k) => k !== primaryAtm), ...conditions]
        .map((k) => VIBE_KEY_TO_LABEL[k] ?? k);

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          session_id: sessionId,
          member_name: name.trim(),
          // 같은 기기가 다시 제출하면 새 멤버가 아니라 '수정'으로 처리되게 하는 열쇠.
          // (서버가 device_id를 몰라도 그냥 무시되므로 구버전 서버에서도 안전하다)
          device_id: getDeviceId(),
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
      try { localStorage.setItem(`mint_joined_${sessionId}`, '1'); } catch { /* 저장 실패해도 제출은 끝났다 */ }
      // 제출 자체가 참석 확정 — events(그룹 실사용 조사 지표) + localStorage(재진입 시 복원)
      const rsvpValue = 'going';
      trackEvent('rsvp_submit', {
        device_id: getDeviceId(),
        group_key: sessionId,
        rsvp: rsvpValue,
        deadline_at: rsvpBy,
        submitted_before_deadline: rsvpBy == null ? null : Date.now() <= rsvpBy,
      });
      try { localStorage.setItem(`mint_rsvp_${sessionId}`, rsvpValue); } catch { /* ignore */ }
      // 게스트 본인 컨텍스트 저장 — 결과 도착 시점의 새로고침에도 개인 이동시간·취향 배너가 살아남게.
      const myChips = [
        ...Object.values(vibe).flatMap((g) => [...g.first, ...g.second]),
        ...conditions,
      ].map((k) => VIBE_KEY_TO_LABEL[k] ?? k);
      const ctx: GuestCtx = {
        locName: showLocation ? locValue || null : null,
        locLat: showLocation ? locLat : null,
        locLng: showLocation ? locLng : null,
        chips: myChips,
        budget,
        excludeFoods,
      };
      try { localStorage.setItem(`mint_guest_ctx_${sessionId}`, JSON.stringify(ctx)); } catch { /* ignore */ }
      setGuestCtx(ctx);
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
  const myVibeLabels = [
    ...Object.values(vibe).flatMap((g) => [...g.first, ...g.second]),
    ...conditions,
  ].map((k) => VIBE_KEY_TO_LABEL[k] ?? k);

  if (phase === 'done') {
    const total = expectedCount ?? members.length;
    // 이 기기가 호스트(그룹 세션을 만든 사람)인지 판별 — 그러면 입력 후 호스트 화면으로 복귀 CTA를 보여준다.
    const isHostDevice = (() => {
      try {
        const raw = localStorage.getItem('mint_group_session_v1');
        return !!raw && !!sessionId && (JSON.parse(raw) as { sessionId?: string })?.sessionId === sessionId;
      } catch { return false; }
    })();
    // 게스트: 호스트가 추천을 완료했으면 결과 뷰로 전환(호스트는 자기 결과를 앱에서 봄)
    if (!isHostDevice && groupResult) {
      const ctx: GuestCtx = guestCtx ?? {
        locName: showLocation ? locValue || null : null,
        locLat: showLocation ? locLat : null,
        locLng: showLocation ? locLng : null,
        chips: [...myVibeLabels, ...keywords],
        budget,
        excludeFoods,
      };
      return <GroupResultView result={groupResult} guest={ctx} placeChanged={placeChangedToast} />;
    }
    // 호스트가 링크를 무효화했다 — 이미 받은 결과가 있으면 그건 그대로 보여주고(위 분기),
    // 결과 없이 기다리는 중이었다면 여기서 끊어준다. 끝나지 않는 대기 화면이 최악이다.
    if (cancelled) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F5FBF8] px-6 text-center">
          <p className="text-3xl mb-3">🙏</p>
          <p className="font-black text-gray-800 mb-1.5">호스트가 초대를 취소했어요</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            코스나 지역이 바뀌었을 수 있어요.<br />호스트에게 새 링크를 받아주세요.
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] flex flex-col items-center bg-[#F5FBF8] px-6 pt-12 pb-10">
        <div className="w-16 h-16 rounded-full bg-[#3CDBC0] flex items-center justify-center mb-5 shadow-lg shadow-[#3CDBC0]/30">
          <span className="text-white text-3xl font-black">✓</span>
        </div>
        <h1 className="text-xl font-black text-gray-800 mb-1">제출 완료!</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          {isHostDevice
            ? members.length >= 2
              ? `현재 ${members.length}명 입력 완료! 바로 장소를 추천받아보세요.`
              : `현재 ${members.length}명 입력 완료 · 2명부터 추천받을 수 있어요.`
            : '다 모이면 호스트가 추천을 시작해요. 결과는 단톡방에서 확인하세요!'}
        </p>

        {/* 호스트 전용 — 완료 화면에서 바로 그룹 집계·추천 시작 */}
        {isHostDevice && (
          <button
            onClick={() => {
              if (sessionId && members.length >= 2) {
                window.location.href = `/app?grp=${encodeURIComponent(sessionId)}`;
              }
            }}
            disabled={members.length < 2}
            className={`w-full max-w-xs mb-5 py-3.5 rounded-2xl font-black text-sm transition-all ${
              members.length >= 2
                ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {members.length}명으로 추천받기 →
          </button>
        )}

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
  const stepLabels = [showLocation ? '출발지' : '이름', '분위기', '취향', '완료'];

  return (
    <div className="h-[100dvh] bg-[#F5FBF8] flex flex-col overflow-hidden" style={{ height: 'var(--mint-app-height, 100dvh)' }}>
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
            conditions={conditions}
            onConditionsChange={setConditions}
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
            aria-label="이전 단계로"
            className="w-[92px] py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-sm hover:border-gray-300 transition-all active:scale-95"
          >
            ← 이전
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

// 그룹 게스트가 수신하는 결과(호스트가 세션에 저장한 v:2 요약).
// v:2에서 신뢰 요소(사진·적합도·영업·해시태그·혼잡도)가 추가됐다 — 구버전(v:1) 링크는 해당 필드가 없어 옵셔널.
interface GroupResultPlace {
  placeName: string; category?: string; description?: string; priceRange?: string;
  address?: string; area?: string; lat?: number | null; lng?: number | null; kakaoPlaceUrl?: string | null;
  imageUrl?: string | null; vibeTags?: string[]; fitScore?: number | null;
  openingHours?: string | null; walkingToNext?: number | null; congestionLevel?: string | null;
}
interface GroupResult {
  first: GroupResultPlace; second?: GroupResultPlace | null; third?: GroupResultPlace | null;
  thirdLabel?: string | null; purposeFirst?: string | null; purposeSecond?: string | null; areaName?: string | null;
  treasurer?: string | null;
  weather?: { description: string; temp: number; isRainy: boolean } | null;
}

// 게스트 본인 컨텍스트 — 제출 시 저장(localStorage), 결과 화면의 개인화(이동시간·취향 배너·길찾기) 원천.
interface GuestCtx {
  locName: string | null;
  locLat: number | null;
  locLng: number | null;
  chips: string[];
  budget: string | null;
  excludeFoods: string[];
}

// 오늘 날짜 all-day 일정(.ics) 다운로드 — 모임 시각은 데이터에 없어 시간 없는 종일 일정으로.
function downloadMeetingIcs(placeName: string, address: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MINT//KO', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${Date.now()}@mint`, `DTSTAMP:${day}T000000Z`,
    `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${day}`,
    `SUMMARY:${esc(`🍀 MINT 모임 · ${placeName}`)}`,
    `LOCATION:${esc(address)}`, `DESCRIPTION:${esc('MINT에서 다같이 정한 모임 장소예요.')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mint-모임.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 게스트 결과 화면 — 호스트가 다 같이 고른 취향으로 뽑은 결과를 '호스트와 동등하게' 보여준다.
// 다만 결과를 바꾸는 조작(재추천·조절·예약)은 호스트 전용이라 뺀다 — 한 명이 다시 돌리면 전원이 어긋나므로.
// 대신 게스트에게만 의미 있는 것(내 취향 반영·찜·방문인증·총무)은 그대로 얹는다.
function GroupResultView({
  result, guest, placeChanged,
}: {
  result: GroupResult;
  guest: GuestCtx;
  placeChanged: boolean;
}) {
  const [visitPlace, setVisitPlace] = useState<GroupResultPlace | null>(null);
  const [myTravel, setMyTravel] = useState<TravelTimeData | null>(null);
  const [transportMode, setTransportMode] = useState<'transit' | 'driving'>('transit');
  const f = result.first;
  const hasSecond = !!result.second;
  const chips = Array.from(new Set([...guest.chips, ...(guest.budget ? [guest.budget] : [])])).slice(0, 5);
  const hasMyLoc = guest.locLat != null && guest.locLng != null;

  // 코스 지도 핀 — 1·2·3차 (좌표 있는 것만)
  const pins: MapPin[] = [];
  if (f.lat != null && f.lng != null && f.lat !== 0) pins.push({ lat: f.lat, lng: f.lng, name: f.placeName, kind: 'first' });
  if (result.second?.lat && result.second.lng && result.second.lat !== 0) pins.push({ lat: result.second.lat, lng: result.second.lng, name: result.second.placeName, kind: 'second' });
  if (result.third?.lat && result.third.lng && result.third.lat !== 0) pins.push({ lat: result.third.lat, lng: result.third.lng, name: result.third.placeName, kind: 'third' });

  // 내 출발지 → 1차/2차 개인 이동시간 — 호스트가 못 주는 '나만의' 값(게스트 기기에서 계산).
  // 임의 지역 모드(출발지 미입력)면 계산하지 않는다.
  useEffect(() => {
    if (!hasMyLoc || f.lat == null || f.lng == null || f.lat === 0) { setMyTravel(null); return; }
    let alive = true;
    const origins = [{ label: guest.locName || '내 출발지', lat: guest.locLat!, lng: guest.locLng! }];
    const dest: { first: { lat: number; lng: number }; second?: { lat: number; lng: number } } = { first: { lat: f.lat, lng: f.lng } };
    if (result.second?.lat && result.second.lng && result.second.lat !== 0) dest.second = { lat: result.second.lat, lng: result.second.lng };
    computeTravelTimes(origins, dest).then((t) => { if (alive) setMyTravel(t); }).catch(() => { /* 폴백 없이 조용히 */ });
    return () => { alive = false; };
  }, [hasMyLoc, guest.locName, guest.locLat, guest.locLng, f.lat, f.lng, result.second]);

  // 1차 길찾기 딥링크 — kakao "to"는 현재 위치에서 목적지까지 경로. 좌표 있으면 정확 매칭.
  const directionsUrl = f.lat && f.lng && f.lat !== 0
    ? `https://map.kakao.com/link/to/${encodeURIComponent(f.placeName)},${f.lat},${f.lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(f.placeName)}`;

  const firstTransit = myTravel?.first[transportMode]?.[0];
  const secondTransit = myTravel?.second?.[transportMode]?.[0];

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8] px-5 pt-10 pb-12">
      {/* 호스트가 장소를 바꾸면 알림 — 조용한 교체 대신 명시 */}
      {placeChanged && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg animate-fade-in-up">
          🔄 호스트가 장소를 바꿨어요 · 새 결과예요
        </div>
      )}
      <div className="max-w-md mx-auto flex flex-col gap-2">
        <div className="text-center mb-2">
          <div className="text-3xl mb-1">🎉</div>
          <h1 className="text-xl font-black text-gray-800">모임 장소가 정해졌어요!</h1>
          <p className="text-sm text-gray-500 mt-1">
            {result.areaName ? `${result.areaName} · ` : ''}다 같이 고른 취향으로 골랐어요
          </p>
        </div>

        {/* 내가 낸 취향이 반영됐다는 체감 — 호스트 결과의 개인화 배너를 게스트 '자기' 취향으로 */}
        {(chips.length > 0 || guest.excludeFoods.length > 0) && (
          <div className="bg-[#E8F8F5] border border-[#3CDBC0]/30 rounded-2xl px-4 py-3 flex flex-col gap-1">
            {chips.length > 0 && (
              <p className="text-xs text-[#2AB5A0] leading-relaxed">
                <span className="font-black">{chips.map((c) => `#${c}`).join(' ')}</span>
                <span className="text-[#2AB5A0]/80"> — 네가 고른 취향도 반영됐어요</span>
              </p>
            )}
            {guest.excludeFoods.length > 0 && (
              <p className="text-xs text-[#2AB5A0] leading-relaxed">
                <span className="font-black">🚫 {guest.excludeFoods.join(', ')}</span>
                <span className="text-[#2AB5A0]/80"> 못 먹는 건 빼고 골랐어요</span>
              </p>
            )}
          </div>
        )}

        {/* 내 출발지 기준 개인 이동시간 — 게스트만의 값 */}
        {hasMyLoc && firstTransit && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-xs font-black text-[#2AB5A0]">
                <GpsPin className="text-[#3CDBC0]" />
                <span className="truncate max-w-[150px]">{guest.locName || '내 출발지'}에서</span>
              </span>
              <button
                onClick={() => setTransportMode((m) => (m === 'transit' ? 'driving' : 'transit'))}
                className="flex items-center gap-0.5 text-xs text-gray-400 active:text-gray-600 transition-colors"
              >
                <span>{transportMode === 'transit' ? '대중교통 예상' : '자차 이동'}</span>
                <span className="text-[10px]">▽</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">1차 {f.placeName}</span>
                <span className="text-gray-400">→ 약</span>
                <span className="font-black text-[#3CDBC0]">{firstTransit.formatted}</span>
              </div>
              {secondTransit && result.second && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">2차 {result.second.placeName}</span>
                  <span className="text-gray-400">→ 약</span>
                  <span className="font-black text-[#1A7A6E]">{secondTransit.formatted}</span>
                </div>
              )}
            </div>
            {firstTransit.source === 'estimate' && (
              <p className="text-[10px] text-gray-300 mt-1.5">* 직선거리 기반 예상치예요</p>
            )}
          </div>
        )}

        {/* 날씨 한 줄 (있을 때만) */}
        {result.weather && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-2.5 shadow-sm flex items-center gap-2 text-xs text-gray-600">
            <span>{result.weather.isRainy ? '🌧️' : '⛅'}</span>
            <span className="font-bold">{result.weather.temp}°</span>
            <span className="text-gray-400">{result.weather.description}</span>
          </div>
        )}

        {/* 1차 라벨 */}
        <div className="flex items-center justify-between mt-1">
          {hasSecond ? (
            <span className="text-xs font-black bg-[#3CDBC0] text-white px-3 py-1 rounded-full">
              1차 추천{result.purposeFirst ? ` ${result.purposeFirst}` : ''}
            </span>
          ) : <span />}
          <p className="text-[10px] text-gray-400 text-right">카드 터치 시 카카오맵에서 확인</p>
        </div>

        {/* 1차 카드 — 호스트와 동일한 신뢰 요소 */}
        <GuestPlaceCard
          place={f}
          gradient="linear-gradient(135deg, #3CDBC0 0%, #2AB5A0 100%)"
          shadowColor="shadow-[#3CDBC0]/25"
          wishRank="first"
        />

        {/* 코스 지도 — 1·2·3차 한 장에 */}
        {pins.length > 0 && f.lat != null && f.lng != null && f.lat !== 0 && (
          <MiniMap lat={f.lat} lng={f.lng} placeName={f.placeName} pins={pins} />
        )}

        {/* 2차 */}
        {result.second && (
          <>
            <div className="relative flex items-center py-1">
              <span className="text-xs font-black bg-[#1A7A6E] text-white px-3 py-1 rounded-full">
                2차 추천{result.purposeSecond ? ` ${result.purposeSecond}` : ''}
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-gray-400 font-medium pointer-events-none">
                <span className="text-[#3CDBC0] text-base leading-none">↓</span>
                <span>도보 약 {f.walkingToNext ? `${f.walkingToNext}분` : '10~15분'}</span>
              </div>
            </div>
            <GuestPlaceCard
              place={result.second}
              gradient="linear-gradient(135deg, #1A7A6E 0%, #155E54 100%)"
              shadowColor="shadow-[#1A7A6E]/25"
              wishRank="second"
            />
          </>
        )}

        {/* 3차 '이어서 갈 곳' — 덤 성격이라 흰 카드+좌측 보더로 경량화(호스트와 동일 위계) */}
        {result.third && (
          <>
            <div className="relative flex items-center py-1">
              <span className="text-xs font-black bg-[#0F4E46] text-white px-3 py-1 rounded-full">
                3차 · {result.thirdLabel ?? '이어서 가기'}
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-gray-400 font-medium pointer-events-none">
                <span className="text-[#3CDBC0] text-base leading-none">↓</span>
                <span>도보 약 {(hasSecond ? result.second?.walkingToNext : f.walkingToNext) ? `${hasSecond ? result.second?.walkingToNext : f.walkingToNext}분` : '5~10분'}</span>
              </div>
            </div>
            <a
              href={kakaoUrl(result.third)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white border border-gray-200 border-l-4 border-l-[#0F4E46] p-3.5 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3">
                {result.third.imageUrl && (
                  <img src={result.third.imageUrl} alt={result.third.placeName} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" loading="lazy" onError={hideOnError} />
                )}
                <div className="min-w-0 flex-1">
                  <span className="inline-block text-[11px] font-bold text-[#0F4E46] bg-[#0F4E46]/10 px-2 py-0.5 rounded-full mb-1">{result.third.category}</span>
                  <p className="text-base font-black text-gray-800 leading-tight">{result.third.placeName}</p>
                  {result.third.description && (
                    <p className="text-xs text-gray-500 leading-snug mt-0.5 break-keep">{result.third.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                    <GpsPin className="text-gray-400 shrink-0" />
                    <span className="truncate">{result.third.address || result.third.area}</span>
                  </div>
                </div>
              </div>
            </a>
          </>
        )}

        {/* 총무 발표 — 단톡방 스크린샷 감. 호스트 폰에서만 뜨던 재미 요소를 게스트도 */}
        {result.treasurer && (
          <div className="mt-1 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl shrink-0">🎲</span>
            <p className="text-sm font-black text-amber-800 leading-snug">
              {result.treasurer}에서 출발하는 분이 오늘의 총무 당첨!
            </p>
          </div>
        )}

        {/* 길찾기 + 캘린더 — 게스트가 바로 움직일 수 있게(호스트 화면엔 없는 개인 유틸) */}
        <div className="flex gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent('guest_directions_click', { device_id: getDeviceId(), place_key: `${f.placeName}|${f.address ?? ''}` })}
            className="flex-1 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center gap-1.5 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all active:scale-95"
          >
            <span className="text-base">🧭</span><span>길찾기</span>
          </a>
          <button
            onClick={() => { trackEvent('guest_calendar_add', { device_id: getDeviceId() }); downloadMeetingIcs(f.placeName, f.address || f.area || ''); }}
            className="flex-1 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center gap-1.5 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all active:scale-95"
          >
            <span className="text-base">📅</span><span>캘린더 저장</span>
          </button>
        </div>

        {/* 방문 인증 → 500P (추천→실제 방문 전환 씨앗) — 실제 방문자의 다수는 게스트다 */}
        <button
          onClick={() => { trackEvent('visit_cert_open', { device_id: getDeviceId(), place_key: `${f.placeName}|${f.address ?? ''}`, source: 'shared' }); setVisitPlace(f); }}
          className="w-full py-3 rounded-2xl bg-[#E8F8F5] border-2 border-[#3CDBC0]/40 text-[#2AB5A0] font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span className="text-lg">📍</span>
          <span>여기 방문 인증하고 500P 받기</span>
        </button>

        {/* 신규 유입 CTA — 결과로 신뢰를 준 뒤 마지막에. "다음엔 내가 모임 만들기" 프레이밍 */}
        <a
          href="/app?ref=grp"
          className="block w-full mt-2 py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base text-center shadow-lg shadow-[#3CDBC0]/30 active:scale-95 transition-transform"
        >
          🌿 다음엔 내가 모임 만들어보기 →
        </a>
      </div>

      {/* 방문 인증 모달 — 게스트 surface는 'shared' */}
      {visitPlace && (
        <VisitCertModal
          place={visitPlace}
          source="shared"
          onClose={() => setVisitPlace(null)}
          onCertified={() => setVisitPlace(null)}
        />
      )}
    </div>
  );
}

// 게스트용 리치 장소 카드 — 호스트 PlaceCard와 같은 신뢰 요소(사진·카테고리·이유·적합도·해시태그·영업)를 담는다.
// 카드 탭 = 카카오맵 이동. 찜은 카드 위에 얹되 stopPropagation으로 지도 이동과 분리(호스트와 동일 패턴).
function GuestPlaceCard({
  place, gradient, shadowColor, wishRank,
}: {
  place: GroupResultPlace;
  gradient: string;
  shadowColor: string;
  wishRank: 'first' | 'second';
}) {
  const openStatus = parseOpenStatus(place.openingHours ?? undefined);
  const cong = congestionInfo(place.congestionLevel ?? undefined);
  const open = () => window.open(kakaoUrl(place), '_blank');
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${place.placeName} 카카오맵에서 열기`}
      className={`rounded-2xl text-white overflow-hidden cursor-pointer active:scale-[0.99] transition-transform shadow-xl outline-none ${shadowColor}`}
      style={{ background: gradient }}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
    >
      {place.imageUrl && (
        <img src={place.imageUrl} alt={place.placeName} className="w-full h-36 object-cover" loading="lazy" onError={hideOnError} />
      )}
      <div className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-black bg-white/30 text-white px-3 py-0.5 rounded-full border border-white/30 truncate">
            {place.category}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {place.congestionLevel && (
              <div className="flex items-center gap-1">
                <span className={`${cong.dot} text-xs leading-none`}>●</span>
                <span className="text-xs text-white/80">{cong.label}</span>
              </div>
            )}
            <WishlistButton place={place} rank={wishRank} source="shared" tone="onDark" />
          </div>
        </div>

        <h2 className="text-xl font-black leading-tight mb-1">{place.placeName}</h2>

        {place.description && (
          <p className="text-sm text-white/90 leading-snug mb-2 font-medium">{place.description}</p>
        )}

        <FitScoreBar score={place.fitScore ?? undefined} className="mb-2" />

        {place.vibeTags && place.vibeTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {place.vibeTags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-white/80 bg-white/15 px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <GpsPin className="opacity-80 shrink-0" />
            <span className="leading-tight">{place.address || place.area}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/80 flex-wrap">
            {place.priceRange && (
              <span className="flex items-center gap-1"><span>💰</span><span>{place.priceRange}</span></span>
            )}
            {place.openingHours && (
              <span className="flex items-center gap-1">
                <span>🕐</span><span>{place.openingHours}</span>
                {openStatus && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${openStatus.isOpen ? 'bg-green-400 text-white' : 'bg-red-400/80 text-white'}`}>
                    {openStatus.label}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
