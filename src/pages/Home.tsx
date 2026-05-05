import { useState, useEffect, useRef } from 'react';
import StepProgress from '../components/StepProgress';
import LocationInput from '../components/LocationInput';
import type { LocationEntry } from '../components/LocationInput';
import GroupSizeSelect from '../components/GroupSizeSelect';
import PurposeSelect from '../components/PurposeSelect';
import VibeSelect from '../components/VibeSelect';
import type { VibeAnswers } from '../components/VibeSelect';
import ResultCard from '../components/ResultCard';
import RegionSelect from '../components/RegionSelect';
import Reserve from './Reserve';
import { findNearestAreas, findBalancedAreas } from '../services/midpoint';
import type { PresetRegion, Coordinates } from '../services/midpoint';
import { getMultiAreaCongestion } from '../services/seoulData';
import { getAIRecommendation, getCourseRecommendation } from '../services/ai';
import type { PlaceRecommendation, UserInput, CourseRecommendation } from '../services/ai';
import { trackSessionDuration } from '../utils/analytics';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'region-select' | 'result' | 'reserve';

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

const LOADING_MESSAGES = [
  '딱 맞는 곳 찾는 중...',
  '실시간 혼잡도 확인 중...',
  '바이브 분석 중...',
  '최적 동선 계산 중...',
  '거의 다 됐어요! ✨',
];

