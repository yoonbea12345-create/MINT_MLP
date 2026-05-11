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
  '딱 맞는 곳 찾는 중...',
  '실시간 혼잡도 확인 중...',
  '분위기 분석 중...',
  '최적 동선 계산 중...',
  '거의 다 됐어요! ✨',
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
  const [meetingLocation, setMeetingLocation] = useState<MeetingLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<PlaceRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midpointData, setMidpointData] = useState<{
    midpoint: Coordinates;
    areaName: string;
    nearestAreas: string[];
  } | null>(null);
  const [resultTravelTimes, setResultTravelTimes] = useState<TravelResult[] | null>(null);
  const [treasurer, setTreasurer] = useState<string | null>(null);

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
    setError(null);
    setResult(null);

    const msgInterval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
    }, 1800);

    try {
      const congestionData = await getMultiAreaCongestion(nearestAreas);

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
      };

      const recommendation = await getAIRecommendation(input, midpoint, congestionData);
      setResult(recommendation);

      const namedLocs = locations.filter((l) => l.name);
      if (namedLocs.length > 0) {
        const picked = namedLocs[Math.floor(Math.random() * namedLocs.length)];
        setTreasurer(picked.name);
      }
      setView('result');

      if (validLocs.length >= 2) {
        fetch('/api/travel-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origins: validLocs.map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name })),
            destination: midpoint,
          }),
        })
          .then((r) => r.json())
          .then((data: TravelResult[]) => setResultTravelTimes(data))
          .catch(() => setResultTravelTimes([]));
      } else {
        setResultTravelTimes([]);
      }
    } catch (e) {
      setError((e as Error).message || '추천을 가져오지 못했어요. 다시 시도해주세요.');
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  }

  function handleRetry() {
    setTreasurer(null);
    setResultTravelTimes(null);
    setMeetingLocation(null);
    setStep(3 as Step);
    setView('steps');
  }

  function handleShare() {
    if (!result || result.length === 0) return;
    const primary = result[0];
    const mlpUrl = window.location.origin;
    const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(primary.placeName)}`;

    if (window.Kakao?.Share) {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(import.meta.env.VITE_KAKAO_JS_API_KEY);
      }
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🍀 MINT 추천: ${primary.placeName || '정보 없음'}`,
          description: [
            `혼잡도: ${primary.congestionLevel || '정보 없음'}`,
            `분위기: ${primary.vibeTags?.length ? primary.vibeTags.join(', ') : '정보 없음'}`,
            `가격대: ${primary.priceRange || '정보 없음'}`,
            ...(treasurer ? [`💳 오늘의 총무는 ${treasurer}에서 오신 분!`] : []),
          ].join('\n'),
          imageUrl: `${mlpUrl}/image/step5.png`,
          link: { mobileWebUrl: mlpUrl, webUrl: mlpUrl },
        },
        buttons: [
          {
            title: '이젠, MINT로 우리 모임 장소 정해봐요!',
            link: { mobileWebUrl: mlpUrl, webUrl: mlpUrl },
          },
        ],
      });
      return;
    }

    const shareText = [
      '🍀 MINT의 추천 장소🍀',
      '',
      `장소명: ${primary.placeName || '정보 없음'}`,
      `혼잡도: ${primary.congestionLevel || '정보 없음'}`,
      `분위기: ${primary.vibeTags?.length ? primary.vibeTags.join(', ') : '정보 없음'}`,
      `가격대: ${primary.priceRange || '정보 없음'}`,
      ...(treasurer ? ['', `💳 오늘의 총무는 ${treasurer}에서 오신 분!`] : []),
      '',
      '카카오맵에서 보기:',
      kakaoMapUrl,
      '',
      '이젠, MINT로 우리 모임 장소 정해봐요!',
      mlpUrl,
    ].join('\n');

    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard?.writeText(shareText).then(() => alert('공유 내용이 복사되었습니다!'));
    }
  }

  // 로딩
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5FBF8] px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-[#E8F8F5]" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#3CDBC0] border-r-[#3CDBC0] border-transparent animate-spin-slow" />
            <div className="absolute inset-3 rounded-full bg-[#3CDBC0]/20 flex items-center justify-center">
              <span className="text-2xl animate-mint-pulse">🌿</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#2AB5A0] animate-mint-pulse">
              {LOADING_MESSAGES[loadingMsg]}
            </p>
            <p className="text-sm text-gray-400 mt-1">잠시만 기다려주세요</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#3CDBC0] animate-bounce-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
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
        <div className="max-w-md mx-auto px-4 pb-10 pt-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => {
                setResult(null);
                setView('steps');
                setStep(0);
                setResultTravelTimes(null);
                setLocations([]);
                setPurpose(null);
                setVibe({});
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
          {step === 3 && (
            <p className="text-xs text-gray-400 mt-1">친구들이 만날 동네를 입력해봐요</p>
          )}
        </div>

        {/* 콘텐츠 */}
        <div key={step} className="flex-1 min-h-0 overflow-y-auto animate-fade-in-up">
          {step === 0 && <LocationInput locations={locations} onChange={setLocations} />}
          {step === 1 && (
            <PurposeSelect
              value={purpose ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음' }}
              onChange={setPurpose}
            />
          )}
          {step === 2 && (
            <VibeSelect
              value={vibe}
              onChange={setVibe}
              purpose={purpose ? { first: purpose.first, second: purpose.second } : undefined}
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
