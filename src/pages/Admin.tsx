import { useState } from 'react';
import { isTrackingPaused, setTrackingPaused } from '../utils/analytics';
import type { ReservationRecord } from './Reserve';

// 어드민 — 모든 데이터 접근은 /api/admin-data(서버 비밀번호 검증 + service role) 경유.
// 클라이언트 하드코딩 비밀번호와 anon 키 직접 select는 보안 문제로 제거됨.
//
// 기획점검(fable5) 반영: analytics.ts 이벤트 15종을 퍼널·거절사유·재시도 관점으로 노출.

// 쿠폰 알림신청 순 수요(add-remove) 행 — payload에 실려온 매장 메타 포함
interface CouponNotifyRow {
  couponId: string;
  shopName: string;
  benefitType: string;
  area: string;
  tier: string;
  adds: number;
  removes: number;
  net: number;
}

interface AdminAnalytics {
  landingViews: number;
  ctaClicks: number;
  sessions: number;
  reservationAttempts: number;
  reservationCompleted: number;
  recommendRequests: number;
  recommendShown: number;
  recommendErrors: number;
  placeClickRank1: number;
  placeClickSecond: number;
  placeClickCandidate: number;
  placeClickThird: number;
  candidatesExpand: number;
  certBadgeOpen: number;
  stepNext0: number;
  stepNext1: number;
  stepNext2: number;
  locationSearchZero: number;
  locationSearchError: number;
  pwaInstallAccepted: number;
  pwaInstallDismissed: number;
  groupSessionCreate: number;
  deeplinkCatchtable: number;
  deeplinkNaver: number;
  deeplinkKakaomap: number;
  rejectExpensive: number;
  rejectFar: number;
  rejectVibe: number;
  retryFresh: number;
  retryAdjust: number;
  kakaoShares: number;
  kakaoShareFallbacks: number;
  pwaInstallClicks: number;
  demoPlaceClicks: number;
  avgStaySeconds: number | null;
  medianStaySeconds: number | null;
  // 탭 셸
  tabClicks: Record<string, number>;
  tabClicksTotal: number;
  meetingsEmptyCtaClicks: number;
  // 민트샵(가짜 문)
  shopCouponClicks: number;
  shopFilterClicks: Record<string, number>;
  shopFilterClicksTotal: number;
  shopPageChanges: number;
  couponNotifyAdds: number;
  couponNotifyRemoves: number;
  couponNotifyTop: CouponNotifyRow[];
  // 총무 플랜 퍼널
  planEntryClicks: number;
  planDetailViews: number;
  planPreregisters: number;
  planDetailCloses: number;
  // 발굴·찜·방문인증
  wishlistAdds: number;
  wishlistRemoves: number;
  wishlistOpens: number;
  discoverGemMapOpens: number;
  visitCertOpens: number;
  visitCertDones: number;
  visitCertFails: number;
  pointsStoreTeaserClicks: number;
  // 참석 확정
  rsvpGoing: number;
  rsvpNotGoing: number;
  rsvpUndecided: number;
  rsvpSubmitTotal: number;
}

