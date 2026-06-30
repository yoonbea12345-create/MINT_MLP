import { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import LocationInput from '../components/LocationInput';
import type { LocationEntry } from '../components/LocationInput';
import PurposeSelect from '../components/PurposeSelect';
import type { PurposeValue } from '../components/PurposeSelect';
import VibeSelect from '../components/VibeSelect';
import type { VibeState } from '../components/VibeSelect';
import { VIBE_KEY_TO_LABEL } from '../components/VibeSelect';
import MeetingLocationSelect from '../components/MeetingLocationSelect';
import type { MeetingLocation } from '../components/MeetingLocationSelect';
import ResultCard from '../components/ResultCard';
import RetryWeightModal from '../components/RetryWeightModal';
import type { VibeWeights } from '../components/RetryWeightModal';
import Reserve from './Reserve';
import { PRESET_REGIONS, findNearestAreas, findBalancedAreas } from '../services/midpoint';
import type { PresetRegion, Coordinates } from '../services/midpoint';
import { getMultiAreaCongestion } from '../services/seoulData';
import { getAIRecommendation } from '../services/ai';
import type { PlaceRecommendation, UserInput } from '../services/ai';
import { trackSessionDuration, trackEvent } from '../utils/analytics';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'result' | 'reserve';
type AppMode = 'mode-select' | 'solo' | 'group-setup' | 'group-waiting' | 'group-ready'; // 'mode-select' = step 0 of flow

interface GroupMember {
  member_name: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  purpose_first?: string | null;
  purpose_second?: string | null;
  vibe_atmosphere: string | null;
  vibe_budget: string | null;
  vibe_keywords?: string[];
}

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

function aggregatePurpose(members: GroupMember[]): PurposeValue | null {
  const fc: Record<string, number> = {};
  const sc: Record<string, number> = {};
  members.forEach((m) => {
    if (m.purpose_first) fc[m.purpose_first] = (fc[m.purpose_first] || 0) + 1;
    if (m.purpose_second) sc[m.purpose_second] = (sc[m.purpose_second] || 0) + 1;
  });
  const topFirst = Object.entries(fc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topSecond = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '없음';
  if (!topFirst) return null;
  const toRaw = (v: string | null): '밥' | '술' | '카페' | '기타' | null =>
    ['밥', '술', '카페'].includes(v ?? '') ? (v as '밥' | '술' | '카페') : v ? '기타' : null;
  return {
    first: topFirst,
    firstRaw: toRaw(topFirst),
    second: topSecond,
    secondRaw: topSecond === '없음' ? '없음' : toRaw(topSecond),
    relation: null,
    occasion: null,
  };
}

function aggregateVibe(members: GroupMember[]): VibeState {
  const counts: Record<string, number> = {};
  members.forEach((m) => {
    if (m.vibe_atmosphere) counts[m.vibe_atmosphere] = (counts[m.vibe_atmosphere] || 0) + 1;
  });
  const topAtm = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return topAtm ? { 분위기: { first: topAtm, second: null } } : {};
}

const LOADING_MESSAGES = [
  '🗺️ 서울 구석구석 탐색 중...',
  '👥 우리 팀 취향 분석 중...',
  '🔍 딱 맞는 곳 걸러내는 중...',
  '💰 가격대 & 영업시간 체크 중...',
  '✨ 오늘의 코스 완성 직전!',
];

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>('mode-select');
  const [groupSize, setGroupSize] = useState<'2명' | '3~4명' | '5명 이상'>('2명');
  const [customOccasion, setCustomOccasion] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expectedCount, setExpectedCount] = useState<number>(3);
  const [groupHasSecond, setGroupHasSecond] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<View>('steps');
  const [step, setStep] = useState<Step>(0);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [purpose, setPurpose] = useState<PurposeValue | null>(null);
  const [vibe, setVibe] = useState<VibeState>({});
  const [budget, setBudget] = useState<string | null>(null);
  const [meetingLocation, setMeetingLocation] = useState<MeetingLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [result, setResult] = useState<PlaceRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [vibeCustom, setVibeCustom] = useState<Record<string, string>>({});
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [midpointData, setMidpointData] = useState<{
    midpoint: Coordinates;
    areaName: string;
    nearestAreas: string[];
  } | null>(null);
  const [resultTravelTimes, setResultTravelTimes] = useState<{
    first: { transit: TravelResult[]; driving: TravelResult[] };
    second: { transit: TravelResult[]; driving: TravelResult[] } | null;
  } | null>(null);
  const [treasurer, setTreasurer] = useState<string | null>(null);
  const [compromiseMessage, setCompromiseMessage] = useState<string | null>(null);
  const [showCompromiseToast, setShowCompromiseToast] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('mintSessionStart')) {
      sessionStorage.setItem('mintSessionStart', Date.now().toString());
    }
  }, []);


  useEffect(() => {
    if (view === 'result') {
      const startStr = sessionStorage.getItem('mintSessionStart');
      if (startStr) {
        const seconds = Math.round((Date.now() - parseInt(startStr)) / 1000);
        trackSessionDuration(seconds);
        sessionStorage.removeItem('mintSessionStart');
      }
    }
  }, [view]);

  // 그룹 대기 화면 폴링
  useEffect(() => {
    if (appMode !== 'group-waiting' || !sessionId) return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/session-get?id=${encodeURIComponent(sessionId!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (typeof data.expected_count === 'number') setExpectedCount(data.expected_count);
        if (Array.isArray(data.members)) setGroupMembers(data.members);
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
  }, [appMode, sessionId]);

  async function handleCreateSession() {
    setCreatingSession(true);
    setGroupError(null);
    try {
      const res = await fetch('/api/session-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_count: expectedCount, has_second: groupHasSecond }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '링크 생성에 실패했어요. 다시 시도해주세요.');
      }
      const data = await res.json();
      setSessionId(data.id);
      setGroupMembers([]);
      setAppMode('group-waiting');
    } catch (e) {
      setGroupError((e as Error).message);
    } finally {
      setCreatingSession(false);
    }
  }

  function handleCopyLink() {
    if (!sessionId) return;
    const link = `${window.location.origin}/join?id=${sessionId}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleStartGroupRecommend() {
    if (groupMembers.length < 2) return;
    const groupLocations: LocationEntry[] = groupMembers.map((m) => ({
      name: m.member_name,
      lat: m.location_lat,
      lng: m.location_lng,
    }));
    setLocations(groupLocations);
    setVibe(aggregateVibe(groupMembers));
    // 멤버들의 목적 다수결 집계
    const aggregated = aggregatePurpose(groupMembers);
    if (aggregated) setPurpose(aggregated);
    // 멤버들이 선택한 키워드 합집합
    const memberKeywords = Array.from(new Set(groupMembers.flatMap((m) => m.vibe_keywords ?? [])));
    setKeywords(memberKeywords);
    setStep(3);
    setView('steps');
    setAppMode('group-ready');
  }

  function canNext(): boolean {
    if (step === 0) return appMode === 'solo' && !!purpose?.first;
    if (step === 1) return true; // 관계·특별한날은 선택사항
    if (step === 2) return meetingLocation !== null && (meetingLocation.type === 'manual' || locations.length >= 2);
    return false;
  }

  function handleNext() {
    setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    const minStep = appMode === 'group-ready' ? 3 : 0;
    if (step > minStep) setStep((s) => (s - 1) as Step);
  }

  function applyCompromiseMessage(msg?: string) {
    if (msg) {
      setCompromiseMessage(msg);
      setShowCompromiseToast(true);
      setTimeout(() => setShowCompromiseToast(false), 5000);
    }
  }

  function handleConfirmMeetingLocation(loc: MeetingLocation) {
    if (loc.type === 'auto') {
      handleMidpointSelect();
    } else {
      const region = PRESET_REGIONS.find((r) => r.id === loc.regionId);
      if (region) {
        handleMidpointSelect(region);
      } else {
        const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
        const coords = validLocs.map((l) => ({ lat: l.lat!, lng: l.lng! }));
        const balanced = findBalancedAreas(coords.length >= 2 ? coords : [{ lat: 37.5665, lng: 126.978 }]);
        const nearestAreas = findNearestAreas(balanced.midpoint, 3);
        setMidpointData({ midpoint: balanced.midpoint, areaName: loc.area, nearestAreas });
        setResultTravelTimes(null);
        applyCompromiseMessage(balanced.compromiseMessage);
        handleRecommend(balanced.midpoint, nearestAreas, validLocs);
      }
    }
  }

  function handleMidpointSelect(presetRegion?: PresetRegion) {
    let midpoint: Coordinates;
    let areaName: string;
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);

    if (presetRegion) {
      midpoint = presetRegion.midpoint;
      areaName = presetRegion.label;
    } else {
      const coords = validLocs.map((l) => ({ lat: l.lat!, lng: l.lng! }));
      const balanced = findBalancedAreas(coords.length >= 2 ? coords : [{ lat: 37.5665, lng: 126.978 }]);
      midpoint = balanced.midpoint;
      areaName = balanced.areaName;
      applyCompromiseMessage(balanced.compromiseMessage);
    }

    const nearestAreas = findNearestAreas(midpoint, 3);
    setMidpointData({ midpoint, areaName, nearestAreas });
    setResultTravelTimes(null);
    handleRecommend(midpoint, nearestAreas, validLocs);
  }

  async function handleRecommend(
    midpoint: Coordinates,
    nearestAreas: string[],
    validLocs: LocationEntry[],
    vibeWeights?: Record<string, number>,
  ) {
    setLoading(true);
    setLoadingProgress(0);
    setError(null);
    setResult(null);

    const msgInterval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
    }, 1800);

    let aiProgressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // 실제 마일스톤 1: 혼잡도 데이터 fetch
      setLoadingProgress(5);
      const congestionData = await getMultiAreaCongestion(nearestAreas);
      setLoadingProgress(25); // 실제 완료

      const vibeFirst: string[] = [];
      const vibeSecond: string[] = [];
      Object.values(vibe).forEach((g) => {
        if (g.first) vibeFirst.push(VIBE_KEY_TO_LABEL[g.first] ?? g.first);
        if (g.second) vibeSecond.push(VIBE_KEY_TO_LABEL[g.second] ?? g.second);
      });

      const input: UserInput = {
        locations,
        groupSize: appMode === 'group-ready' ? (locations.length >= 5 ? '5명 이상' : locations.length >= 3 ? '3~4명' : '2명') : groupSize,
        purpose: { first: purpose!.first!, second: purpose!.second ?? null },
        vibe: { first: vibeFirst, second: vibeSecond },
        relation: purpose?.relation ?? null,
        occasion: purpose?.occasion ?? null,
        budget,
        ...(vibeWeights && Object.keys(vibeWeights).length > 0 ? { vibeWeights } : {}),
        ...((() => {
          const allKw = [...keywords, ...Object.values(vibeCustom).filter(Boolean)];
          return allKw.length > 0 ? { keywords: allKw } : {};
        })()),
      };

      // AI 호출 동안 25→90% 타이머 (Claude 응답이 단일 fetch라 내부 진행도 불가)
      aiProgressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          // 초반엔 빠르게, 90% 가까울수록 느리게
          const gap = 90 - prev;
          return prev + gap * 0.04;
        });
      }, 250);

      // 실제 마일스톤 2: AI 추천 완료
      const recommendation = await getAIRecommendation(input, midpoint, congestionData);
      clearInterval(aiProgressInterval);
      setLoadingProgress(100); // 실제 완료

      setResult(recommendation);

      const namedLocs = locations.filter((l) => l.name);
      if (namedLocs.length > 0) {
        const picked = namedLocs[Math.floor(Math.random() * namedLocs.length)];
        setTreasurer(picked.name);
      }
      setView('result');

      if (validLocs.length >= 2) {
        const firstPlace = recommendation[0];
        const secondPlace = recommendation[1];
        const firstDest = firstPlace?.lat && firstPlace.lat !== 0
          ? { lat: firstPlace.lat, lng: firstPlace.lng! }
          : midpoint;
        const secondDest = secondPlace?.lat && secondPlace.lat !== 0
          ? { lat: secondPlace.lat, lng: secondPlace.lng! }
          : undefined;
        fetch('/api/travel-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origins: validLocs.map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name })),
            destinations: { first: firstDest, ...(secondDest ? { second: secondDest } : {}) },
          }),
        })
          .then((r) => r.json())
          .then((data) => setResultTravelTimes(data))
          .catch(() => setResultTravelTimes(null));
      } else {
        setResultTravelTimes(null);
      }
    } catch (e) {
      if (aiProgressInterval) clearInterval(aiProgressInterval);
      setError((e as Error).message || '추천을 가져오지 못했어요. 다시 시도해주세요.');
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
      setLoadingProgress(0);
    }
  }

  function handleRetry() {
    setShowRetryModal(true);
  }

  function handleRetryImmediate() {
    setShowRetryModal(false);
    if (!midpointData) return;
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    setTreasurer(null);
    setResultTravelTimes(null);
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs);
  }

  function handleRetryWithWeights(weights: VibeWeights) {
    setShowRetryModal(false);
    if (!midpointData) return;
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    const labeledWeights: Record<string, number> = {};
    Object.entries(weights).forEach(([k, v]) => {
      if (k.startsWith('budget:')) {
        labeledWeights[`예산 ${k.slice(7)}`] = v;
      } else {
        labeledWeights[VIBE_KEY_TO_LABEL[k] ?? k] = v;
      }
    });
    setTreasurer(null);
    setResultTravelTimes(null);
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, labeledWeights);
  }

  function handleReject(reason: 'expensive' | 'far' | 'vibe') {
    if (!midpointData) return;
    trackEvent(`reject_${reason}`);
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    setTreasurer(null);
    setResultTravelTimes(null);

    // 거절 이유를 labeled weights로 변환해서 AI에 전달
    const rejectWeights: Record<string, number> = {};
    if (reason === 'expensive') {
      // 현재 vibe 유지 + 저렴한 힌트
      Object.values(vibe).forEach((g) => {
        if (g.first) rejectWeights[VIBE_KEY_TO_LABEL[g.first] ?? g.first] = 3;
        if (g.second) rejectWeights[VIBE_KEY_TO_LABEL[g.second] ?? g.second] = 3;
      });
      rejectWeights['저렴한'] = 5;
      rejectWeights['가성비'] = 5;
    } else if (reason === 'far') {
      // 현재 vibe 유지 + 접근성 힌트
      Object.values(vibe).forEach((g) => {
        if (g.first) rejectWeights[VIBE_KEY_TO_LABEL[g.first] ?? g.first] = 3;
        if (g.second) rejectWeights[VIBE_KEY_TO_LABEL[g.second] ?? g.second] = 3;
      });
      rejectWeights['가까운'] = 5;
      rejectWeights['접근하기 쉬운'] = 5;
    } else {
      // vibe 거절: 현재 분위기 weight 낮추고 다른 분위기 탐색
      Object.values(vibe).forEach((g) => {
        if (g.first) rejectWeights[VIBE_KEY_TO_LABEL[g.first] ?? g.first] = 1;
        if (g.second) rejectWeights[VIBE_KEY_TO_LABEL[g.second] ?? g.second] = 1;
      });
      rejectWeights['새로운 분위기'] = 5;
    }

    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, rejectWeights);
  }

  function handleShare() {
    if (!result || result.length === 0) return;
    trackEvent('kakao_share');
    const primary = result[0];
    const mlpUrl = window.location.origin;
    const hasSecond = !!(purpose?.second && purpose.second !== '없음');
    const secondPlace = hasSecond && result.length > 1 ? result[1] : null;

    // SharedResult URL — 수신자가 링크 누르면 결과 카드로 바로 이동
    const sharedData = {
      placeName: primary.placeName,
      category: primary.category,
      description: primary.description,
      vibeTags: primary.vibeTags,
      address: primary.address,
      area: primary.area,
      priceRange: primary.priceRange,
      congestionLevel: primary.congestionLevel,
      lat: primary.lat,
      lng: primary.lng,
      kakaoPlaceUrl: primary.kakaoPlaceUrl,
    };
    const sharedUrl = `${mlpUrl}/shared?data=${encodeURIComponent(JSON.stringify(sharedData))}`;

    const mapUrl = (p: typeof primary) =>
      p.lat && p.lng
        ? `https://map.kakao.com/link/to/${encodeURIComponent(p.placeName)},${p.lat},${p.lng}`
        : `https://map.kakao.com/link/search/${encodeURIComponent(p.placeName)}`;

    const primaryMapUrl = mapUrl(primary);
    const secondMapUrl = secondPlace ? mapUrl(secondPlace) : null;

    if (window.Kakao?.Share) {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(import.meta.env.VITE_KAKAO_JS_API_KEY);
      }

      const descLines = hasSecond && secondPlace
        ? [
            `1차(${purpose!.first}): ${primary.placeName}`,
            `2차(${purpose!.second}): ${secondPlace.placeName}`,
            ...(treasurer ? [`💰 ${treasurer}에서 출발하는 분이 오늘의 총무!`] : []),
          ]
        : [
            primary.description,
            `📍 ${primary.address || primary.area} · 💰 ${primary.priceRange || ''}`,
            ...(treasurer ? [`💰 ${treasurer}에서 출발하는 분이 오늘의 총무!`] : []),
          ];

      const buttons: object[] = [
        { title: '추천 결과 보기', link: { mobileWebUrl: sharedUrl, webUrl: sharedUrl } },
      ];
      if (secondMapUrl) {
        buttons.push({ title: `2차(${purpose!.second}) 카카오맵 보기`, link: { mobileWebUrl: secondMapUrl, webUrl: secondMapUrl } });
      } else {
        buttons.push({ title: '카카오맵에서 보기', link: { mobileWebUrl: primaryMapUrl, webUrl: primaryMapUrl } });
      }

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🍀 MINT 추천${hasSecond ? ` | 1차(${purpose!.first}) · 2차(${purpose!.second})` : ` | ${primary.placeName}`}`,
          description: descLines.join('\n'),
          imageUrl: `${mlpUrl}/image/step5.png`,
          link: { mobileWebUrl: sharedUrl, webUrl: sharedUrl },
        },
        buttons,
      });
      return;
    }

    // 카카오 SDK 없을 때 텍스트 공유
    const lines = [
      `🍀 MINT 추천 — ${primary.placeName}`,
      '',
      primary.description,
      '',
      ...(hasSecond && secondPlace
        ? [
            `1차(${purpose!.first}): ${primary.placeName}`,
            `  카카오맵 → ${primaryMapUrl}`,
            '',
            `2차(${purpose!.second}): ${secondPlace.placeName}`,
            `  카카오맵 → ${secondMapUrl}`,
          ]
        : [
            `📍 ${primary.address || primary.area}`,
            `  카카오맵 → ${primaryMapUrl}`,
          ]),
      ...(treasurer ? ['', `💰 ${treasurer}에서 출발하는 분이 오늘의 총무 담당!`] : []),
      '',
      '👇 결과 직접 확인',
      sharedUrl,
    ];

    const shareText = lines.join('\n');
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard?.writeText(shareText).then(() => alert('공유 내용이 복사되었습니다!'));
    }
  }

  // 그룹 세션 생성 화면
  if (appMode === 'group-setup') {
    return (
      <div className="min-h-[100dvh] bg-[#F5FBF8] flex flex-col">
        <div className="text-center pt-8 px-4">
          <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
          <h2 className="text-xl font-black text-gray-800 text-center mb-1">모임 인원이 몇 명인가요?</h2>
          <p className="text-sm text-gray-400 text-center mb-7">호스트 포함 전체 인원을 골라주세요</p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setExpectedCount(n)}
                className={`py-4 rounded-2xl font-black text-base transition-all active:scale-95 border-2 ${
                  expectedCount === n
                    ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {n === 6 ? '6명+' : `${n}명`}
              </button>
            ))}
          </div>

          {/* 코스 타입 */}
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 text-center mb-3">코스 선택</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGroupHasSecond(false)}
                className={`py-4 rounded-2xl font-black text-sm transition-all active:scale-95 border-2 flex flex-col items-center gap-1 ${
                  !groupHasSecond
                    ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <span className="text-xl">🍽️</span>
                <span>1차만</span>
              </button>
              <button
                onClick={() => setGroupHasSecond(true)}
                className={`py-4 rounded-2xl font-black text-sm transition-all active:scale-95 border-2 flex flex-col items-center gap-1 ${
                  groupHasSecond
                    ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <span className="text-xl">🍻</span>
                <span>1차+2차</span>
              </button>
            </div>
          </div>

          {groupError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
              {groupError}
            </div>
          )}

          <button
            onClick={handleCreateSession}
            disabled={creatingSession}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
              creatingSession
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
            }`}
          >
            {creatingSession ? '생성 중...' : '링크 생성하기'}
          </button>
          <button
            onClick={() => {
              setAppMode('mode-select');
              setGroupError(null);
            }}
            className="w-full py-3 mt-3 text-sm text-gray-400 hover:text-gray-600"
          >
            ← 뒤로
          </button>
        </div>
      </div>
    );
  }

  // 그룹 대기 화면
  if (appMode === 'group-waiting') {
    const shareLink = sessionId ? `${window.location.origin}/join?id=${sessionId}` : '';
    const ready = groupMembers.length >= 2;
    const allVoted = groupMembers.length >= expectedCount && groupMembers.length > 0;
    return (
      <div className="min-h-[100dvh] bg-[#F5FBF8] flex flex-col">
        <div className="text-center pt-8 px-4">
          <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
        </div>
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full pt-6 pb-10">
          <h2 className="text-xl font-black text-gray-800 text-center mb-1">친구들을 초대해요</h2>
          <p className="text-sm text-gray-400 text-center mb-6">링크를 공유하면 각자 출발지를 입력해요</p>

          {/* 공유 링크 */}
          <div className="bg-white shadow-sm rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-400 mb-2">공유 링크</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-gray-700 truncate">{shareLink}</p>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#3CDBC0] text-white text-sm font-bold transition-all active:scale-95 hover:bg-[#2AB5A0]"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>

          {/* 호스트 바로 참여 버튼 */}
          <button
            onClick={() => { window.location.href = shareLink; }}
            className="w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 mb-5 bg-[#E8F8F5] text-[#2AB5A0] border-2 border-[#3CDBC0]/40 hover:bg-[#d4f3ee]"
          >
            나도 참여하기 →
          </button>

          {/* 진행률 + 슬롯 */}
          <div className="bg-white shadow-sm rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">입력 현황</p>
              <p className="text-lg font-black text-[#2AB5A0]">
                {groupMembers.length}
                <span className="text-gray-300 font-bold"> / {expectedCount}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: expectedCount }).map((_, i) => {
                const member = groupMembers[i];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      member ? 'bg-[#E8F8F5]' : 'bg-gray-50 border border-dashed border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
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

          <div className="flex-1" />

          {allVoted && (
            <div className="mb-3 p-4 bg-[#E8F8F5] border border-[#3CDBC0]/40 rounded-2xl text-center">
              <p className="text-base font-black text-[#2AB5A0]">🎉 전원 완료!</p>
              <p className="text-xs text-[#2AB5A0]/70 mt-0.5">모두의 취향이 모였어요. 지금 바로 추천받아요!</p>
            </div>
          )}

          <button
            onClick={handleStartGroupRecommend}
            disabled={!ready}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
              allVoted
                ? 'bg-[#2AB5A0] text-white shadow-xl shadow-[#3CDBC0]/40 hover:bg-[#1E9E8C] animate-pulse'
                : ready
                ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {allVoted ? '✨ 지금 바로 장소 추천받기' : '장소 추천받기'}
          </button>
          {!ready && (
            <p className="text-xs text-gray-400 text-center mt-2">최소 2명이 입력하면 시작할 수 있어요</p>
          )}
        </div>
      </div>
    );
  }

  // 로딩
  if (loading) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const offset = circ - (loadingProgress / 100) * circ;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5FBF8] px-4 gap-6">
        <p className="text-[#3CDBC0] font-black text-2xl tracking-widest">MINT</p>

        {/* 원형 프로그레스 링 */}
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="#E8F8F5" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={r}
              fill="none"
              stroke="#3CDBC0"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-all duration-300 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black text-[#2AB5A0]">{Math.round(loadingProgress)}%</span>
          </div>
        </div>

        {/* 메시지 */}
        <div className="text-center">
          <p className="text-base font-bold text-[#2AB5A0]">{LOADING_MESSAGES[loadingMsg]}</p>
          <p className="text-xs text-gray-400 mt-1">AI가 서울을 탐색하고 있어요</p>
        </div>
      </div>
    );
  }

  // 예약 페이지
  if (view === 'reserve' && result && result.length > 0) {
    return (
      <Reserve
        placeName={result[0].placeName}
        address={result[0].address || result[0].area}
        openingHours={result[0].openingHours ?? ''}
        onBack={() => setView('result')}
      />
    );
  }

  // 추천 결과
  if (view === 'result' && result && result.length > 0) {
    return (
      <div className="min-h-screen bg-[#F5FBF8]">
        {/* 중간 지점 보완 토스트 */}
        {compromiseMessage && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm transition-all duration-500 ${showCompromiseToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
            <div className="bg-[#1A7A6E] text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">📍</span>
              <span className="leading-snug">{compromiseMessage}</span>
            </div>
          </div>
        )}
        <div className="max-w-md mx-auto px-4 pb-6 pt-2">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                setResult(null);
                setView('steps');
                setStep(0);
                setAppMode('mode-select');
                setSessionId(null);
                setGroupMembers([]);
                setResultTravelTimes(null);
                setLocations([]);
                setPurpose(null);
                setVibe({});
                setBudget(null);
                setKeywords([]);
                setVibeCustom({});
                setMeetingLocation(null);
                setMidpointData(null);
                setTreasurer(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 처음으로
            </button>
            <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
          </div>

          <ResultCard
            results={result}
            travelTimes={resultTravelTimes}
            midpointAreaName={midpointData?.areaName}
            purpose={purpose?.first ? { first: purpose.first, second: purpose.second ?? null } : undefined}
            treasurer={treasurer}
            onRetry={handleRetry}
            onShare={handleShare}
            onReserve={() => setView('reserve')}
            onReject={handleReject}
          />

          {showRetryModal && (
            <RetryWeightModal
              vibe={vibe}
              budget={budget}
              onRetryImmediate={handleRetryImmediate}
              onRetryWithWeights={handleRetryWithWeights}
              onClose={() => setShowRetryModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // 입력 플로우
  return (
    <div className="h-[100dvh] bg-[#F5FBF8] overflow-hidden">
      <div className="h-full max-w-md mx-auto flex flex-col">

        {/* 헤더 */}
        <div className="flex-shrink-0 text-center pt-4 px-4 relative">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2AB5A0] transition-colors p-1 text-lg"
          >
            ←
          </button>
          <h1
            className="text-2xl font-black text-[#2AB5A0] tracking-tight cursor-pointer"
            onClick={() => { window.location.href = '/'; }}
          >
            MINT
          </h1>
        </div>

        {/* 스텝 프로그레스 */}
        <div className="flex-shrink-0">
          <StepProgress current={step} total={4} />
        </div>

        {/* 스텝 제목 */}
        <div className="flex-shrink-0 text-center px-4 pt-2 pb-0">
          <h2 className="text-xl font-black text-gray-800">
            {step === 0 && '어떤 모임인가요?'}
            {step === 1 && '누구와 함께하나요?'}
            {step === 2 && '어디서 만날까요?'}
            {step === 3 && '원하는 분위기를 골라봐요'}
          </h2>
          {step === 1 && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">모두 선택사항 · 선택할수록 추천이 정확해져요</p>
          )}
          {step === 2 && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">원하는 동네 선택 · 또는 중간지점을 AI에게 맡겨요</p>
          )}
          {step === 3 && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">최소 1개 이상 선택 · 많이 고를수록 추천이 정확해져요</p>
          )}
        </div>

        {/* 콘텐츠 */}
        <div key={step} className="flex-1 min-h-0 overflow-y-auto animate-fade-in-up">

          {/* Step 0: 모임 유형 + 목적 */}
          {step === 0 && (
            <div className="px-4 py-3 flex flex-col gap-5">
              {/* 혼자 / 그룹 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAppMode('solo')}
                  className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                    appMode === 'solo'
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-2xl">🙋</span>
                  <span className={`text-sm font-black ${appMode === 'solo' ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>혼자 정할게요</span>
                  <span className="text-[10px] text-gray-400">내가 직접 입력</span>
                </button>
                <button
                  onClick={() => setAppMode('group-setup')}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-[#3CDBC0]/50 transition-all active:scale-[0.97]"
                >
                  <span className="text-2xl">👥</span>
                  <span className="text-sm font-black text-gray-700">다같이 정할게요</span>
                  <span className="text-[10px] text-gray-400">링크로 각자 입력 →</span>
                </button>
              </div>

              {/* 인원수 — solo 선택 시 활성화 */}
              {appMode === 'solo' && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">모임 인원수</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['2명', '3~4명', '5명 이상'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setGroupSize(size)}
                        className={`flex items-center justify-center h-12 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                          groupSize === size
                            ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 목적 — solo 선택 시 활성화 */}
              <PurposeSelect
                value={purpose ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null }}
                onChange={setPurpose}
              />
            </div>
          )}

          {/* Step 1: 관계 + 특별한날 */}
          {step === 1 && (() => {
            const RELATION_OPTIONS = [
              { value: '친구들', emoji: '👥' },
              { value: '연인', emoji: '💑' },
              { value: '가족', emoji: '👨‍👩‍👧' },
              { value: '직장동료', emoji: '💼' },
            ];
            const OCCASION_OPTIONS = [
              { value: '생일', emoji: '🎂' },
              { value: '기념일', emoji: '💕' },
              { value: '소개팅', emoji: '💫' },
              { value: '축하', emoji: '🎉' },
              { value: '위로', emoji: '🤗' },
            ];
            const curRelation = purpose?.relation ?? null;
            const curOccasion = purpose?.occasion ?? null;
            function toggleRel(v: string) {
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                return { ...base, relation: base.relation === v ? null : v };
              });
            }
            function toggleOcc(v: string) {
              setCustomOccasion('');
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                return { ...base, occasion: base.occasion === v ? null : v };
              });
            }
            function handleCustomOccasion(text: string) {
              setCustomOccasion(text);
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                return { ...base, occasion: text.trim() ? text : null };
              });
            }
            const isPresetOccasion = OCCASION_OPTIONS.some((o) => o.value === curOccasion);
            return (
              <div className="px-4 flex flex-col gap-5 pt-3 pb-4">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">오늘 모임은요?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {RELATION_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => toggleRel(opt.value)}
                        className={`flex flex-col items-center justify-center gap-1 h-[64px] rounded-xl border-2 transition-all active:scale-[0.97] ${curRelation === opt.value ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
                        <span className="text-lg leading-none">{opt.emoji}</span>
                        <span className={`text-[11px] font-bold leading-none ${curRelation === opt.value ? 'text-[#2AB5A0]' : 'text-gray-600'}`}>{opt.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">특별한 날인가요?</p>
                  <div className="grid grid-cols-5 gap-2">
                    {OCCASION_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => toggleOcc(opt.value)}
                        className={`flex flex-col items-center justify-center gap-1 h-[64px] rounded-xl border-2 transition-all active:scale-[0.97] ${curOccasion === opt.value ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
                        <span className="text-base leading-none">{opt.emoji}</span>
                        <span className={`text-[11px] font-bold leading-none ${curOccasion === opt.value ? 'text-[#2AB5A0]' : 'text-gray-600'}`}>{opt.value}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customOccasion}
                    onChange={(e) => handleCustomOccasion(e.target.value)}
                    placeholder="직접 입력 (예: 졸업식, 취직 축하)"
                    className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors mt-2 ${
                      customOccasion && !isPresetOccasion ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200'
                    }`}
                  />
                </div>
              </div>
            );
          })()}

          {/* Step 2: 만날 장소 선택 */}
          {step === 2 && (
            <div className="pb-4 flex flex-col gap-3">
              <MeetingLocationSelect value={meetingLocation} onSelect={setMeetingLocation} />

              {/* 중간지점(자동) 모드: 출발지 입력 */}
              {meetingLocation?.type === 'auto' && (
                <div className="animate-fade-in-up border-t border-gray-100 pt-2 px-4">
                  <LocationInput locations={locations} onChange={setLocations} />
                </div>
              )}
            </div>
          )}

          {/* Step 3: 분위기 */}
          {step === 3 && (
            <VibeSelect
              value={vibe}
              onChange={setVibe}
              purpose={purpose ? { first: purpose.first, second: purpose.second } : undefined}
              keywords={keywords}
              onKeywordsChange={setKeywords}
            />
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex-shrink-0 mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex-shrink-0 px-4 pt-2 pb-8 flex flex-col gap-2">
          {step < 3 ? (
            <>
              <div className="flex gap-3">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="w-14 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-lg hover:border-gray-300 transition-all active:scale-95"
                  >
                    ←
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!canNext()}
                  className={`flex-1 py-4 rounded-2xl font-black text-base transition-all duration-300 active:scale-95 ${
                    canNext()
                      ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  다음
                </button>
              </div>
              {step === 0 && !canNext() && (
                <p className="text-xs text-gray-400 text-center">혼자 정하기 선택 후 1차 목적을 골라주세요</p>
              )}
            </>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="w-14 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-lg hover:border-gray-300 transition-all active:scale-95"
              >
                ←
              </button>
              <button
                onClick={() => {
                  if (meetingLocation) handleConfirmMeetingLocation(meetingLocation);
                }}
                className="flex-1 py-4 rounded-2xl font-black text-base bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-all active:scale-95"
              >
                ✨ 장소 추천받기
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