export default function Home() {
  const [view, setView] = useState<View>('steps');
  const [step, setStep] = useState<Step>(0);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [groupSize, setGroupSize] = useState<UserInput['groupSize'] | null>(null);
  const [purpose, setPurpose] = useState<UserInput['purpose'] | null>(null);
  const [vibe, setVibe] = useState<Partial<VibeAnswers>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<PlaceRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 세션 시작 시각 기록
  useEffect(() => {
    if (!sessionStorage.getItem('mintSessionStart')) {
      sessionStorage.setItem('mintSessionStart', Date.now().toString());
    }
  }, []);

  // 결과 화면 진입 시 체류시간 전송
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

  const [midpointData, setMidpointData] = useState<{
    midpoint: Coordinates;
    areaName: string;
    nearestAreas: string[];
  } | null>(null);

  // 백그라운드 사전 계산: 위치 입력되면 자동 중간지점 소요시간 미리 fetch
  const [prefetchedTravelTimes, setPrefetchedTravelTimes] = useState<TravelResult[] | null>(null);
  const [resultTravelTimes, setResultTravelTimes] = useState<TravelResult[] | null>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    if (validLocs.length < 2) { setPrefetchedTravelTimes(null); return; }

    prefetchAbortRef.current?.abort();
    const controller = new AbortController();
    prefetchAbortRef.current = controller;
    setPrefetchedTravelTimes(null);

    const coords = validLocs.map((l) => ({ lat: l.lat!, lng: l.lng! }));
    const { midpoint } = findBalancedAreas(coords);

    fetch('/api/travel-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origins: validLocs.map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name })),
        destination: midpoint,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: TravelResult[]) => setPrefetchedTravelTimes(data))
      .catch(() => {});
  }, [locations]);

  const [treasurer, setTreasurer] = useState<string | null>(null);
  const [treasurerPicked, setTreasurerPicked] = useState(false);

  function handlePickTreasurer() {
    if (treasurerPicked) return;
    const validLocs = locations.filter((l) => l.name);
    if (validLocs.length === 0) return;
    const picked = validLocs[Math.floor(Math.random() * validLocs.length)];
    setTreasurer(picked.name);
    setTreasurerPicked(true);
  }

  const [courseVisible, setCourseVisible] = useState(false);
  const [courseData, setCourseData] = useState<CourseRecommendation | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  function canNext(): boolean {
    if (step === 0) return locations.length >= 2;
    if (step === 1) return !!groupSize;
    if (step === 2) return !!purpose;
    if (step === 3) return Object.keys(vibe).length === 3;
    return false;
  }

  function handleNext() {
    if (step < 3) setStep((s) => (s + 1) as Step);
    else setView('region-select');
  }

  function handleBack() {
    if (step > 0) setStep((s) => (s - 1) as Step);
  }

  function handleMidpointSelect(presetRegion?: PresetRegion) {
    let midpoint: Coordinates;
    let areaName: string;
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);

    if (presetRegion) {
      midpoint = presetRegion.midpoint;
      areaName = presetRegion.label;
      // 프리셋은 사전계산 없으니 AI와 병렬로 fetch
      setResultTravelTimes(null);
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
          .catch(() => {});
      }
    } else {
      const coords = validLocs.map((l) => ({ lat: l.lat!, lng: l.lng! }));
      const balanced = findBalancedAreas(coords.length >= 2 ? coords : [{ lat: 37.5665, lng: 126.978 }]);
      midpoint = balanced.midpoint;
      areaName = balanced.areaName;
      if (prefetchedTravelTimes !== null) {
        setResultTravelTimes(prefetchedTravelTimes);
      } else {
        setResultTravelTimes(null);
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
            .catch(() => {});
        }
      }
    }

    const nearestAreas = findNearestAreas(midpoint, 3);
    setMidpointData({ midpoint, areaName, nearestAreas });
    handleRecommend(midpoint, nearestAreas);
  }

  async function handleRecommend(midpoint: Coordinates, nearestAreas: string[]) {
    setLoading(true);
    setError(null);
    setResult(null);

    const msgInterval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
    }, 1800);

    try {
      const congestionData = await getMultiAreaCongestion(nearestAreas);

      const input: UserInput = {
        locations,
        groupSize: groupSize!,
        purpose: purpose!,
        vibe: vibe as VibeAnswers,
      };

      const recommendation = await getAIRecommendation(input, midpoint, congestionData);
      setResult(recommendation);
      setView('result');
    } catch (e) {
      setError((e as Error).message || '추천을 가져오지 못했어요. 다시 시도해주세요.');
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  }

  async function handleToggleCourse() {
    if (courseVisible) {
      setCourseVisible(false);
      return;
    }
    if (courseData) {
      setCourseVisible(true);
      return;
    }
    setCourseVisible(true);
    setCourseLoading(true);
    setCourseError(null);
    try {
      const input: UserInput = {
        locations,
        groupSize: groupSize!,
        purpose: purpose!,
        vibe: vibe as VibeAnswers,
      };
      const course = await getCourseRecommendation(input, result![0]);
      setCourseData(course);
    } catch (e) {
      setCourseError((e as Error).message || '코스 추천을 가져오지 못했어요.');
      setCourseVisible(false);
    } finally {
      setCourseLoading(false);
    }
  }

  function handleRetry() {
    setCourseData(null);
    setCourseVisible(false);
    setCourseError(null);
    setTreasurer(null);
    setTreasurerPicked(false);
    setPrefetchedTravelTimes(null);
    setResultTravelTimes(null);
    setView('region-select');
  }

  function handleShare() {
    if (!result || result.length === 0) return;
    const primary = result[0];
    const mlpUrl = window.location.origin;
    const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(primary.placeName)}`;

    // Kakao Share SDK — 카카오톡에 MINT 링크 카드로 공유
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
            `바이브: ${primary.vibeTags?.length ? primary.vibeTags.join(', ') : '정보 없음'}`,
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

    // fallback — 텍스트 공유 (MLP URL을 마지막에 넣어 카카오톡 링크 미리보기가 MINT로 뜨도록)
    const shareText = [
      '🍀 MINT의 추천 장소🍀',
      '',
      `장소명: ${primary.placeName || '정보 없음'}`,
      `혼잡도: ${primary.congestionLevel || '정보 없음'}`,
      `바이브: ${primary.vibeTags?.length ? primary.vibeTags.join(', ') : '정보 없음'}`,
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

  // 로딩 (region-select보다 먼저 체크해야 즉시 전환됨)
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

  // 지역 선택 화면
  if (view === 'region-select') {
    return (
      <RegionSelect
        onAutoSelect={() => handleMidpointSelect()}
        onRegionSelect={(region) => handleMidpointSelect(region)}
        onBack={() => { setView('steps'); setStep(3); }}
      />
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
              onClick={() => { setResult(null); setView('steps'); setStep(0); setPrefetchedTravelTimes(null); setResultTravelTimes(null); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 처음으로
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
              <span className="text-xs text-gray-400">추천 결과</span>
            </div>
          </div>

          <ResultCard
            results={result}
            travelTimes={resultTravelTimes}
            midpointAreaName={midpointData?.areaName}
            courseVisible={courseVisible}
            courseLoading={courseLoading}
            courseData={courseData}
            courseError={courseError}
            treasurer={treasurer}
            treasurerPicked={treasurerPicked}
            onPickTreasurer={handlePickTreasurer}
            onToggleCourse={handleToggleCourse}
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
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto">
        <div className="text-center pt-8 pb-2 px-4">
          <h1 className="text-3xl font-black text-[#2AB5A0] tracking-tight">MINT</h1>
          <p className="text-sm text-gray-500 mt-1">30초 만에 오늘 갈 곳 찾기</p>
        </div>

        <StepProgress current={step} total={4} />

        <div className="mt-6">
          {step === 0 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6 px-4">
                <h2 className="text-xl font-black text-gray-800">어디서 출발해요?</h2>
                <p className="text-sm text-gray-400 mt-1">최소 2명의 출발지를 입력해주세요</p>
              </div>
              <LocationInput locations={locations} onChange={setLocations} />
            </div>
          )}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6 px-4">
                <h2 className="text-xl font-black text-gray-800">몇 명이서 가요?</h2>
              </div>
              <GroupSizeSelect value={groupSize} onChange={setGroupSize} />
            </div>
          )}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6 px-4">
                <h2 className="text-xl font-black text-gray-800">오늘의 목적은?</h2>
              </div>
              <PurposeSelect value={purpose} onChange={setPurpose} />
            </div>
          )}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6 px-4">
                <h2 className="text-xl font-black text-gray-800">오늘 어떤 바이브?</h2>
              </div>
              <VibeSelect value={vibe} onChange={setVibe} />
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="px-4 pb-10 pt-4 flex gap-3">
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
            {step === 3 ? '✨ 장소 추천받기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