const EMPTY_ANALYTICS: AdminAnalytics = {
  landingViews: 0, ctaClicks: 0, sessions: 0, reservationAttempts: 0, reservationCompleted: 0,
  recommendRequests: 0, recommendShown: 0, recommendErrors: 0,
  placeClickRank1: 0, placeClickSecond: 0, placeClickCandidate: 0, placeClickThird: 0,
  candidatesExpand: 0, certBadgeOpen: 0,
  stepNext0: 0, stepNext1: 0, stepNext2: 0,
  locationSearchZero: 0, locationSearchError: 0,
  pwaInstallAccepted: 0, pwaInstallDismissed: 0, groupSessionCreate: 0,
  deeplinkCatchtable: 0, deeplinkNaver: 0, deeplinkKakaomap: 0,
  rejectExpensive: 0, rejectFar: 0, rejectVibe: 0,
  retryFresh: 0, retryAdjust: 0,
  kakaoShares: 0, kakaoShareFallbacks: 0, pwaInstallClicks: 0, demoPlaceClicks: 0,
  avgStaySeconds: null, medianStaySeconds: null,
  tabClicks: {}, tabClicksTotal: 0, meetingsEmptyCtaClicks: 0,
  shopCouponClicks: 0, shopFilterClicks: {}, shopFilterClicksTotal: 0, shopPageChanges: 0,
  couponNotifyAdds: 0, couponNotifyRemoves: 0, couponNotifyTop: [],
  planEntryClicks: 0, planDetailViews: 0, planPreregisters: 0, planDetailCloses: 0,
  wishlistAdds: 0, wishlistRemoves: 0, wishlistOpens: 0, discoverGemMapOpens: 0,
  visitCertOpens: 0, visitCertDones: 0, visitCertFails: 0, pointsStoreTeaserClicks: 0,
  rsvpGoing: 0, rsvpNotGoing: 0, rsvpUndecided: 0, rsvpSubmitTotal: 0,
};

// 탭·필터 key → 화면 라벨 (서버가 모르는 key를 보내도 key 그대로 렌더된다)
const TAB_LABELS: Record<string, string> = {
  home: '홈', meetings: '내 모임', discover: '발굴', shop: '민트샵', profile: '프로필',
};
const TAB_ORDER = ['home', 'meetings', 'discover', 'shop', 'profile'];
const SHOP_FILTER_LABELS: Record<string, string> = {
  all: '전체', side: '사이드', drink: '음료', discount: '할인',
  time: '시간대', group: '모임', first_visit: '첫 방문',
};

type RangeKey = 'today' | '7d' | '30d' | 'all';
const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
  { key: 'all', label: '전체' },
];

function rangeToFrom(range: RangeKey): string | undefined {
  const now = Date.now();
  if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (range === '7d') return new Date(now - 7 * 86400000).toISOString();
  if (range === '30d') return new Date(now - 30 * 86400000).toISOString();
  return undefined; // all
}

