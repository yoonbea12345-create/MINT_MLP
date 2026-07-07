import { useState, useEffect, useRef } from 'react';
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
import { getAIRecommendation } from '../services/ai';
import type { PlaceRecommendation, UserInput, WeatherSummary } from '../services/ai';
import { saveResultSnapshot, loadResultSnapshot, clearResultSnapshot, saveHistory } from '../utils/history';
import { computeTravelTimes } from '../services/travelTime';
import { trackSessionDuration, trackEvent } from '../utils/analytics';
import { aggregatePurpose, aggregateVibe, aggregateBudget, splitMemberKeywords } from '../utils/groupAggregate';
import type { GroupMember } from '../utils/groupAggregate';
import LoadingScreen from '../components/home/LoadingScreen';
import GroupSetup from '../components/home/GroupSetup';
import GroupWaiting from '../components/home/GroupWaiting';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'result' | 'reserve';
type AppMode = 'mode-select' | 'solo' | 'group-setup' | 'group-waiting' | 'group-ready'; // 'mode-select' = step 0 of flow

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

interface ResultTravelTimes {
  first: { transit: TravelResult[]; driving: TravelResult[] };
  second: { transit: TravelResult[]; driving: TravelResult[] } | null;
}

const LOADING_MESSAGES = [
  '🗺️ 서울 구석구석 탐색 중...',
  '👥 우리 팀 취향 분석 중...',
  '🔍 딱 맞는 곳 걸러내는 중...',
  '💰 가격대 & 영업시간 체크 중...',
  '✨ 오늘의 코스 완성 직전!',
];

// 결과·입력초안 모두 localStorage에 보관 — 홈버튼·공유로 앱을 벗어나 웹뷰가 재시작돼도 유지
// (sessionStorage는 모바일에서 프로세스 재시작 시 통째로 사라짐)
const INPUT_DRAFT_KEY = 'mint_input_draft_v1';
const INPUT_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // 입력하다 만 초안은 6시간까지만 복원

// 그룹 호스트 세션 — sessionId는 서버 세션의 유일한 열쇠라 state에만 두면 새로고침 시 링크·대기현황이 통째로 증발한다
const GROUP_SESSION_KEY = 'mint_group_session_v1';
const GROUP_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 그룹 대기 세션도 6시간까지만 복원

// 공유 투표용 ID (세션 아님 — 공유 클릭마다 새로 발급)
const SHARE_ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
function newShareId(): string {
  let s = 'sh';
  for (let i = 0; i < 10; i++) s += SHARE_ID_CHARS[Math.floor(Math.random() * SHARE_ID_CHARS.length)];
  return s;
}

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

type ChangeReason = 'retry' | 'adjust' | 'expensive' | 'far' | 'vibe';

