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
import Reserve from './Reserve';
import { PRESET_REGIONS, findNearestAreas, findBalancedAreas } from '../services/midpoint';
import type { PresetRegion, Coordinates } from '../services/midpoint';
import { getMultiAreaCongestion } from '../services/seoulData';
import { getAIRecommendation } from '../services/ai';
import type { PlaceRecommendation, UserInput } from '../services/ai';
import { trackSessionDuration } from '../utils/analytics';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'result' | 'reserve';

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

const LOADING_MESSAGES = [
  '🗺️ 서울 구석구석 탐색 중...',
  '👥 우리 팀 취향 분석 중...',
  '🔍 딱 맞는 곳 걸러내는 중...',
  '💰 가격대 & 영업시간 체크 중...',
  '✨ 오늘의 코스 완성 직전!',
];

function deriveGroupSize(locationCount: number): UserInput['groupSize'] {
  if (locationCount >= 5) return '5명 이상';
  if (locationCount >= 3) return '3~4명';
  return '2명';
}

export default function Home() {
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

  function canNext(): boolean {
    if (step === 0) return locations.length >= 2;
    if (step === 1) return !!purpose?.first;
    if (step === 2) return Object.values(vibe).some((g) => g.first !== null);
    if (step === 3) return meetingLocation !== null;
    return false;
  }

  function handleNext() {
    setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    if (step > 0) setStep((s) => (s - 1) as Step);
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
        groupSize: deriveGroupSize(locations.length),
        purpose: { first: purpose!.first!, second: purpose!.second ?? null },
        vibe: { first: vibeFirst, second: vibeSecond },
        relation: purpose?.relation ?? null,
        occasion: purpose?.occasion ?? null,
        budget,
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
    setTreasurer(null);
    setResultTravelTimes(null);
    setMeetingLocation(null);
    setBudget(null);
    setStep(3 as Step);
    setView('steps');
  }

  function handleShare() {
    if (!result || result.length === 0) return;
    const primary = result[0];
    const mlpUrl = window.location.origin;
    const hasSecond = !!(purpose?.second && purpose.second !== '없음');
    const secondPlace = hasSecond && result.length > 1 ? result[1] : null;

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
            `장소: ${primary.placeName}`,
            `가격대: ${primary.priceRange || ''}`,
            ...(treasurer ? [`💰 ${treasurer}에서 출발하는 분이 오늘의 총무!`] : []),
          ];

      const buttons: object[] = [
        { title: 'MINT로 장소 정하러 가기', link: { mobileWebUrl: mlpUrl, webUrl: mlpUrl } },
      ];
      if (secondMapUrl) {
        buttons.push({ title: `2차(${purpose!.second}) 카카오맵 보기`, link: { mobileWebUrl: secondMapUrl, webUrl: secondMapUrl } });
      } else {
        buttons.push({ title: '카카오맵에서 보기', link: { mobileWebUrl: primaryMapUrl, webUrl: primaryMapUrl } });
      }

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🍀 MINT 추천${hasSecond ? ` | 1차(${purpose!.first}) · 2차(${purpose!.second})` : ''}`,
          description: descLines.join('\n'),
          imageUrl: `${mlpUrl}/image/step5.png`,
          link: { mobileWebUrl: mlpUrl, webUrl: mlpUrl },
        },
        buttons,
      });
      return;
    }

    // 카카오 SDK 없을 때 텍스트 공유
    const lines = [
      '🍀 MINT 추천 장소 🍀',
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
            `장소: ${primary.placeName}`,
            `  카카오맵 → ${primaryMapUrl}`,
          ]),
      ...(treasurer ? ['', `💰 ${treasurer}에서 출발하는 분이 오늘의 총무 담첨!`] : []),
      '',
      '이젠, MINT로 우리 모임 장소 정해봐요!',
      mlpUrl,
    ];

    const shareText = lines.join('\n');
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard?.writeText(shareText).then(() => alert('공유 내용이 복사되었습니다!'));
    }
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
                setResultTravelTimes(null);
                setLocations([]);
                setPurpose(null);
                setVibe({});
                setBudget(null);
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
          />
        </div>
      </div>
    );
  }

  // 입력 플로우
  return (
    <div className="h-[100dvh] bg-[#F5FBF8] overflow-hidden">
      <div className="h-full max-w-md mx-auto flex flex-col">

        {/* 헤더 */}
        <div className="flex-shrink-0 text-center pt-5 px-4">
          <h1 className="text-2xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
        </div>

        {/* 스텝 프로그레스 */}
        <div className="flex-shrink-0">
          <StepProgress current={step} total={4} />
        </div>

        {/* 스텝 제목 */}
        <div className="flex-shrink-0 text-center px-4 pt-3 pb-1">
          <h2 className="text-xl font-black text-gray-800">
            {step === 0 && '각자의 출발지를 입력해주세요'}
            {step === 1 && '오늘의 코스 선택'}
            {step === 2 && '원하는 분위기를 골라봐요'}
            {step === 3 && '어디서 만날까요?'}
          </h2>
          {step === 2 && (
            <p className="text-xs text-gray-400 mt-1">최소 1개 이상 선택 · 많이 고를수록 추천이 정확해져요</p>
          )}
          {step === 3 && (
            <p className="text-xs text-gray-400 mt-1">친구들이 만날 동네를 입력해봐요</p>
          )}
        </div>

        {/* 콘텐츠 */}
        <div key={step} className="flex-1 min-h-0 overflow-y-auto animate-fade-in-up">
          {step === 0 && <LocationInput locations={locations} onChange={setLocations} />}
          {step === 1 && (
            <PurposeSelect
              value={purpose ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null }}
              onChange={setPurpose}
            />
          )}
          {step === 2 && (
            <VibeSelect
              value={vibe}
              onChange={setVibe}
              purpose={purpose ? { first: purpose.first, second: purpose.second } : undefined}
              budget={budget}
              onBudgetChange={setBudget}
            />
          )}
          {step === 3 && (
            <MeetingLocationSelect
              value={meetingLocation}
              onSelect={(loc) => {
                setMeetingLocation(loc);
                handleConfirmMeetingLocation(loc);
              }}
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
              {step === 1 && !canNext() && (
                <p className="text-xs text-gray-400 text-center">1차 목적을 선택해주세요</p>
              )}
            </>
          ) : (
            <button
              onClick={handleBack}
              className="w-full py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 font-bold text-base hover:border-gray-300 transition-all active:scale-95"
            >
              ← 뒤로
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
