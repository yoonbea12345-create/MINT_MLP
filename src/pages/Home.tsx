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
import { getAIRecommendation, enrichPlaces } from '../services/ai';
import type { PlaceRecommendation, UserInput, WeatherSummary, RegionScope } from '../services/ai';
import { saveResultSnapshot, loadResultSnapshot, clearResultSnapshot, saveHistory } from '../utils/history';
import { computeTravelTimes } from '../services/travelTime';
import { trackSessionDuration, trackEvent } from '../utils/analytics';
import { aggregateVibe, aggregateBudget, splitMemberKeywords } from '../utils/groupAggregate';
import type { GroupMember } from '../utils/groupAggregate';
import LoadingScreen from '../components/home/LoadingScreen';
import GroupWaiting from '../components/home/GroupWaiting';
import { encodeHostContext } from '../utils/groupLink';

type Step = 0 | 1 | 2 | 3;
type View = 'steps' | 'result' | 'reserve';

// 스텝2(관계) 2층 — 관계를 고르면 문맥에 맞는 '특별한 날' 칩이 등장한다.
// occasion 값은 api/recommend.ts의 OCCASION_EXTRA_KEYWORDS·OCCASION_HINT 키(생일/기념일/소개팅/축하/위로)에 맞춘다.
// occasion: null 은 "평범/그냥" — 특별 처리 없이 순수 관계만 반영.
interface OccChip { key: string; occasion: string | null; emoji: string; }
const OCCASION_BY_RELATION: Record<string, OccChip[]> = {
  '친구들': [
    { key: '축하할 일', occasion: '축하', emoji: '🎉' },
    { key: '위로가 필요', occasion: '위로', emoji: '🫂' },
    { key: '오랜만에',   occasion: null,   emoji: '👋' },
    { key: '그냥 한잔',  occasion: null,   emoji: '🍺' },
  ],
  '연인': [
    { key: '기념일',      occasion: '기념일', emoji: '💐' },
    { key: '소개팅·썸',   occasion: '소개팅', emoji: '💘' },
    { key: '생일',        occasion: '생일',   emoji: '🎂' },
    { key: '평범한 데이트', occasion: null,   emoji: '💑' },
  ],
  '가족': [
    { key: '생일',      occasion: '생일', emoji: '🎂' },
    { key: '축하할 일', occasion: '축하', emoji: '🎉' },
    { key: '명절·모임', occasion: null,   emoji: '🍱' },
    { key: '그냥 식사', occasion: null,   emoji: '🍚' },
  ],
};
// 미리보기 한 줄 — 유저가 자기 선택의 효과를 즉시 본다(입력 부담 0). OCCASION_HINT를 친근하게 축약.
const OCCASION_PREVIEW: Record<string, string> = {
  '생일':   '프라이빗룸·케이크 반입 OK 위주로 찾을게요 🎂',
  '기념일': '분위기 있는 조용한 좌석 위주로 찾을게요 🥂',
  '소개팅': '대화하기 좋은 조용한 곳 위주로 찾을게요 ☕',
  '축하':   '신나는 분위기·파티 가능한 곳 위주로 찾을게요 🎉',
  '위로':   '조용하고 편안하게 오래 머물 곳 위주로 찾을게요 🌙',
};
// 'mode-select' = 유형 미선택 상태(step 0), 'solo' = 혼자, 'group' = 다같이(호스트)
type AppMode = 'mode-select' | 'solo' | 'group';

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
  const [etcRelOpen, setEtcRelOpen] = useState(false); // '기타 콕!' 자유입력 모드
  const [occasionChip, setOccasionChip] = useState<string | null>(null); // 스텝2 2층에서 고른 '특별한 날' 칩 key(선택 표시용)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expectedCount, setExpectedCount] = useState<number>(3);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [pendingGroupRecommend, setPendingGroupRecommend] = useState(false);
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
  const [keywordsSecond, setKeywordsSecond] = useState<string[]>([]);
  const [excludeFoods, setExcludeFoods] = useState<string[]>([]);
  const [vibeCustom, setVibeCustom] = useState<Record<string, string>>({});
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [midpointData, setMidpointData] = useState<{
    midpoint: Coordinates;
    areaName: string;
    nearestAreas: string[];
    scope?: RegionScope | null;   // 행정단위(시/구/동) 스코프 — 재추천 시에도 같은 범위 유지
  } | null>(null);
  const [resultTravelTimes, setResultTravelTimes] = useState<ResultTravelTimes | null>(null);
  const [treasurer, setTreasurer] = useState<string | null>(null);
  const [resultWeather, setResultWeather] = useState<WeatherSummary | null>(null);
  const [changeNote, setChangeNote] = useState<string | null>(null);
  const [compromiseMessage, setCompromiseMessage] = useState<string | null>(null);
  const [showCompromiseToast, setShowCompromiseToast] = useState(false);

  const travelReqRef = useRef(0);
  const enrichReqRef = useRef(0);
  const isGroup = appMode === 'group';

  // 그룹 참여 링크 — 호스트가 정한 코스·지역을 쿼리에 실어 게스트에게 전달
  function groupShareLink(): string {
    if (!sessionId) return '';
    const ctx = encodeHostContext({
      purposeFirst: purpose?.first ?? null,
      firstGenre: purpose?.firstGenre ?? null,
      purposeSecond: purpose?.second ?? null,
      secondGenre: purpose?.secondGenre ?? null,
      relation: purpose?.relation ?? null,
      occasion: purpose?.occasion ?? null,
      regionType: meetingLocation?.type === 'auto' ? 'auto' : 'manual',
      regionName: meetingLocation?.type === 'manual' ? meetingLocation.area : null,
      regionId: meetingLocation?.type === 'manual' ? meetingLocation.regionId : null,
    });
    return `${window.location.origin}/join?id=${sessionId}&${ctx}`;
  }

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
      // 기타 콕! 자유입력 모드 복원 (occasion만 있고 relation 없으면 기타콕으로 입력한 것)
      if (d.purpose?.occasion && !d.purpose?.relation) setEtcRelOpen(true);
      // 스텝2 2층 칩 복원 — 관계+occasion이 매핑 칩과 일치하면 선택 표시 되살림
      if (d.purpose?.relation && d.purpose?.occasion) {
        const chip = OCCASION_BY_RELATION[d.purpose.relation]?.find((c) => c.occasion === d.purpose.occasion);
        if (chip) setOccasionChip(chip.key);
      }
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
      const g = JSON.parse(raw) as {
        savedAt?: number; sessionId?: string; expectedCount?: number;
        purpose?: PurposeValue; meetingLocation?: MeetingLocation;
      };
      if (!g.sessionId) return;
      if (typeof g.savedAt === 'number' && Date.now() - g.savedAt > GROUP_SESSION_TTL_MS) {
        localStorage.removeItem(GROUP_SESSION_KEY);
        return;
      }
      setSessionId(g.sessionId);
      if (typeof g.expectedCount === 'number') setExpectedCount(g.expectedCount);
      if (g.purpose) setPurpose(g.purpose);              // 호스트가 정한 코스 복원
      if (g.meetingLocation) setMeetingLocation(g.meetingLocation); // 호스트가 정한 지역 복원
      setStep(2);                 // 공유·대기 화면(step 2)으로 되돌린다
      setAppMode('group');        // 폴링이 다시 붙어 멤버 현황을 서버에서 재수화한다
    } catch { /* 손상된 그룹 세션 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그룹 호스트 세션 저장 — sessionId가 살아있는 동안 코스·지역까지 함께 보존(새로고침 복원용)
  useEffect(() => {
    if (appMode !== 'group' || !sessionId) return;
    try {
      localStorage.setItem(GROUP_SESSION_KEY, JSON.stringify({
        savedAt: Date.now(), sessionId, expectedCount, purpose, meetingLocation,
      }));
    } catch { /* 저장 실패는 치명적이지 않음 */ }
  }, [appMode, sessionId, expectedCount, purpose, meetingLocation]);

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

  // 그룹 대기 화면 폴링 — 입력 플로우(steps)에서만. 결과 화면에선 중단(불필요한 3초 폴링 낭비 방지)
  useEffect(() => {
    if (appMode !== 'group' || !sessionId || view !== 'steps') return;
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
  }, [appMode, sessionId, view]);

  // 대기 화면 "지금 추천받기" — 집계(setState) 반영 뒤 다음 렌더에서 추천을 트리거해 stale 상태를 피한다
  useEffect(() => {
    if (!pendingGroupRecommend) return;
    setPendingGroupRecommend(false);
    if (meetingLocation) handleConfirmMeetingLocation(meetingLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGroupRecommend]);

  // 호스트가 링크로 돌아왔을 때(?grp=recommend) 멤버가 모이면 자동으로 추천을 시작
  useEffect(() => {
    if (!isGroup || !sessionId || step !== 2) return;
    if (!new URLSearchParams(window.location.search).has('grp')) return;
    if (groupMembers.length < 2 || !meetingLocation) return;
    try { window.history.replaceState(null, '', '/app'); } catch { /* ignore */ }
    aggregateGroupMembers();
    setPendingGroupRecommend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup, sessionId, step, groupMembers.length]);

  async function handleCreateSession() {
    setCreatingSession(true);
    setGroupError(null);
    try {
      const hasSecond = !!(purpose?.second && purpose.second !== '없음');
      const res = await fetch('/api/session-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_count: expectedCount, has_second: hasSecond }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '링크 생성에 실패했어요. 다시 시도해주세요.');
      }
      const data = await res.json();
      setSessionId(data.id);
      setGroupMembers([]);
      // appMode/step은 그대로(step 2 공유 화면) — 링크가 생기면 같은 화면이 공유 UI로 전환된다
    } catch (e) {
      setGroupError((e as Error).message);
    } finally {
      setCreatingSession(false);
    }
  }

  function handleCopyLink() {
    const link = groupShareLink();
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function canNext(): boolean {
    if (step === 0) {
      // 혼자·그룹 모두 1차 목적(코스)을 골라야 다음으로
      if (appMode === 'solo' || appMode === 'group') return !!purpose?.first;
      return false; // mode-select
    }
    if (step === 1) {
      if (isGroup) return meetingLocation !== null; // 그룹: 지역 선택
      return true; // 혼자: 관계·특별한날은 선택사항
    }
    if (step === 2) {
      // 그룹: 링크 생성 + 최소 2명 참여해야 확정으로
      if (isGroup) return !!sessionId && groupMembers.length >= 2;
      // 혼자: 지역·장소
      return meetingLocation !== null && (meetingLocation.type === 'manual' || locations.length >= 2);
    }
    return true; // step 3
  }

  // 그룹 확정 진입 직전: 멤버들이 각자 낸 출발지·분위기·취향을 하나로 집계.
  // 코스·지역은 호스트가 정한 state(purpose·meetingLocation)를 그대로 쓴다(재집계하지 않음).
  function aggregateGroupMembers() {
    const groupLocations: LocationEntry[] = groupMembers
      .filter((m) => m.location_lat != null && m.location_lng != null)
      .map((m) => ({ name: m.member_name, lat: m.location_lat!, lng: m.location_lng! }));
    setLocations(groupLocations);
    setVibe(aggregateVibe(groupMembers));
    // 편식은 전원 합집합 — 한 명이라도 못 먹으면 그 음식은 제외. 키워드는 1차/2차 분리 집계.
    const { keywords: memberKeywords, keywordsSecond: memberKeywords2, excludeFoods: memberExcludes } = splitMemberKeywords(groupMembers);
    setKeywords(memberKeywords);
    setKeywordsSecond(memberKeywords2);
    setExcludeFoods(memberExcludes);
    setBudget(aggregateBudget(groupMembers));
  }

  function requestGroupRecommend() {
    if (!meetingLocation || groupMembers.length < 2) return;
    aggregateGroupMembers();
    setPendingGroupRecommend(true);
  }

  function handleNext() {
    // 그룹: 대기 화면에서 바로 추천으로 진입. 집계 state 반영 뒤 effect에서 추천을 시작한다.
    if (step === 2 && isGroup) {
      requestGroupRecommend();
      return;
    }
    setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    // 그룹: 링크 생성 후 코스·지역을 바꾸면 이미 공유된 링크의 파라미터와 어긋난다.
    // 공유(step2)에서 뒤로가기는 '링크 취소 후 재설정'으로 처리해 항상 링크=설정이 일치하게 유지.
    if (isGroup && step === 2 && sessionId) {
      const ok = window.confirm('코스·지역을 바꾸려면 지금 링크를 취소하고 다시 설정해야 해요.\n계속할까요? (이미 공유한 링크는 무효가 됩니다)');
      if (!ok) return;
      setSessionId(null);
      setGroupMembers([]);
      try { localStorage.removeItem(GROUP_SESSION_KEY); } catch { /* ignore */ }
      setStep(0); // 코스·지역은 유지 — 수정 후 다시 링크 생성
      return;
    }
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
      const validLocs = locations.filter((l) => l.lat != null && l.lng != null);
      if (region) {
        handleMidpointSelect(region);
      } else if (loc.scope && loc.lat != null && loc.lng != null) {
        // 시/구/동 단위로 검색·확정된 지역 — 그 행정단위 범위 안에서만 추천.
        // searchAreas(시=유명상권 여러 곳, 구/동=그 자체)로 네이버를 검색하고,
        // regionScope(matchTokens)로 결과 주소를 그 범위로 고정한다.
        const midpoint = { lat: loc.lat, lng: loc.lng };
        const scope: RegionScope = {
          level: loc.scope.level,
          matchTokens: loc.scope.matchTokens,
          centerLat: loc.lat,
          centerLng: loc.lng,
        };
        setMidpointData({ midpoint, areaName: loc.area, nearestAreas: loc.scope.searchAreas, scope });
        setResultTravelTimes(null);
        handleRecommend(midpoint, loc.scope.searchAreas, validLocs, undefined, [], undefined, scope);
      } else if (loc.lat != null && loc.lng != null) {
        // (구버전 폴백) 스코프 없이 좌표만 있는 경우 — 검색한 지역명을 검색어 1순위로.
        const midpoint = { lat: loc.lat, lng: loc.lng };
        const nearby = findNearestAreas(midpoint, 3).filter((a) => a !== loc.area);
        const searchAreas = [loc.area, ...nearby].slice(0, 3);
        setMidpointData({ midpoint, areaName: loc.area, nearestAreas: searchAreas });
        setResultTravelTimes(null);
        handleRecommend(midpoint, searchAreas, validLocs);
      } else {
        // 좌표 없는 텍스트만(구버전·자동완성 미선택) — 최후 폴백
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
    scope: RegionScope | null = null,
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
        groupSize: isGroup ? (expectedCount >= 5 ? '5명 이상' : expectedCount >= 3 ? '3~4명' : '2명') : groupSize,
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
          // 1차 키워드 — 서버 검증 한도(개수 10 · 항목당 30자)에 맞춰 잘라서 전송
          const allKw = [...keywords, ...Object.values(vibeCustom).filter(Boolean)]
            .map((k) => k.trim().slice(0, 30))
            .filter(Boolean)
            .slice(0, 10);
          return allKw.length > 0 ? { keywords: allKw } : {};
        })()),
        ...((() => {
          // 2차 키워드 — 2차 코스가 있을 때만
          const kw2 = keywordsSecond.map((k) => k.trim().slice(0, 30)).filter(Boolean).slice(0, 10);
          return kw2.length > 0 ? { keywordsSecond: kw2 } : {};
        })()),
      };

      // AI 호출 동안 25→90% 타이머 (Claude 응답이 단일 fetch라 내부 진행도 불가)
      aiProgressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 92) return prev;
          // 초반엔 빠르게, 92% 가까울수록 느리게 (후처리 분리로 총 소요가 짧아져 살짝 가속)
          const gap = 92 - prev;
          return prev + gap * 0.055;
        });
      }, 250);

      // 실제 마일스톤 2: AI 추천 완료 (재추천 시 이전 장소 제외)
      const { places: recommendation, weather } = await getAIRecommendation(input, midpoint, [], excludeNames, nearestAreas, scope);
      clearInterval(aiProgressInterval);
      setLoadingProgress(100); // 실제 완료

      setResult(recommendation);
      setResultWeather(weather);
      if (changeReason) {
        setChangeNote(buildChangeNote(prevFirst, recommendation[0], midpoint, changeReason));
      }

      // 사진·카카오URL 후처리 — 결과를 먼저 그린 뒤 별도 호출로 채운다(초기 로딩 단축).
      // 재추천 레이스 방지용 reqId 가드 (오래된 응답이 새 결과를 덮지 않게).
      const enrichId = ++enrichReqRef.current;
      enrichPlaces(recommendation.map((p) => ({ placeName: p.placeName, lat: p.lat, lng: p.lng, area: p.area })))
        .then((enriched) => {
          if (enrichId !== enrichReqRef.current || enriched.length === 0) return;
          setResult((prev) => prev
            ? prev.map((p) => {
                const e = enriched.find((x) => x.placeName === p.placeName);
                return e ? { ...p, kakaoPlaceUrl: e.kakaoPlaceUrl ?? p.kakaoPlaceUrl, imageUrl: e.imageUrl ?? p.imageUrl } : p;
              })
            : prev);
        });

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
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, undefined, exclude, 'retry', midpointData.scope ?? null);
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
    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, labeledWeights, exclude, 'adjust', midpointData.scope ?? null);
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

    handleRecommend(midpointData.midpoint, midpointData.nearestAreas, validLocs, rejectWeights, exclude, reason, midpointData.scope ?? null);
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
                // 결과에서 뒤로가기 = 바로 이전 입력 화면(마지막 스텝)으로. 입력값은 그대로 유지해 바로 수정·재추천 가능.
                setChangeNote(null);
                setView('steps');
                setStep(3);
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 뒤로
            </button>
            <button
              onClick={() => {
                // 처음부터 다시 — 전체 초기화
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
                setOccasionChip(null);
                setEtcRelOpen(false);
                setCustomOccasion('');
                setVibe({});
                setBudget(null);
                setKeywords([]);
                setKeywordsSecond([]);
                setExcludeFoods([]);
                setVibeCustom({});
                setMeetingLocation(null);
                setMidpointData(null);
                setTreasurer(null);
                setResultWeather(null);
                setChangeNote(null);
              }}
              className="text-[#3CDBC0] font-black text-lg"
              title="처음부터 다시"
            >
              MINT
            </button>
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

        {/* 헤더 — 노치/상단 안전영역 반영(인앱·일반 세로모드에선 16px 그대로) */}
        <div className="flex-shrink-0 text-center pt-[max(1rem,env(safe-area-inset-top))] px-4 relative">
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

        {/* 스텝 프로그레스 — 전 화면 4단계 고정 (그룹은 라벨만 교체) */}
        <div className="flex-shrink-0">
          <StepProgress current={step} total={4} labels={isGroup ? ['코스', '지역', '공유', '확정'] : undefined} />
        </div>

        {/* 스텝 제목 */}
        <div className="flex-shrink-0 text-center px-4 pt-2 pb-0">
          <h2 className="text-xl font-black text-gray-800">
            {step === 0 && (isGroup ? '무슨 코스로 모일까요?' : '어떤 모임인가요?')}
            {step === 1 && (isGroup ? '어디서 만날까요?' : '누구와 함께하나요?')}
            {step === 2 && (isGroup ? '친구들을 초대하세요' : '어디서 만날까요?')}
            {step === 3 && (isGroup ? '다 모였어요!' : '원하는 분위기를 골라봐요')}
          </h2>
          {step === 1 && !isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">모두 선택사항 · 선택할수록 추천이 정확해져요</p>
          )}
          {step === 1 && isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">중간지점 자동 · 또는 만날 동네 직접 선택</p>
          )}
          {step === 2 && !isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">원하는 동네 선택 · 또는 중간지점을 AI에게 맡겨요</p>
          )}
          {step === 2 && isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">링크를 공유하고 각자 입력을 기다려요</p>
          )}
          {step === 3 && !isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">최소 1개 이상 선택 · 많이 고를수록 추천이 정확해져요</p>
          )}
          {step === 3 && isGroup && (
            <p className="text-xs text-[#2AB5A0] font-medium mt-1">모두의 취향이 모였어요 · 추천을 받아보세요</p>
          )}
        </div>

        {/* 콘텐츠 — 짧은 스텝은 세로 중앙정렬(빈 공간 제거), 길면 정상 스크롤 */}
        <div key={step} className="flex-1 min-h-0 overflow-y-auto animate-fade-in-up">
          <div className="min-h-full flex flex-col justify-center">

          {/* Step 0: 모임 유형 선택 */}
          {step === 0 && (
            <div className="px-4 py-3 flex flex-col gap-4">
              {/* 혼자 / 그룹 선택 버튼 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setAppMode('solo'); setSessionId(null); setGroupMembers([]); setGroupError(null); try { localStorage.removeItem(GROUP_SESSION_KEY); } catch { /* ignore */ } }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                    appMode === 'solo'
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-lg">🙋</span>
                  <span className={`text-[13px] font-black ${appMode === 'solo' ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>혼자 정할게요</span>
                  <span className="text-[10px] text-gray-400">내가 직접 입력</span>
                </button>
                <button
                  onClick={() => { if (appMode !== 'group') setAppMode('group'); }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                    isGroup
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20'
                      : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
                  }`}
                >
                  <span className="text-lg">👥</span>
                  <span className={`text-[13px] font-black ${isGroup ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>다같이 정할게요</span>
                  <span className="text-[10px] text-gray-400">호스트가 코스·지역 선점 →</span>
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
                          className={`flex items-center justify-center h-10 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
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

              {/* Group: 참여 인원수 + 코스(목적) — 호스트가 여기서 코스를 선점 */}
              {isGroup && (
                <>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">참여 인원수 (호스트 포함)</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setExpectedCount(n)}
                          className={`flex items-center justify-center h-10 rounded-xl border-2 text-sm font-black transition-all active:scale-[0.97] ${
                            expectedCount === n
                              ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0] shadow-md shadow-[#3CDBC0]/20'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-[#3CDBC0]/50'
                          }`}
                        >
                          {n === 6 ? '6+' : n}
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
            </div>
          )}

          {/* Step 1 (그룹): 만날 지역 — 중간지점 자동 or 임의 지역. 출발지는 게스트가 각자 입력 */}
          {step === 1 && isGroup && (
            <div className="pb-4">
              <MeetingLocationSelect value={meetingLocation} onSelect={setMeetingLocation} />
              <p className="px-5 -mt-1 text-xs text-gray-400 leading-relaxed">
                {meetingLocation?.type === 'auto'
                  ? '참여자들이 각자 출발지를 입력하면 전원 기준 중간지점을 계산해요.'
                  : meetingLocation?.type === 'manual'
                    ? '참여자는 출발지 없이 분위기만 고르면 돼요.'
                    : '중간지점을 맡기거나, 만날 동네를 직접 골라주세요.'}
              </p>
            </div>
          )}

          {/* Step 1 (혼자): 오늘 모임 성격 — 한 줄 4개 (친목/데이트/가족/기타 콕!) */}
          {step === 1 && !isGroup && (() => {
            // relation 값은 recommend.ts의 키워드 매핑과 호환되게 매핑(연인·가족은 전용 키워드 있음)
            const REL_OPTIONS = [
              { key: '친목', relation: '친구들', emoji: '🍻' },
              { key: '데이트', relation: '연인', emoji: '💑' },
              { key: '가족', relation: '가족', emoji: '👨‍👩‍👧' },
            ];
            const curRelation = purpose?.relation ?? null;
            const occChips = curRelation ? (OCCASION_BY_RELATION[curRelation] ?? []) : [];
            const previewHint = occasionChip
              ? (OCCASION_PREVIEW[OCCASION_BY_RELATION[curRelation ?? '']?.find((c) => c.key === occasionChip)?.occasion ?? ''] ?? null)
              : null;
            function pickRel(relation: string) {
              setEtcRelOpen(false);
              setCustomOccasion('');
              setOccasionChip(null); // 관계가 바뀌면 2층 선택 초기화
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                // 같은 걸 다시 누르면 해제
                const next = base.relation === relation ? null : relation;
                return { ...base, relation: next, occasion: null };
              });
            }
            // 스텝2 2층 — '특별한 날' 칩. 같은 칩 재클릭 시 해제. occasion 값은 recommend.ts 키에 매핑.
            function pickOccasion(chip: OccChip) {
              setOccasionChip((cur) => {
                const isOff = cur === chip.key;
                setPurpose((prev) => {
                  const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                  return { ...base, occasion: isOff ? null : chip.occasion };
                });
                return isOff ? null : chip.key;
              });
            }
            function openEtc() {
              setEtcRelOpen(true);
              setOccasionChip(null);
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                return { ...base, relation: null };
              });
            }
            // 기타 콕! 자유 입력 — 메뉴 콕과 동일하게 사용자가 직접 상황을 적어 추천에 반영(occasion으로 전달)
            function handleEtcText(text: string) {
              setCustomOccasion(text);
              setPurpose((prev) => {
                const base = prev ?? { first: null, firstRaw: null, second: '없음', secondRaw: '없음', relation: null, occasion: null };
                return { ...base, occasion: text.trim() ? text : null };
              });
            }
            return (
              <div className="px-4 flex flex-col gap-3 pt-3 pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">오늘 모임은?</p>
                <div className="grid grid-cols-4 gap-2">
                  {REL_OPTIONS.map((opt) => {
                    const selected = !etcRelOpen && curRelation === opt.relation;
                    return (
                      <button key={opt.key} onClick={() => pickRel(opt.relation)}
                        className={`flex flex-col items-center justify-center gap-1 h-[72px] rounded-2xl border-2 transition-all active:scale-[0.97] ${selected ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
                        <span className="text-xl leading-none">{opt.emoji}</span>
                        <span className={`text-xs font-bold leading-none ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>{opt.key}</span>
                      </button>
                    );
                  })}
                  <button onClick={openEtc}
                    className={`flex flex-col items-center justify-center gap-1 h-[72px] rounded-2xl border-2 transition-all active:scale-[0.97] ${etcRelOpen ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
                    <span className="text-xl leading-none">🎯</span>
                    <span className={`text-xs font-bold leading-none ${etcRelOpen ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>기타 콕!</span>
                  </button>
                </div>

                {/* 2층 — 관계를 고르면 문맥형 '특별한 날' 칩이 부드럽게 등장(선택사항) */}
                {occChips.length > 0 && !etcRelOpen && (
                  <div className="animate-fade-in-up flex flex-col gap-2 pt-1">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">오늘 좀 특별해요?</p>
                    <div className="grid grid-cols-4 gap-2">
                      {occChips.map((chip) => {
                        const on = occasionChip === chip.key;
                        return (
                          <button key={chip.key} onClick={() => pickOccasion(chip)}
                            className={`flex flex-col items-center justify-center gap-1 h-[64px] rounded-2xl border-2 transition-all active:scale-[0.97] ${on ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
                            <span className="text-lg leading-none">{chip.emoji}</span>
                            <span className={`text-[11px] font-bold leading-none text-center px-0.5 ${on ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>{chip.key}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 살아있는 미리보기 — 선택 효과를 즉시 보여줌(입력 부담 0) */}
                    {previewHint && (
                      <div className="animate-fade-in-up flex items-center gap-1.5 rounded-xl bg-[#E8F8F5] px-3 py-2 mt-0.5">
                        <span className="text-sm">✨</span>
                        <span className="text-[12px] font-medium text-[#2AB5A0] leading-snug">{previewHint}</span>
                      </div>
                    )}
                  </div>
                )}

                {etcRelOpen && (
                  <div className="animate-fade-in-up">
                    <input
                      type="text"
                      autoFocus
                      value={customOccasion}
                      onChange={(e) => handleEtcText(e.target.value)}
                      placeholder="🔎 상황을 직접 적어요 (예: 회식, 상견례, 생일, 졸업)"
                      className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors ${
                        customOccasion.trim() ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200'
                      }`}
                    />
                    <p className="text-[11px] text-gray-400 mt-1.5">적은 상황을 반영해 분위기·메뉴를 맞춰 추천해요</p>
                  </div>
                )}

                <p className="text-[11px] text-[#2AB5A0] font-medium mt-1">모두 선택사항 · 고를수록 추천이 정확해져요</p>
              </div>
            );
          })()}

          {/* Step 2 (혼자): 만날 장소 선택 */}
          {step === 2 && !isGroup && (
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

          {/* Step 2 (그룹): 링크 생성 → 공유 → 실시간 참여 현황 */}
          {step === 2 && isGroup && (
            <div className="px-4 py-3">
              {!sessionId ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-5 text-center">
                    <div className="text-3xl mb-2">🔗</div>
                    <p className="font-black text-gray-800 mb-1">참여 링크를 만들어요</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      친구들은 가입 없이 링크만 열면 분위기만 고르면 끝.<br />
                      코스·지역은 이미 골라뒀으니 링크에 담겨 전달돼요.
                    </p>
                  </div>
                  {groupError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">{groupError}</div>
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
                    {creatingSession ? '생성 중...' : '링크 생성하기 →'}
                  </button>
                </div>
              ) : (
                <GroupWaiting
                  shareLink={groupShareLink()}
                  copied={copied}
                  onCopy={handleCopyLink}
                  onRecommend={requestGroupRecommend}
                  members={groupMembers}
                  expectedCount={expectedCount}
                  canRecommend={canNext()}
                  recommending={pendingGroupRecommend || loading}
                />
              )}
            </div>
          )}

          {/* Step 3 (혼자): 분위기 */}
          {step === 3 && !isGroup && (
            <VibeSelect
              value={vibe}
              onChange={setVibe}
              purpose={purpose ? { first: purpose.first, second: purpose.second } : undefined}
              budget={budget}
              onBudgetChange={setBudget}
              keywords={keywords}
              onKeywordsChange={setKeywords}
              keywordsSecond={keywordsSecond}
              onKeywordsSecondChange={setKeywordsSecond}
              excludeFoods={excludeFoods}
              onExcludeFoodsChange={setExcludeFoods}
            />
          )}

          {/* Step 3 (그룹): 확정 요약 */}
          {step === 3 && isGroup && (
            <div className="px-4 py-3 flex flex-col gap-3">
              <div className="bg-white rounded-2xl border-2 border-[#3CDBC0]/30 shadow-sm p-5">
                <p className="text-[10px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-3">모임 요약</p>
                <div className="flex flex-col gap-2.5 text-sm">
                  <div className="flex gap-2"><span className="text-gray-400 w-12 flex-shrink-0">코스</span>
                    <span className="font-bold text-gray-800">🍀 {purpose?.first ?? '-'}{purpose?.firstGenre ? `(${purpose.firstGenre})` : ''}{purpose?.second && purpose.second !== '없음' ? ` → ${purpose.second}${purpose?.secondGenre ? `(${purpose.secondGenre})` : ''}` : ''}</span>
                  </div>
                  <div className="flex gap-2"><span className="text-gray-400 w-12 flex-shrink-0">지역</span>
                    <span className="font-bold text-gray-800">📍 {meetingLocation?.type === 'auto' ? '중간지점 자동' : meetingLocation?.type === 'manual' ? meetingLocation.area : '-'}</span>
                  </div>
                  <div className="flex gap-2"><span className="text-gray-400 w-12 flex-shrink-0">인원</span>
                    <span className="font-bold text-gray-800">👥 {groupMembers.length}명 참여</span>
                  </div>
                </div>
              </div>

              {/* 모인 취향 */}
              {(() => {
                const vibeLabels = Object.values(vibe).flatMap((g) => [g.first, g.second]).filter((k): k is string => !!k).map((k) => VIBE_KEY_TO_LABEL[k] ?? k);
                if (vibeLabels.length === 0 && !budget && keywords.length === 0 && excludeFoods.length === 0) return null;
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-[10px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-2.5">모두의 취향 (자동 종합)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vibeLabels.map((l) => <span key={l} className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">{l}</span>)}
                      {budget && <span className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">💰 {budget}</span>}
                      {keywords.map((k) => <span key={k} className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-2.5 py-1 rounded-full">{k}</span>)}
                      {excludeFoods.map((f) => <span key={f} className="bg-red-50 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full">🚫 {f}</span>)}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex-shrink-0 mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* 하단 버튼 — 홈 인디케이터/네이티브 툴바와 겹치지 않게 안전영역 반영
            (카톡 인앱 env=0 → 32px 그대로, 일반 브라우저에서만 더 벌어짐) */}
        <div className="flex-shrink-0 px-4 pt-2 pb-[max(2rem,calc(env(safe-area-inset-bottom)+0.75rem))] flex flex-col gap-2">
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
                  {step === 2 && isGroup && sessionId ? `${groupMembers.length}명으로 추천받기` : '다음'}
                </button>
              </div>
              {!canNext() && (
                <p className="text-xs text-gray-400 text-center">
                  {step === 0 && appMode === 'mode-select' && '혼자 정하기 또는 다같이 정하기를 선택해주세요'}
                  {step === 0 && appMode === 'solo' && '1차 목적을 선택해주세요'}
                  {step === 0 && isGroup && '참여 인원과 1차 코스를 골라주세요'}
                  {step === 1 && isGroup && '만날 지역을 선택해주세요'}
                  {step === 2 && isGroup && !sessionId && '링크를 생성해 친구들에게 공유해주세요'}
                  {step === 2 && isGroup && sessionId && `최소 2명이 입력하면 추천으로 진행할 수 있어요 (현재 ${groupMembers.length}명)`}
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