async function callAdmin(password: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function pct(numer: number, denom: number): string {
  if (denom <= 0) return '0.0';
  return ((numer / denom) * 100).toFixed(1);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM: 엑셀 한글 깨짐 방지
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PasswordGate({ onUnlock, verifying, error }: {
  onUnlock: (password: string) => void;
  verifying: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) onUnlock(input.trim());
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8] flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-xs text-center">
        <div className="text-3xl mb-3">🔒</div>
        <h1 className="text-lg font-black text-gray-800 mb-1">MINT 어드민</h1>
        <p className="text-sm text-gray-400 mb-6">비밀번호를 입력해주세요</p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className={`w-full px-4 py-3 rounded-xl border-2 text-center text-lg tracking-widest outline-none transition-all ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#36CFA0]'}`}
        />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <button
          type="submit"
          disabled={verifying}
          className="w-full mt-4 bg-[#36CFA0] text-white font-black py-3 rounded-xl hover:bg-[#2AB58C] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
        >
          {verifying ? '확인 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}

// ── 작은 프레젠테이션 컴포넌트 ──
function StatCard({ label, value, unit, sub, highlight }: {
  label: string; value: string | number; unit?: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${highlight ? 'border-2 border-[#36CFA0] bg-teal-50' : 'bg-white border border-gray-100'}`}>
      <div className={`text-xs mb-1 ${highlight ? 'text-[#36CFA0] font-bold' : 'text-gray-400'}`}>{label}</div>
      <div className="text-2xl font-black text-[#36CFA0]">{value}{unit && <span className="text-sm text-gray-300 font-bold"> {unit}</span>}</div>
      {sub && <div className="text-xs text-gray-300 mt-1">{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, total, color = '#36CFA0' }: {
  label: string; count: number; total: number; color?: string;
}) {
  const p = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-gray-500 font-bold shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="w-16 text-right text-gray-500 shrink-0">{count}건 ({p}%)</span>
    </div>
  );
}

export default function Admin() {
  const [password, setPassword] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [records, setRecords] = useState<ReservationRecord[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(() => isTrackingPaused());
  const [dbError, setDbError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('all');

  const a = analytics;
  const rejectTotal = a.rejectExpensive + a.rejectFar + a.rejectVibe;
  const retryTotal = a.retryFresh + a.retryAdjust;
  const deeplinkTotal = a.deeplinkCatchtable + a.deeplinkNaver + a.deeplinkKakaomap;
  const placeClickTotal = a.placeClickRank1 + a.placeClickSecond + a.placeClickCandidate + a.placeClickThird;
  const tabCounts = a.tabClicks ?? {};
  const tabTotal = TAB_ORDER.reduce((sum, k) => sum + (tabCounts[k] ?? 0), 0);
  const shopFilterEntries = Object.entries(a.shopFilterClicks ?? {}).sort((x, y) => y[1] - x[1]);
  const shopFilterTotal = shopFilterEntries.reduce((sum, [, v]) => sum + v, 0);
  const couponTop = a.couponNotifyTop ?? [];
  const rsvpTotal = a.rsvpGoing + a.rsvpNotGoing + a.rsvpUndecided;

  function applyData(data: { analytics?: Partial<AdminAnalytics>; reservations?: ReservationRecord[] }) {
    // 서버가 아직 새 필드를 안 보내는 배포 시점에도 기본값으로 안전하게 렌더된다.
    setAnalytics({ ...EMPTY_ANALYTICS, ...(data.analytics ?? {}) });
    setRecords(Array.isArray(data.reservations) ? data.reservations : []);
  }

  async function loadData(pw: string, r: RangeKey = range) {
    setLoading(true);
    setDbError(null);
    try {
      applyData(await callAdmin(pw, { from: rangeToFrom(r) }));
    } catch (e) {
      setDbError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(pw: string) {
    setVerifying(true);
    setGateError(null);
    try {
      const data = await callAdmin(pw, { from: rangeToFrom(range) });
      setPassword(pw);
      applyData(data);
    } catch (e) {
      setGateError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  function handleRange(r: RangeKey) {
    setRange(r);
    if (password) loadData(password, r);
  }

  async function handleDelete(id: string) {
    if (!password) return;
    try {
      await callAdmin(password, { action: 'delete_reservation', id });
      setRecords((prev) => prev.filter((rec) => rec.id !== id));
    } catch (e) {
      setDbError((e as Error).message);
    }
  }

  async function handleClear() {
    if (!password || !confirm('전체 예약 내역을 삭제할까요? (되돌릴 수 없어요 — 필요하면 먼저 CSV로 내보내세요)')) return;
    try {
      await callAdmin(password, { action: 'clear_reservations' });
      setRecords([]);
    } catch (e) {
      setDbError((e as Error).message);
    }
  }

  async function handleClearAnalytics() {
    if (!password || !confirm('분석 이벤트 전체를 초기화할까요? (되돌릴 수 없어요 — 필요하면 먼저 CSV로 내보내세요)')) return;
    try {
      await callAdmin(password, { action: 'clear_events' });
      setAnalytics(EMPTY_ANALYTICS);
    } catch (e) {
      setDbError((e as Error).message);
    }
  }

  function handleExport() {
    const label = RANGE_LABELS.find((r) => r.key === range)?.label ?? '전체';
    const rows: (string | number | null)[][] = [
      [`MINT 어드민 지표 — 기간: ${label}`, `내보낸 시각: ${formatDate(new Date().toISOString())}`],
      [],
      ['지표', '값'],
      ['랜딩 조회', a.landingViews],
      ['CTA 클릭', a.ctaClicks],
      ['앱 진입(세션)', a.sessions],
      ['예약 시도(이벤트)', a.reservationAttempts],
      ['예약 완료(테이블)', a.reservationCompleted],
      ['추천 요청', a.recommendRequests],
      ['추천 노출', a.recommendShown],
      ['추천 에러', a.recommendErrors],
      ['클릭·1순위', a.placeClickRank1],
      ['클릭·2차', a.placeClickSecond],
      ['클릭·대안', a.placeClickCandidate],
      ['클릭·3차', a.placeClickThird],
      ['후보 펼침', a.candidatesExpand],
      ['인증 뱃지 열람', a.certBadgeOpen],
      ['입력 1단계 통과', a.stepNext0],
      ['입력 2단계 통과', a.stepNext1],
      ['입력 3단계 통과', a.stepNext2],
      ['검색 0건', a.locationSearchZero],
      ['검색 에러', a.locationSearchError],
      ['PWA 설치 수락', a.pwaInstallAccepted],
      ['PWA 설치 취소', a.pwaInstallDismissed],
      ['그룹 링크 생성', a.groupSessionCreate],
      ['딥링크·캐치테이블', a.deeplinkCatchtable],
      ['딥링크·네이버', a.deeplinkNaver],
      ['딥링크·카카오맵', a.deeplinkKakaomap],
      ['거절·비쌈', a.rejectExpensive],
      ['거절·멂', a.rejectFar],
      ['거절·분위기', a.rejectVibe],
      ['재시도·새로', a.retryFresh],
      ['재시도·조정', a.retryAdjust],
      ['카카오 공유', a.kakaoShares],
      ['카카오 공유 폴백', a.kakaoShareFallbacks],
      ['PWA 설치 클릭', a.pwaInstallClicks],
      ['데모 장소 클릭', a.demoPlaceClicks],
      ['평균 체류(초)', a.avgStaySeconds],
      ['중앙값 체류(초)', a.medianStaySeconds],
      // ↓ 신규 지표는 기존 행 순서를 건드리지 않고 뒤에만 추가한다.
      ['탭·홈', tabCounts.home ?? 0],
      ['탭·내 모임', tabCounts.meetings ?? 0],
      ['탭·발굴', tabCounts.discover ?? 0],
      ['탭·민트샵', tabCounts.shop ?? 0],
      ['탭·프로필', tabCounts.profile ?? 0],
      ['탭 이동 합계', a.tabClicksTotal],
      ['빈 모임 CTA 클릭', a.meetingsEmptyCtaClicks],
      ['민트샵 쿠폰 탭', a.shopCouponClicks],
      ['민트샵 필터 클릭', a.shopFilterClicksTotal],
      ...shopFilterEntries.map(([key, count]) => [`민트샵 필터·${SHOP_FILTER_LABELS[key] ?? key}`, count]),
      ['민트샵 페이지 이동', a.shopPageChanges],
      ['쿠폰 알림신청', a.couponNotifyAdds],
      ['쿠폰 알림취소', a.couponNotifyRemoves],
      ['쿠폰 순 알림신청', a.couponNotifyAdds - a.couponNotifyRemoves],
      ['플랜 진입 클릭', a.planEntryClicks],
      ['플랜 상세 열람', a.planDetailViews],
      ['플랜 사전 신청', a.planPreregisters],
      ['플랜 상세 이탈', a.planDetailCloses],
      ['찜 추가', a.wishlistAdds],
      ['찜 해제', a.wishlistRemoves],
      ['찜 목록 열람', a.wishlistOpens],
      ['발굴 지도 열기', a.discoverGemMapOpens],
      ['방문인증 시작', a.visitCertOpens],
      ['방문인증 완료', a.visitCertDones],
      ['방문인증 전환율(%)', pct(a.visitCertDones, a.visitCertOpens)],
      ['방문인증 실패', a.visitCertFails],
      ['포인트샵 티저 클릭', a.pointsStoreTeaserClicks],
      ['참석·가요', a.rsvpGoing],
      ['참석·못가요', a.rsvpNotGoing],
      ['참석·미정', a.rsvpUndecided],
      ['참석 응답 합계', a.rsvpSubmitTotal],
      [],
      ['쿠폰 알림신청 Top 10'],
      ['순위', '쿠폰ID', '매장', '지역', '혜택유형', '등급', '순신청', '신청', '취소'],
      ...couponTop.map((cp, i) => [i + 1, cp.couponId, cp.shopName, cp.area, cp.benefitType, cp.tier, cp.net, cp.adds, cp.removes]),
      [],
      ['예약 목록'],
      ['장소명', '주소', '예약자', '인원', '요청시간'],
      ...records.map((r) => [r.placeName, r.address, r.guestName, r.people, formatDate(r.createdAt)]),
    ];
    downloadCsv(`mint-admin-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function handleTogglePause() {
    const next = !paused;
    setTrackingPaused(next);
    setPaused(next);
  }

  if (!password) return <PasswordGate onUnlock={handleUnlock} verifying={verifying} error={gateError} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-[#2AB5A0]">MINT 어드민</h1>
            <p className="text-sm text-gray-400">데이터 대시보드</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/pilot-admin"
              className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full hover:border-[#36CFA0] hover:text-[#36CFA0] transition-colors"
            >
              선발대 피드백 →
            </a>
            <button
              onClick={() => loadData(password)}
              className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full hover:border-[#36CFA0] hover:text-[#36CFA0] transition-colors"
            >
              새로고침
            </button>
            <button
              onClick={handleExport}
              className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full hover:border-[#36CFA0] hover:text-[#36CFA0] transition-colors"
            >
              CSV
            </button>
          </div>
        </div>

        {/* 기간 필터 */}
        <div className="flex items-center gap-1.5 mb-5">
          {RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleRange(key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                range === key ? 'bg-[#36CFA0] text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 오류 표시 */}
        {dbError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="text-sm font-bold text-red-600 mb-1">데이터 오류</div>
            <div className="text-xs text-red-500 break-all">{dbError}</div>
          </div>
        )}

        {/* 데이터 수집 일시정지 토글 */}
        <div className="mb-6">
          <button
            onClick={handleTogglePause}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
              paused ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{paused ? '⏸️' : '▶️'}</span>
              <div className="text-left">
                <div className={`font-black text-sm ${paused ? 'text-orange-600' : 'text-gray-700'}`}>
                  이 기기 수집 {paused ? '일시정지 중' : '수집 중'}
                </div>
                <div className="text-xs text-gray-400">
                  {paused ? '이 브라우저에서만 기록이 멈춰요 (다른 사용자는 계속 수집돼요)' : '클릭하면 이 기기에서만 수집이 멈춰요'}
                </div>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${paused ? 'bg-orange-400' : 'bg-[#3CDBC0]'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${paused ? 'left-1' : 'left-5'}`} />
            </div>
          </button>
        </div>

        {/* ── 퍼널 ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-gray-600">🔻 전환 퍼널</h2>
            <button
              onClick={handleClearAnalytics}
              className="text-xs text-red-400 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-50 transition-colors"
            >
              이벤트 초기화
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
            <FunnelStep label="랜딩 조회" value={a.landingViews} rate={null} />
            <FunnelStep label="CTA 클릭" value={a.ctaClicks} rate={pct(a.ctaClicks, a.landingViews)} />
            <FunnelStep label="앱 진입(세션)" value={a.sessions} rate={pct(a.sessions, a.ctaClicks)} />
            <FunnelStep label="예약 시도" value={a.reservationAttempts} rate={pct(a.reservationAttempts, a.sessions)} />
            <FunnelStep label="예약 완료" value={a.reservationCompleted} rate={pct(a.reservationCompleted, a.reservationAttempts)} last />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 px-1">
            * 예약 시도는 이벤트, 예약 완료는 reservations 테이블 실건수 — 소스가 달라 초기화 대상도 달라요.
          </p>
        </section>

        {/* ── 핵심 지표 카드 ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="전환율 (랜딩→CTA)" value={`${pct(a.ctaClicks, a.landingViews)}%`} highlight />
          <StatCard label="예약 완료율 (시도→완료)" value={`${pct(a.reservationCompleted, a.reservationAttempts)}%`} highlight />
          <StatCard label="평균 체류시간" value={a.avgStaySeconds != null ? formatDuration(a.avgStaySeconds) : '—'} sub={a.medianStaySeconds != null ? `중앙값 ${formatDuration(a.medianStaySeconds)}` : '아직 기록 없음'} />
          <StatCard label="카카오 공유" value={a.kakaoShares} unit="회" sub={a.kakaoShareFallbacks > 0 ? `폴백 ${a.kakaoShareFallbacks}회` : undefined} />
        </div>

        {/* ── 거절 사유 (알고리즘 핵심 신호) ── */}
        <section className="mb-6">
          <h2 className="text-sm font-black text-gray-600 mb-3">🚫 거절 사유 <span className="text-gray-300 font-normal">(추천 알고리즘 개선 신호)</span></h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {rejectTotal === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 거절 기록이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <BarRow label="비쌈" count={a.rejectExpensive} total={rejectTotal} color="#F59E0B" />
                <BarRow label="멀어요" count={a.rejectFar} total={rejectTotal} color="#EF4444" />
                <BarRow label="분위기" count={a.rejectVibe} total={rejectTotal} color="#8B5CF6" />
                <div className="text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-50">총 {rejectTotal}건 거절</div>
              </div>
            )}
          </div>
        </section>

        {/* ── 재시도 & 예약 채널 ── */}
        <div className="grid md:grid-cols-2 gap-3 mb-8">
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">🔄 재시도</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {retryTotal === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">기록 없음</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <BarRow label="새로" count={a.retryFresh} total={retryTotal} />
                  <BarRow label="조정" count={a.retryAdjust} total={retryTotal} color="#0EA5E9" />
                </div>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">🔗 예약 채널</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {deeplinkTotal === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">기록 없음</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <BarRow label="캐치" count={a.deeplinkCatchtable} total={deeplinkTotal} />
                  <BarRow label="네이버" count={a.deeplinkNaver} total={deeplinkTotal} color="#22C55E" />
                  <BarRow label="카카오맵" count={a.deeplinkKakaomap} total={deeplinkTotal} color="#EAB308" />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── 추천 품질 (노출·성공률·선택 신호) ── */}
        <section className="mb-6">
          <h2 className="text-sm font-black text-gray-600 mb-3">🎯 추천 품질 <span className="text-gray-300 font-normal">(랭킹 튜닝 신호)</span></h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="추천 노출" value={a.recommendShown} unit="회" sub={`요청 ${a.recommendRequests}회`} />
            <StatCard label="추천 성공률" value={`${pct(a.recommendShown, a.recommendRequests)}%`} sub={a.recommendErrors > 0 ? `에러 ${a.recommendErrors}회` : '에러 없음'} highlight />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-black text-gray-500 mb-2">선택 순위 분포 <span className="text-gray-300 font-normal">(어떤 순위를 눌렀나 = ground truth)</span></p>
            {placeClickTotal === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 장소 클릭 기록이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <BarRow label="1순위" count={a.placeClickRank1} total={placeClickTotal} />
                <BarRow label="2차" count={a.placeClickSecond} total={placeClickTotal} color="#1A7A6E" />
                <BarRow label="대안" count={a.placeClickCandidate} total={placeClickTotal} color="#0EA5E9" />
                <BarRow label="3차" count={a.placeClickThird} total={placeClickTotal} color="#8B5CF6" />
                <div className="text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-50">
                  후보 펼침 {a.candidatesExpand}회 · 인증 뱃지 열람 {a.certBadgeOpen}회
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 입력 단계 이탈 & 검색 실패 ── */}
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">📝 입력 단계 진행</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
              <FunnelStep label="1단계 통과" value={a.stepNext0} rate={null} />
              <FunnelStep label="2단계 통과" value={a.stepNext1} rate={pct(a.stepNext1, a.stepNext0)} />
              <FunnelStep label="3단계 통과" value={a.stepNext2} rate={pct(a.stepNext2, a.stepNext1)} last />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">🔎 검색·설치·그룹</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <MiniStat label="검색 0건" value={a.locationSearchZero} />
              <MiniStat label="검색 에러" value={a.locationSearchError} />
              <MiniStat label="PWA 설치" value={a.pwaInstallAccepted} />
              <MiniStat label="PWA 취소" value={a.pwaInstallDismissed} />
              <MiniStat label="그룹 링크 생성" value={a.groupSessionCreate} />
              <MiniStat label="데모 장소 클릭" value={a.demoPlaceClicks} />
            </div>
          </section>
        </div>

        {/* ── 탭 사용 ── */}
        <section className="mb-6">
          <h2 className="text-sm font-black text-gray-600 mb-3">📱 탭 사용 <span className="text-gray-300 font-normal">(어떤 탭이 실제로 쓰이나)</span></h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {tabTotal === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 탭 이동 기록이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <BarRow label={TAB_LABELS.home} count={tabCounts.home ?? 0} total={tabTotal} />
                <BarRow label={TAB_LABELS.meetings} count={tabCounts.meetings ?? 0} total={tabTotal} color="#0EA5E9" />
                <BarRow label={TAB_LABELS.discover} count={tabCounts.discover ?? 0} total={tabTotal} color="#8B5CF6" />
                <BarRow label={TAB_LABELS.shop} count={tabCounts.shop ?? 0} total={tabTotal} color="#F59E0B" />
                <BarRow label={TAB_LABELS.profile} count={tabCounts.profile ?? 0} total={tabTotal} color="#94A3B8" />
                <div className="text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-50">
                  총 {a.tabClicksTotal || tabTotal}회 이동 · 빈 모임 CTA 클릭 {a.meetingsEmptyCtaClicks}회
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 민트샵 반응 ── */}
        <section className="mb-6">
          <h2 className="text-sm font-black text-gray-600 mb-3">🛍️ 민트샵 반응 <span className="text-gray-300 font-normal">(쿠폰 수요 = 가짜 문)</span></h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="쿠폰 탭" value={a.shopCouponClicks} unit="회" sub={`페이지 이동 ${a.shopPageChanges}회`} />
            <StatCard label="순 알림신청" value={a.couponNotifyAdds - a.couponNotifyRemoves} unit="건" sub={`신청 ${a.couponNotifyAdds} · 취소 ${a.couponNotifyRemoves}`} highlight />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
            <p className="text-xs font-black text-gray-500 mb-2">필터 사용 <span className="text-gray-300 font-normal">(어떤 혜택을 찾나)</span></p>
            {shopFilterTotal === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 필터 기록이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {shopFilterEntries.map(([key, count]) => (
                  <BarRow key={key} label={SHOP_FILTER_LABELS[key] ?? key} count={count} total={shopFilterTotal} color="#F59E0B" />
                ))}
                <div className="text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-50">총 {a.shopFilterClicksTotal || shopFilterTotal}회 필터</div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-black text-gray-500 mb-2">쿠폰 알림신청 Top 10 <span className="text-gray-300 font-normal">(신청 − 취소)</span></p>
            {couponTop.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 알림신청이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {couponTop.map((cp, i) => (
                  <div key={cp.couponId} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="w-5 text-gray-300 font-black shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-700 truncate">{cp.shopName || cp.couponId}</span>
                      <span className="block text-[11px] text-gray-400 truncate">
                        {[cp.area, cp.benefitType, cp.tier].filter(Boolean).join(' · ') || cp.couponId}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-black text-[#36CFA0]">{cp.net}건</span>
                      {cp.removes > 0 && <span className="block text-[11px] text-gray-300">취소 {cp.removes}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── 총무 플랜 퍼널 ── */}
        <section className="mb-6">
          <h2 className="text-sm font-black text-gray-600 mb-3">🙋 총무 플랜 퍼널 <span className="text-gray-300 font-normal">(가격 검증)</span></h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
            <FunnelStep label="진입 클릭" value={a.planEntryClicks} rate={null} />
            <FunnelStep label="상세 열람" value={a.planDetailViews} rate={pct(a.planDetailViews, a.planEntryClicks)} />
            <FunnelStep label="사전 신청" value={a.planPreregisters} rate={pct(a.planPreregisters, a.planDetailViews)} last />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 px-1">
            * 상세만 보고 닫음(이탈) {a.planDetailCloses}건 — 열람 대비 {pct(a.planDetailCloses, a.planDetailViews)}%
          </p>
        </section>

        {/* ── 발굴·찜·방문인증 ── */}
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">🧭 발굴·찜</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <MiniStat label="찜 추가" value={a.wishlistAdds} />
              <MiniStat label="찜 해제" value={a.wishlistRemoves} />
              <MiniStat label="찜 목록 열람" value={a.wishlistOpens} />
              <MiniStat label="지도 열기" value={a.discoverGemMapOpens} />
              <MiniStat label="포인트샵 티저" value={a.pointsStoreTeaserClicks} />
              <MiniStat label="순 찜" value={a.wishlistAdds - a.wishlistRemoves} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-black text-gray-600 mb-3">📍 방문 인증</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
              <FunnelStep label="인증 시작" value={a.visitCertOpens} rate={null} />
              <FunnelStep label="인증 완료" value={a.visitCertDones} rate={pct(a.visitCertDones, a.visitCertOpens)} last />
              <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-50">
                전환율 {pct(a.visitCertDones, a.visitCertOpens)}% · 실패 {a.visitCertFails}건
              </div>
            </div>
          </section>
        </div>

        {/* ── 참석 확정 ── */}
        <section className="mb-8">
          <h2 className="text-sm font-black text-gray-600 mb-3">🗳️ 참석 확정 <span className="text-gray-300 font-normal">(가요/못가요)</span></h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {rsvpTotal === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">아직 참석 응답이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <BarRow label="가요" count={a.rsvpGoing} total={rsvpTotal} color="#22C55E" />
                <BarRow label="못가요" count={a.rsvpNotGoing} total={rsvpTotal} color="#EF4444" />
                <BarRow label="미정" count={a.rsvpUndecided} total={rsvpTotal} color="#94A3B8" />
                <div className="text-[11px] text-gray-400 mt-1 pt-2 border-t border-gray-50">총 {a.rsvpSubmitTotal || rsvpTotal}건 응답</div>
              </div>
            )}
          </div>
        </section>

        {/* ── 예약 목록 ── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-gray-600">📋 예약 요청 <span className="text-[#2AB5A0]">{records.length}건</span></h2>
          {records.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-red-400 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-50 transition-colors"
            >
              전체 삭제
            </button>
          )}
        </div>
        {records.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400">이 기간에 예약 요청이 없어요.</p>
            <a href="/app" className="inline-block mt-4 text-sm text-[#3CDBC0] underline">
              MINT로 장소 추천받기 →
            </a>
          </div>
        ) : (
          <>
            {/* 모바일: 카드형 */}
            <div className="flex flex-col gap-3 md:hidden">
              {records.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-black text-gray-800">{r.placeName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.address}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">예약자</span>
                      <span className="font-bold text-gray-700">{r.guestName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">인원</span>
                      <span className="font-bold text-gray-700">{r.people}명</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">요청: {formatDate(r.createdAt)}</div>
                </div>
              ))}
            </div>

            {/* 데스크탑: 테이블형 */}
            <div className="hidden md:block bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E8F8F5] text-left">
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">장소명</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">주소</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">예약자</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">인원</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">요청시간</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 font-bold text-gray-800">{r.placeName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{r.address}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{r.guestName}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#E8F8F5] text-[#2AB5A0] font-bold px-2 py-0.5 rounded-full text-xs">
                          {r.people}명
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-black text-gray-700">{value}</span>
    </div>
  );
}

function FunnelStep({ label, value, rate, last }: {
  label: string; value: number; rate: string | null; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${last ? '' : 'border-b border-gray-50'}`}>
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-lg font-black text-[#36CFA0]">{value}</span>
        {rate != null && (
          <span className="text-xs text-gray-400 w-16 text-right">직전 {rate}%</span>
        )}
      </div>
    </div>
  );
}
