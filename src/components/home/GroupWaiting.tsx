import type { GroupMember } from '../../utils/groupAggregate';

interface Props {
  shareLink: string;
  copied: boolean;
  onCopy: () => void;
  onRecommend: () => void;
  members: GroupMember[];
  expectedCount: number;
  canRecommend: boolean;
  recommending: boolean;
}

// 그룹 모드: 링크 공유 + 실시간 입력 현황
export default function GroupWaiting({
  shareLink,
  copied,
  onCopy,
  onRecommend,
  members,
  expectedCount,
  canRecommend,
  recommending,
}: Props) {
  const allVoted = members.length >= expectedCount && members.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* 공유 링크 */}
      <div className="bg-white shadow-sm rounded-2xl p-4">
        <p className="text-xs text-gray-400 mb-2">공유 링크</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-gray-700 truncate">{shareLink}</p>
          <button
            onClick={onCopy}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#3CDBC0] text-white text-sm font-bold transition-all active:scale-95 hover:bg-[#2AB5A0]"
          >
            {copied ? '복사됨!' : '복사'}
          </button>
        </div>
      </div>

      {/* 진행률 + 슬롯 (호스트는 항상 첫 슬롯으로 자동 포함 — 별도 참여 불필요) */}
      <div className="bg-white shadow-sm rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">입력 현황</p>
          <p className="text-lg font-black text-[#2AB5A0]">
            {members.length}
            <span className="text-gray-300 font-bold"> / {expectedCount}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: expectedCount }).map((_, i) => {
            const member = members[i];
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  member ? 'bg-[#E8F8F5]' : 'bg-gray-50 border border-dashed border-gray-200'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  member ? 'bg-[#3CDBC0] text-white' : 'bg-gray-200 text-gray-400'
                }`}>
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

      {/* 추천 버튼 — 전원 완료를 기다리지 않고, 추천 가능(호스트+친구 1명 이상=2명 이상)해지면 바로 노출.
          전원 완료면 축하 문구, 일부만 모였으면 "지금 받아도/더 기다려도 OK" 문구로 안내. */}
      {canRecommend && (
        <div className="p-4 bg-[#E8F8F5] border border-[#3CDBC0]/40 rounded-2xl text-center">
          {allVoted ? (
            <>
              <p className="text-base font-black text-[#2AB5A0]">🎉 전원 완료!</p>
              <p className="text-xs text-[#2AB5A0]/70 mt-0.5">모두의 취향이 모였어요. 바로 추천받을 수 있어요.</p>
            </>
          ) : (
            <>
              <p className="text-base font-black text-[#2AB5A0]">지금 바로 추천받을 수 있어요</p>
              <p className="text-xs text-[#2AB5A0]/70 mt-0.5">더 기다렸다 다 모이면 받아도 좋고, 지금 받아도 좋아요.</p>
            </>
          )}
          <button
            onClick={onRecommend}
            disabled={!canRecommend || recommending}
            className={`mt-3 w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
              canRecommend && !recommending
                ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/25 hover:bg-[#2AB5A0]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {recommending ? '추천 준비 중...' : `${members.length}명으로 추천받기 →`}
          </button>
        </div>
      )}
    </div>
  );
}
