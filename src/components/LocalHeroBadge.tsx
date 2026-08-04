import { LOCAL_HERO_MOCK_ENABLED, deriveLocalHero, localHeroLabel } from '../data/localHero';

// 현지인 리워드 배지 — 1차 히어로 카드에만, 장소명 바로 위 한 줄.
// 시트는 여기서 띄우지 않는다: 카드 루트가 overflow-hidden이라 카드 밖 형제로 띄워야 한다(CertSheet와 같은 이유).
// ⚠️ MOCK — src/data/localHero.ts 참고. 끄려면 LOCAL_HERO_MOCK_ENABLED = false.
export default function LocalHeroBadge({
  place,
  onOpen,
}: {
  place: { placeName?: string; address?: string; area?: string; category?: string };
  onOpen: () => void;
}) {
  if (!LOCAL_HERO_MOCK_ENABLED) return null;

  // 부모가 flex가 아닌 블록이라 self-start가 안 먹는다 — inline-flex로 폭을 내용만큼만 잡는다.
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label="현지인 추천 안내 열기"
      className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-xl bg-white/95 py-1.5 pl-2 pr-2.5 shadow-sm transition-transform active:scale-95"
    >
      <span className="shrink-0 text-sm">🙋</span>
      <span className="text-left text-[11px] font-black leading-snug text-[#2AB5A0] break-keep line-clamp-2">
        {localHeroLabel(place)}
      </span>
    </button>
  );
}

// 안내 시트 — ResultCard의 CertSheet과 같은 골격. 카드 밖 형제로 렌더해야 잘리지 않는다.
export function LocalHeroSheet({
  place,
  onClose,
}: {
  place: { placeName?: string; address?: string };
  onClose: () => void;
}) {
  const { name, visitCount, activeYears } = deriveLocalHero(place);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white px-6 pt-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+0.75rem))] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-4xl">🙋</p>
        <h3 className="mt-2 text-center text-lg font-black text-gray-900 break-keep">
          현지인이 추천하는 진짜 로컬 맛집
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600 break-keep">
          {name}님은 이 동네에서 {activeYears}년째 활동 중인 현지인이에요.
          직접 {visitCount}번 넘게 다닌 단골이 골라준 곳이라, 검색만으로는 나오지 않는
          진짜 로컬 스팟이에요. 추천이 채택되면 현지인에게도 리워드가 돌아가요.
        </p>
        <p className="mt-3 text-center text-[11px] text-gray-400">민트 현지인 리워드 시스템</p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#3CDBC0] py-3.5 font-black text-white transition-transform active:scale-[0.98]"
        >
          기대할게요!
        </button>
      </div>
    </div>
  );
}
