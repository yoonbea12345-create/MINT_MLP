import { useState } from 'react';
import StepProgress from '../components/StepProgress';
import LocationInput from '../components/LocationInput';
import type { LocationEntry } from '../components/LocationInput';
import GroupSizeSelect from '../components/GroupSizeSelect';
import PurposeSelect from '../components/PurposeSelect';
import VibeSelect from '../components/VibeSelect';
import type { VibeAnswers } from '../components/VibeSelect';
import ResultCard from '../components/ResultCard';
import Reserve from './Reserve';
import { calcMidpoint, findNearestAreas } from '../services/midpoint';
import { getMultiAreaCongestion } from '../services/seoulData';
import { getAIRecommendation } from '../services/ai';
import type { PlaceRecommendation, UserInput } from '../services/ai';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'result' | 'reserve';

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
  const [withCourse, setWithCourse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<PlaceRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  function canNext(): boolean {
    if (step === 0) return locations.length >= 2;
    if (step === 1) return !!groupSize;
    if (step === 2) return !!purpose;
    if (step === 3) return Object.keys(vibe).length === 3;
    return false;
  }

  function handleNext() {
    if (step < 3) setStep((s) => (s + 1) as Step);
    else handleSubmit();
  }

  function handleBack() {
    if (step > 0) setStep((s) => (s - 1) as Step);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);

    const msgInterval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
    }, 1800);

    try {
      const coords = locations.map((l) => ({ lat: l.lat ?? 37.5665, lng: l.lng ?? 126.978 }));
      const midpoint = calcMidpoint(coords);
      const nearestAreas = findNearestAreas(midpoint, 3);
      const congestionData = await getMultiAreaCongestion(nearestAreas);

      const input: UserInput = {
        locations,
        groupSize: groupSize!,
        purpose: purpose!,
        vibe: vibe as VibeAnswers,
        withCourse,
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

  function handleShare() {
    if (!result) return;
    const shareText = `🌿 MINT가 추천하는 오늘의 장소\n\n📍 ${result.placeName}\n${result.description}\n💰 ${result.priceRange}\n\n MINT로 우리 모임 장소 정해봐요!\n${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'MINT 추천 장소', text: shareText });
    } else {
      window.open(
        `https://sharer.kakao.com/talk/friends/picker/link?app_key=${import.meta.env.VITE_KAKAO_JS_API_KEY}`,
        '_blank'
      );
    }
  }

  // 예약 페이지
  if (view === 'reserve' && result) {
    return (
      <Reserve
        placeName={result.placeName}
        address={result.address || result.area}
        openingHours={result.openingHours ?? ''}
        onBack={() => setView('result')}
      />
    );
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

  // 추천 결과
  if (view === 'result' && result) {
    return (
      <div className="min-h-screen bg-[#F5FBF8]">
        <div className="max-w-md mx-auto px-4 pb-10 pt-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => { setResult(null); setView('steps'); setStep(0); }}
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
            result={result}
            withCourse={withCourse}
            onToggleCourse={() => {
              setWithCourse((prev) => !prev);
              handleSubmit();
            }}
            onRetry={handleSubmit}
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