// 재추천이 이전 결과 대비 "뭐가 달라졌는지" 한 줄 — 실측 가능한 사실(거리)만 숫자로 말한다
function buildChangeNote(
  prev: PlaceRecommendation | null,
  next: PlaceRecommendation | undefined,
  midpoint: Coordinates,
  reason: ChangeReason,
): string | null {
  if (!prev || !next || prev.placeName === next.placeName) return null;

  let distPart: string | null = null;
  if (prev.lat && prev.lng && next.lat && next.lng && prev.lat !== 0 && next.lat !== 0) {
    const diff = distMeters(midpoint.lat, midpoint.lng, prev.lat, prev.lng)
      - distMeters(midpoint.lat, midpoint.lng, next.lat, next.lng);
    if (diff > 150) distPart = `중간지점에서 ${diff >= 1000 ? `${(diff / 1000).toFixed(1)}km` : `${Math.round(diff / 50) * 50}m`} 더 가까워졌어요`;
  }

  switch (reason) {
    case 'expensive':
      return `${prev.placeName} 대신 가격 부담을 낮춘 곳으로 다시 골랐어요 (이번엔 ${next.priceRange})`;
    case 'far':
      return distPart
        ? `${prev.placeName} 대신 ${distPart.replace('졌어요', '운 곳')}으로 바꿨어요`
        : `${prev.placeName} 대신 이동 부담을 줄이는 방향으로 다시 골랐어요`;
    case 'vibe':
      return `분위기를 바꿔 ${next.placeName}(${next.category})로 다시 골랐어요`;
    case 'adjust':
      return `조절한 취향을 반영해 ${next.placeName}로 바꿨어요${distPart ? ` · ${distPart}` : ''}`;
    default:
      return `아까 본 ${prev.placeName} 말고 새로운 곳으로 골랐어요${distPart ? ` · ${distPart}` : ''}`;
  }
}

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
  const [excludeFoods, setExcludeFoods] = useState<string[]>([]);
  const [vibeCustom, setVibeCustom] = useState<Record<string, string>>({});
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [midpointData, setMidpointData] = useState<{
    midpoint: Coordinates;
    areaName: string;
    nearestAreas: string[];
  } | null>(null);
  const [resultTravelTimes, setResultTravelTimes] = useState<ResultTravelTimes | null>(null);
  const [treasurer, setTreasurer] = useState<string | null>(null);
  const [resultWeather, setResultWeather] = useState<WeatherSummary | null>(null);
  const [changeNote, setChangeNote] = useState<string | null>(null);
  const [compromiseMessage, setCompromiseMessage] = useState<string | null>(null);
  const [showCompromiseToast, setShowCompromiseToast] = useState(false);

  const travelReqRef = useRef(0);

  useEffect(() => {
    if (!sessionStorage.getItem('mintSessionStart')) {
      sessionStorage.setItem('mintSessionStart', Date.now().toString());
    }
  }, []);

  // 마지막 추천 결과 복원 (새로고침·홈 이탈·앱 전환 후 재진입 시 추천이 증발하지 않게)
  useEffect(() => {
    try {
      const saved = loadResultSnapshot() as {
        result?: PlaceRecommendation[];
        purpose?: PurposeValue;
        midpointData?: { midpoint: Coordinates; areaName: string; nearestAreas: string[] };
        treasurer?: string;
        meetingLocation?: MeetingLocation;
        resultTravelTimes?: ResultTravelTimes;
        resultWeather?: WeatherSummary;
        vibe?: VibeState;
        keywords?: string[];
        excludeFoods?: string[];
      } | null;
      if (!saved || !Array.isArray(saved.result) || saved.result.length === 0) return;
      setResult(saved.result);
      if (saved.purpose) setPurpose(saved.purpose);
      if (saved.midpointData) setMidpointData(saved.midpointData);
      if (saved.treasurer) setTreasurer(saved.treasurer);
      if (saved.meetingLocation) setMeetingLocation(saved.meetingLocation);
      if (saved.resultTravelTimes) setResultTravelTimes(saved.resultTravelTimes);
      if (saved.resultWeather) setResultWeather(saved.resultWeather);
      if (saved.vibe) setVibe(saved.vibe);            // 개인화 배너 복원용
      if (Array.isArray(saved.keywords)) setKeywords(saved.keywords);
      if (Array.isArray(saved.excludeFoods)) setExcludeFoods(saved.excludeFoods);
      setView('result');
    } catch { /* 손상된 캐시는 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 입력 초안 복원 — 결과가 없을 때만, solo 모드 입력만 (그룹은 서버 세션이 소스)
  useEffect(() => {
    try {
      if (loadResultSnapshot()) return; // 결과 복원이 우선
      // 구버전(sessionStorage) 초안도 한 번은 읽어줌 — 배포 시점에 입력 중이던 세션 보호
      const raw = localStorage.getItem(INPUT_DRAFT_KEY) ?? sessionStorage.getItem(INPUT_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.appMode !== 'solo') return;
      // 오래 방치된 초안은 복원하지 않음 (savedAt 없는 구버전 초안은 그대로 복원)
      if (typeof d.savedAt === 'number' && Date.now() - d.savedAt > INPUT_DRAFT_TTL_MS) {
        localStorage.removeItem(INPUT_DRAFT_KEY);
        return;
      }
      setAppMode('solo');
      if (typeof d.step === 'number') setStep(d.step as Step);
      if (d.groupSize) setGroupSize(d.groupSize);
      if (d.purpose) setPurpose(d.purpose);
      if (d.vibe) setVibe(d.vibe);
      if (Array.isArray(d.keywords)) setKeywords(d.keywords);
      if (Array.isArray(d.excludeFoods)) setExcludeFoods(d.excludeFoods);
      if (d.vibeCustom) setVibeCustom(d.vibeCustom);
      if (d.meetingLocation) setMeetingLocation(d.meetingLocation);
      if (d.budget !== undefined) setBudget(d.budget);
      if (typeof d.customOccasion === 'string') setCustomOccasion(d.customOccasion);
      if (Array.isArray(d.locations)) setLocations(d.locations);
    } catch { /* 손상된 초안 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그룹 호스트 세션 복원 — 결과 스냅샷이 없을 때만 (결과 화면이 우선)
  useEffect(() => {
    try {
      if (loadResultSnapshot()) return;
      const raw = localStorage.getItem(GROUP_SESSION_KEY);
      if (!raw) return;
      const g = JSON.parse(raw) as { savedAt?: number; sessionId?: string; expectedCount?: number; groupHasSecond?: boolean };
      if (!g.sessionId) return;
      if (typeof g.savedAt === 'number' && Date.now() - g.savedAt > GROUP_SESSION_TTL_MS) {
        localStorage.removeItem(GROUP_SESSION_KEY);
        return;
      }
      setSessionId(g.sessionId);
      if (typeof g.expectedCount === 'number') setExpectedCount(g.expectedCount);
      if (typeof g.groupHasSecond === 'boolean') setGroupHasSecond(g.groupHasSecond);
      setStep(0);                 // solo 초안이 남긴 step을 덮어 대기 화면(step 0)으로 되돌린다
      setAppMode('group-waiting'); // 폴링이 다시 붙어 멤버 현황을 서버에서 재수화한다
    } catch { /* 손상된 그룹 세션 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그룹 호스트 세션 저장 — 대기·준비 단계에서 sessionId가 살아있는 동안
  useEffect(() => {
    if ((appMode !== 'group-waiting' && appMode !== 'group-ready') || !sessionId) return;
    try {
      localStorage.setItem(GROUP_SESSION_KEY, JSON.stringify({
        savedAt: Date.now(), sessionId, expectedCount, groupHasSecond,
      }));
    } catch { /* 저장 실패는 치명적이지 않음 */ }
  }, [appMode, sessionId, expectedCount, groupHasSecond]);

  // 입력 초안 저장 — solo 모드로 입력 진행 중일 때만
  useEffect(() => {
    if (view !== 'steps' || appMode !== 'solo') return;
    try {
      localStorage.setItem(INPUT_DRAFT_KEY, JSON.stringify({
        savedAt: Date.now(),
        appMode, step, groupSize, purpose, vibe, keywords, excludeFoods, vibeCustom,
        meetingLocation, budget, customOccasion, locations,
      }));
    } catch { /* 저장 실패는 치명적이지 않음 */ }
  }, [view, appMode, step, groupSize, purpose, vibe, keywords, excludeFoods, vibeCustom, meetingLocation, budget, customOccasion, locations]);

  // 결과 화면 상태가 확정될 때마다 스냅샷 저장 (setState 커밋 이후라 stale closure 없음)
  // + 같은 스냅샷을 localStorage 히스토리에도 적재 — 랜딩 "지난 추천"에서 그대로 복원
  useEffect(() => {
    if (view !== 'result' || !result || result.length === 0) return;
    const snapshot = {
      result, purpose, midpointData, treasurer, meetingLocation, resultTravelTimes, resultWeather, vibe, keywords, excludeFoods,
    };
    saveResultSnapshot(snapshot);
    const hasSecondCourse = !!(purpose?.second && purpose.second !== '없음');
    saveHistory({
      savedAt: Date.now(),
      placeName: result[0].placeName,
      secondPlaceName: hasSecondCourse ? result[1]?.placeName ?? null : null,
      areaName: midpointData?.areaName ?? null,
      purposeFirst: purpose?.first ?? null,
      snapshot,
    });
  }, [view, result, purpose, midpointData, treasurer, meetingLocation, resultTravelTimes, resultWeather, vibe, keywords, excludeFoods]);


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
      if (document.hidden) return; // 백그라운드 탭에서는 폴링 중지
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
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
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

  function canNext(): boolean {
    if (step === 0) {
      if (appMode === 'solo') return !!purpose?.first;
      if (appMode === 'group-waiting' || appMode === 'group-ready') return groupMembers.length >= 2;
      return false;
    }
    if (step === 1) return true; // 관계·특별한날은 선택사항
    if (step === 2) return meetingLocation !== null && (meetingLocation.type === 'manual' || locations.length >= 2);
    return false;
  }

  function handleNext() {
    // 그룹 모드에서 step 0 → 1 진행 시 멤버 데이터 집계
    if (step === 0 && (appMode === 'group-waiting' || appMode === 'group-ready')) {
      const groupLocations: LocationEntry[] = groupMembers.map((m) => ({
        name: m.member_name,
        lat: m.location_lat,
        lng: m.location_lng,
      }));
      setLocations(groupLocations);
      setVibe(aggregateVibe(groupMembers));
      const aggregated = aggregatePurpose(groupMembers);
      if (aggregated) setPurpose(aggregated);
      // 편식은 전원 합집합 — 한 명이라도 못 먹으면 그 음식은 제외
      const { keywords: memberKeywords, excludeFoods: memberExcludes } = splitMemberKeywords(groupMembers);
      setKeywords(memberKeywords);
      setExcludeFoods(memberExcludes);
      setBudget(aggregateBudget(groupMembers)); // 멤버 예산도 결과에 반영
      setAppMode('group-ready');
    }
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
    vibeWeights?: Record<string, number>,
    excludeNames: string[] = [],
    changeReason?: ChangeReason,
  ) {
    // 재추천이면 이전 1순위를 기억해뒀다가 "뭐가 달라졌는지" 한 줄에 사용
    const prevFirst = changeReason ? result?.[0] ?? null : null;
    setChangeNote(null);
    setLoading(true);
    setLoadingProgress(0);
    setError(null);
    setResult(null);

    const msgInterval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
    }, 1800);

    let aiProgressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // 혼잡도는 서버가 추천 파이프라인 안에서 병렬 조회 — 클라이언트 선행 왕복 제거
      setLoadingProgress(15);

      const vibeFirst: string[] = [];
      const vibeSecond: string[] = [];
      Object.values(vibe).forEach((g) => {
        if (g.first) vibeFirst.push(VIBE_KEY_TO_LABEL[g.first] ?? g.first);
        if (g.second) vibeSecond.push(VIBE_KEY_TO_LABEL[g.second] ?? g.second);
      });

      const input: UserInput = {
        // 서버 검증 통과를 위해 이름 없는 항목 제외 (지역 직접 선택 시 빈 배열)
        locations: locations.filter((l) => l.name?.trim()),
        groupSize: appMode === 'group-ready' ? (locations.length >= 5 ? '5명 이상' : locations.length >= 3 ? '3~4명' : '2명') : groupSize,
        purpose: {
          first: purpose!.first!,
          second: purpose!.second ?? null,
          // 장르 좁히기 — 서버가 검색 키워드 풀을 해당 장르로 좁히고 AI에도 제약 전달
          ...(purpose?.firstGenre ? { firstGenre: purpose.firstGenre } : {}),
          ...(purpose?.secondGenre && purpose.second && purpose.second !== '없음' ? { secondGenre: purpose.secondGenre } : {}),
        },
        vibe: { first: vibeFirst, second: vibeSecond },
        relation: purpose?.relation ?? null,
        occasion: purpose?.occasion?.trim().slice(0, 40) || null,
        budget,
        // 편식 필터 — 서버가 후보 사전 제거 + AI 절대 제약으로 이중 반영 (개수·길이는 서버 검증 한도에 맞춤)
        ...(excludeFoods.length > 0
          ? { excludeFoods: excludeFoods.map((f) => f.trim().slice(0, 20)).filter(Boolean).slice(0, 8) }
          : {}),
        ...(vibeWeights && Object.keys(vibeWeights).length > 0 ? { vibeWeights } : {}),
        ...((() => {
          // 서버 검증 한도(개수 10 · 항목당 30자)에 맞춰 잘라서 전송
          const allKw = [...keywords, ...Object.values(vibeCustom).filter(Boolean)]
            .map((k) => k.trim().slice(0, 30))
            .filter(Boolean)
            .slice(0, 10);
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

      // 실제 마일스톤 2: AI 추천 완료 (재추천 시 이전 장소 제외)
      const { places: recommendation, weather } = await getAIRecommendation(input, midpoint, [], excludeNames, nearestAreas);
      clearInterval(aiProgressInterval);
      setLoadingProgress(100); // 실제 완료

      setResult(recommendation);
      setResultWeather(weather);
      if (changeReason) {
        setChangeNote(buildChangeNote(prevFirst, recommendation[0], midpoint, changeReason));
      }

      let pickedTreasurer: string | null = null;
      const namedLocs = locations.filter((l) => l.name);
      if (namedLocs.length > 0) {
        pickedTreasurer = namedLocs[Math.floor(Math.random() * namedLocs.length)].name;
        setTreasurer(pickedTreasurer);
      }
      setView('result');

      // 자동 중간지점 모드에서만 소요시간 조회 (임의 지역은 UI도 안 뜨므로 호출 생략)
      if (meetingLocation?.type === 'auto' && validLocs.length >= 2) {
        const firstPlace = recommendation[0];
        const secondPlace = recommendation[1];
        const firstDest = firstPlace?.lat && firstPlace.lat !== 0
          ? { lat: firstPlace.lat, lng: firstPlace.lng! }
          : midpoint;
        const secondDest = secondPlace?.lat && secondPlace.lat !== 0
          ? { lat: secondPlace.lat, lng: secondPlace.lng! }
          : undefined;
        // 재추천 직후 이전 응답이 늦게 도착해 옛 장소의 소요시간이 표시되는 레이스 방지
        const reqId = ++travelReqRef.current;
        computeTravelTimes(
          validLocs.map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name })),
          { first: firstDest, ...(secondDest ? { second: secondDest } : {}) },
        )
          .then((data) => { if (reqId === travelReqRef.current) setResultTravelTimes(data); })
          .catch(() => { if (reqId === travelReqRef.current) setResultTravelTimes(null); });
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

  // 현재 표시 중인 추천 장소 이름 — 재추천 시 제외 목록으로 전달
  function currentExclude(): string[] {
    return (result ?? []).map((r) => r.placeName).filter(Boolean);
  }

  // 🔄 다시 뽑기 = 방금 곳 제외하고 즉시 다른 곳 (조건 그대로, 모달 없음)
  function handleRetry() {
    if (!midpointData) return;
    trackEvent('retry_fresh');
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    const exclude = currentExclude();
    setTreasurer(null);
    setResultTravelTimes(null);
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, undefined, exclude, 'retry');
  }

  // 🎚️ 취향 직접 조절 = 슬라이더 모달 진입
  function handleAdjust() {
    setShowRetryModal(true);
  }

  function handleRetryWithWeights(weights: VibeWeights) {
    setShowRetryModal(false);
    if (!midpointData) return;
    trackEvent('retry_adjust');
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    const exclude = currentExclude();
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
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, labeledWeights, exclude, 'adjust');
  }

  function handleReject(reason: 'expensive' | 'far' | 'vibe') {
    if (!midpointData) return;
    trackEvent(`reject_${reason}`);
    const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
    const exclude = currentExclude();
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

    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, rejectWeights, exclude, reason);
  }

  function handleShare() {
    if (!result || result.length === 0) return;
    trackEvent('kakao_share');
    const primary = result[0];
    const mlpUrl = window.location.origin;
    const hasSecond = !!(purpose?.second && purpose.second !== '없음');
    const secondPlace = hasSecond && result.length > 1 ? result[1] : null;

    // 투표 후보 = 1차 메인 + 1차 대안들 (URL 길이를 위해 슬림 포맷: n=이름, c=카테고리, s=적합도)
    const firstCandidates = (hasSecond ? [result[0], result[2], result[3]] : result.slice(0, 3))
      .filter((p): p is PlaceRecommendation => !!p)
      .map((p) => ({ n: p.placeName, c: p.category, s: p.fitScore ?? null }));

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
      imageUrl: primary.imageUrl,
      // 멤버 투표용 — 수신자들이 1차 후보에 👍 할 수 있게
      shareId: newShareId(),
      candidates: firstCandidates.length >= 2 ? firstCandidates : undefined,
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

  // 로딩
  if (loading) {
    return <LoadingScreen progress={loadingProgress} message={LOADING_MESSAGES[loadingMsg]} />;
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
                clearResultSnapshot();
                try { localStorage.removeItem(INPUT_DRAFT_KEY); sessionStorage.removeItem(INPUT_DRAFT_KEY); localStorage.removeItem(GROUP_SESSION_KEY); } catch { /* ignore */ }
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
                setExcludeFoods([]);
                setVibeCustom({});
                setMeetingLocation(null);
                setMidpointData(null);
                setTreasurer(null);
                setResultWeather(null);
                setChangeNote(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 처음으로
            </button>
            <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
          </div>

          {/* 날씨 반영 배너 — "모든 변수 반영"을 유저가 체감하게 */}
          {resultWeather && (resultWeather.isRainy || resultWeather.isHot || resultWeather.isCold) && (
            <div className="mb-2 bg-white border border-gray-100 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm animate-fade-in-up">
              <span className="text-base leading-none">
                {resultWeather.isRainy ? '☔' : resultWeather.isHot ? '🥵' : '🥶'}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed flex-1">
                {resultWeather.isRainy
                  ? `오늘 ${resultWeather.description} 소식이 있어 실내 위주로 골랐어요`
                  : resultWeather.isHot
                    ? `${resultWeather.temp}°C 더운 날씨라 시원한 실내 위주로 골랐어요`
                    : `${resultWeather.temp}°C 추운 날씨라 따뜻한 실내 위주로 골랐어요`}
              </p>
            </div>
          )}

          {/* 재추천 변경점 한 줄 — 이전 결과 대비 뭐가 달라졌는지 */}
          {changeNote && (
            <div className="mb-2 bg-[#E8F8F5] border border-[#3CDBC0]/40 rounded-2xl px-4 py-2.5 flex items-start gap-2 animate-fade-in-up">
              <span className="text-base leading-none mt-0.5">🔁</span>
              <p className="text-xs text-[#1A7A6E] leading-relaxed flex-1">{changeNote}</p>
              <button
                onClick={() => setChangeNote(null)}
                className="text-[#2AB5A0]/60 hover:text-[#2AB5A0] text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          <ResultCard
            results={result}
            travelTimes={resultTravelTimes}
            showTravelTime={meetingLocation?.type === 'auto'}
            midpointAreaName={midpointData?.areaName}
            purpose={purpose?.first ? { first: purpose.first, second: purpose.second ?? null } : undefined}
            vibeLabels={Object.values(vibe).flatMap((g) => [g.first, g.second]).filter((k): k is string => !!k).map((k) => VIBE_KEY_TO_LABEL[k] ?? k)}
            keywords={keywords}
            genreLabels={[purpose?.firstGenre, purpose?.secondGenre].filter((g): g is string => !!g)}
            excludeFoods={excludeFoods}
            treasurer={treasurer}
            onRetry={handleRetry}
            onAdjust={handleAdjust}
            onShare={handleShare}
            onReserve={() => setView('reserve')}
            onReject={handleReject}
          />

          {showRetryModal && (
            <RetryWeightModal
              vibe={vibe}
              budget={budget}
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

          {/* Step 0: 모임 유형 선택 */}
          {step === 0 && (
            <div className="px-4 py-3 flex flex-col gap-5">
              {/* 혼자 / 그룹 선택 버튼 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setAppMode('solo'); setSessionId(null); setGroupMembers([]); setGroupError(null); try { localStorage.removeItem(GROUP_SESSION_KEY); } catch { /* ignore */ } }}
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
                  onClick={() => { if (!['group-setup', 'group-waiting', 'group-ready'].includes(appMode)) setAppMode('group-setup'); }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                    ['group-setup', 'group-waiting', 'group-ready'].includes(appMode)
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-2xl">👥</span>
                  <span className={`text-sm font-black ${['group-setup', 'group-waiting', 'group-ready'].includes(appMode) ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>다같이 정할게요</span>
                  <span className="text-[10px] text-gray-400">링크로 각자 입력 →</span>
                </button>
              </div>

              {/* Solo: 인원수 + 목적 */}
              {appMode === 'solo' && (
                <>
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
                  <PurposeSelect
                    value={purpose ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null }}
                    onChange={setPurpose}
                  />
                </>
              )}

              {/* Group setup: 인원수 + 코스 + 링크 생성 */}
              {appMode === 'group-setup' && (
                <GroupSetup
                  expectedCount={expectedCount}
                  onExpectedCount={setExpectedCount}
                  hasSecond={groupHasSecond}
                  onHasSecond={setGroupHasSecond}
                  error={groupError}
                  creating={creatingSession}
                  onCreate={handleCreateSession}
                />
              )}

              {/* Group waiting/ready: 링크 공유 + 멤버 슬롯 */}
              {(appMode === 'group-waiting' || appMode === 'group-ready') && (
                <GroupWaiting
                  shareLink={sessionId ? `${window.location.origin}/join?id=${sessionId}` : ''}
                  copied={copied}
                  onCopy={handleCopyLink}
                  members={groupMembers}
                  expectedCount={expectedCount}
                />
              )}
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
              excludeFoods={excludeFoods}
              onExcludeFoodsChange={setExcludeFoods}
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
                <p className="text-xs text-gray-400 text-center">
                  {appMode === 'mode-select' && '혼자 정하기 또는 다같이 정하기를 선택해주세요'}
                  {appMode === 'solo' && '1차 목적을 선택해주세요'}
                  {appMode === 'group-setup' && '인원수와 코스를 선택한 뒤 링크를 생성해주세요'}
                  {appMode === 'group-waiting' && `최소 2명이 입력하면 다음으로 진행할 수 있어요 (현재 ${groupMembers.length}명)`}
                </p>
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
