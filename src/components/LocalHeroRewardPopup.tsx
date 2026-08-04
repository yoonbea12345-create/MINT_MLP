// 현지인 리워드 보상 팝업 — 민트샵에 들어오면 뜨는 촬영용 목업.
// 포인트 잔액은 일부러 건드리지 않는다. localStorage에 흔적이 남으면 git revert만으로 되돌릴 수 없다.
//
// ⚠️ MOCK — 실데이터가 아니다. 촬영 끝나면 아래 플래그를 false로 하거나 이 커밋을 revert하면 된다.
export const LOCAL_HERO_REWARD_MOCK_ENABLED = true;

const HERO_NICKNAME = '김민트';
const HERO_REGION = '부천시';
const HERO_REWARD_POINTS = 1000;

export default function LocalHeroRewardPopup({ onClose }: { onClose: () => void }) {
  if (!LOCAL_HERO_REWARD_MOCK_ENABLED) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-6 pt-7 pb-6 text-center shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">🎉</div>

        <p className="mt-3 text-[19px] font-black leading-snug text-gray-900 break-keep">
          어서오세요! {HERO_NICKNAME}님
        </p>

        <p className="mt-2.5 text-sm leading-relaxed text-gray-600 break-keep">
          회원님이 등록하신 <span className="font-black text-gray-800">{HERO_REGION} 현지인 맛집</span>이
          다른 유저분들의 선택을 급속도로 받았습니다!!
        </p>

        {/* 보상 금액은 팝업의 주인공이라 카드로 따로 세운다 */}
        <div className="mt-4 rounded-2xl border border-[#3CDBC0]/35 bg-[#E8F8F5] px-4 py-4">
          <p className="text-xs font-bold text-[#2AB5A0]">보상으로 선물을 드릴게요</p>
          <p className="mt-1 text-[30px] font-black leading-none text-[#2AB5A0]">
            {HERO_REWARD_POINTS.toLocaleString()}P
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#3CDBC0] py-3.5 font-black text-white shadow-lg shadow-[#3CDBC0]/25 transition-transform active:scale-[0.98]"
        >
          포인트 받기
        </button>
      </div>
    </div>
  );
}
