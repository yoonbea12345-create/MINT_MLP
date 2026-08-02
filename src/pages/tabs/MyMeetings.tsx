import { useState } from 'react';
import { MOCK_MEETINGS, type MockMeeting } from '../../data/mock/meetings';
import { getPlanFrame, isPreregistered, planPriceLabel } from '../../utils/plan';
import { getDeviceId } from '../../utils/points';
import { trackEvent } from '../../utils/analytics';
import TreasurerPlanSheet from '../../components/TreasurerPlanSheet';

const STATUS_BADGE: Record<MockMeeting['status'], { label: string; className: string }> = {
  collecting: { label: '취합 중', className: 'bg-[#E8F8F5] text-[#2AB5A0]' },
  confirmed: { label: '장소 확정', className: 'bg-amber-50 text-amber-600' },
  past: { label: '지난 모임', className: 'bg-gray-100 text-gray-400' },
};

// 내 모임 탭 — 모임 카드는 아직 목업(서버 기능 없음), 총무 플랜 배너만 실제 계측된다.
export default function MyMeetings() {
  const [planFrame] = useState(() => getPlanFrame());
  const [prereg, setPrereg] = useState(() => isPreregistered());
  const [showPlanSheet, setShowPlanSheet] = useState(false);

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-black text-gray-900">📅 내 모임</h1>
      <p className="mt-1 text-sm text-gray-400">약속 잡은 모임들을 한눈에 볼 수 있어요.</p>

      {/* 총무 플랜 가짜 문 */}
      <button
        onClick={() => { trackEvent('plan_entry_click', { device_id: getDeviceId(), frame: planFrame, source: 'meetings_tab' }); setShowPlanSheet(true); }}
        className="mt-4 w-full text-left rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-all"
      >
        <span className="text-2xl shrink-0">🙋</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-amber-800 leading-snug break-keep">매번 장소 정하는 거, 이제 독박 그만</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {prereg ? '사전등록 완료 · 출시되면 알려드릴게요' : `총무 플랜 ${planPriceLabel(planFrame)} · 자세히 알아보기 →`}
          </p>
        </div>
      </button>

      {/* 모임 카드 리스트 */}
      <div className="mt-5 flex flex-col gap-3">
        {MOCK_MEETINGS.map((m) => {
          const badge = STATUS_BADGE[m.status];
          const ratio = m.totalCount > 0 ? Math.round((m.respondedCount / m.totalCount) * 100) : 0;
          return (
            <div
              key={m.id}
              className={`rounded-2xl border border-gray-100 bg-white p-4 ${m.status === 'past' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-800 truncate">{m.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{m.dateLabel}{m.areaName ? ` · ${m.areaName}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {m.isHost && <span className="rounded-full bg-[#E8F8F5] px-2 py-1 text-[10px] font-black text-[#2AB5A0]">총무</span>}
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badge.className}`}>{badge.label}</span>
                </div>
              </div>

              {/* 응답 현황 */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
                  <span>응답 현황</span>
                  <span>{m.respondedCount}/{m.totalCount}명</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#3CDBC0] transition-all" style={{ width: `${ratio}%` }} />
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                {m.placeName
                  ? <>📍 <span className="font-bold text-gray-700">{m.placeName}</span></>
                  : '📍 아직 장소를 정하는 중이에요'}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-center text-[11px] text-gray-400">모임 관리 기능은 출시 준비 중이에요</p>

      {showPlanSheet && (
        <TreasurerPlanSheet
          frame={planFrame}
          onClose={() => { setShowPlanSheet(false); setPrereg(isPreregistered()); }}
        />
      )}
    </div>
  );
}
