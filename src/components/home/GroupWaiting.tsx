import type { GroupMember } from '../../utils/groupAggregate';

interface Props {
  shareLink: string;
  copied: boolean;
  onCopy: () => void;
  members: GroupMember[];
  expectedCount: number;
}

// 그룹 모드: 링크 공유 + 실시간 입력 현황
export default function GroupWaiting({ shareLink, copied, onCopy, members, expectedCount }: Props) {
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

      {/* 나도 참여하기 */}
      <button
        onClick={() => { window.location.href = shareLink; }}
        className="w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 bg-[#E8F8F5] text-[#2AB5A0] border-2 border-[#3CDBC0]/40 hover:bg-[#d4f3ee]"
      >
        나도 참여하기 →
      </button>

      {/* 진행률 + 슬롯 */}
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

      {allVoted && (
        <div className="p-4 bg-[#E8F8F5] border border-[#3CDBC0]/40 rounded-2xl text-center">
          <p className="text-base font-black text-[#2AB5A0]">🎉 전원 완료!</p>
          <p className="text-xs text-[#2AB5A0]/70 mt-0.5">모두의 취향이 모였어요. 아래 다음 버튼을 눌러주세요!</p>
        </div>
      )}
    </div>
  );
}
