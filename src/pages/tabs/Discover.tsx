import { useState } from 'react';
import { getWishlist, removeWish, wishMapLink, buildMapLink, isWished, type WishItem } from '../../utils/wishlist';
import { placeKey, getDeviceId } from '../../utils/points';
import { trackEvent } from '../../utils/analytics';
import { MOCK_GEMS } from '../../data/mock/gems';
import WishlistButton from '../../components/WishlistButton';
import { IconCompass, IconMapPin, IconCheck, IconChevronDown } from '../../components/icons';

const WISH_PREVIEW = 5;
const GEM_PREVIEW = 4;

// 발굴 탭 — 내가 찜한 곳 + 오늘의 원석. 찜은 결과 화면과 같은 localStorage를 공유한다.
export default function Discover() {
  const [items, setItems] = useState<WishItem[]>(() => getWishlist());
  const [showAllWishes, setShowAllWishes] = useState(false);
  const [showAllGems, setShowAllGems] = useState(false);

  function refresh() {
    setItems(getWishlist());
  }

  function remove(key: string) {
    setItems(removeWish(key));
    trackEvent('wishlist_remove', { device_id: getDeviceId(), place_key: key });
  }

  const shownWishes = showAllWishes ? items : items.slice(0, WISH_PREVIEW);
  const shownGems = showAllGems ? MOCK_GEMS : MOCK_GEMS.slice(0, GEM_PREVIEW);
  const restGems = MOCK_GEMS.length - GEM_PREVIEW;

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="flex items-center gap-2 text-[22px] font-black text-gray-900">
        <IconCompass className="h-[22px] w-[22px] text-[#2AB5A0]" />
        발굴
      </h1>
      <p className="mt-1 text-sm text-gray-400">마음에 든 곳을 저장하고, 아직 안 알려진 곳을 먼저 찾아보세요.</p>

      {/* 섹션 1 — 내가 찜한 곳 */}
      <section className="mt-6">
        <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
          내가 찜한 곳{items.length > 0 ? ` · ${items.length}곳` : ''}
        </p>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center">
            <IconMapPin className="mx-auto h-8 w-8 text-gray-200" />
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              아직 찜한 곳이 없어요.<br />
              아래 원석의 하트를 눌러 저장해보세요.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {shownWishes.map((w) => (
                <div key={w.place_key} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3.5 py-3">
                  <a
                    href={wishMapLink(w)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 transition-transform active:scale-[0.99]"
                  >
                    <p className="truncate text-sm font-black text-gray-800">{w.place_name}</p>
                    <p className="truncate text-xs text-gray-400">
                      {w.category ? `${w.category} · ` : ''}{w.address}
                    </p>
                  </a>
                  <button
                    onClick={() => remove(w.place_key)}
                    aria-label="찜 해제"
                    className="h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white text-xs text-gray-400 transition-transform active:scale-90"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {items.length > WISH_PREVIEW && (
              <button
                onClick={() => setShowAllWishes((v) => !v)}
                aria-expanded={showAllWishes}
                className="mt-2 w-full py-2 text-center text-xs font-bold text-gray-400 active:scale-[0.99] transition-transform"
              >
                {showAllWishes ? '접기' : `찜한 곳 ${items.length}건 모두 보기 ›`}
              </button>
            )}
          </>
        )}
      </section>

      {/* 섹션 2 — 오늘의 원석 */}
      <section className="mt-7">
        <p className="px-1 mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">오늘의 원석</p>
        {/* 내 기기 기준 개인화 카피 — 다른 사람 순위를 말하지 않는다 */}
        <p className="px-1 mb-2.5 text-xs leading-relaxed text-gray-400 break-keep">
          먼저 찜해두면 나중에 이 동네를 처음 찾은 사람으로 기록될 수 있어요
        </p>

        <div className="flex flex-col gap-3">
          {shownGems.map((gem) => {
            const key = placeKey(gem);
            const wished = isWished(key);
            return (
              <div key={gem.placeName} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <a
                    href={buildMapLink(gem.placeName, gem.lat, gem.lng)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent('discover_gem_map_open', { device_id: getDeviceId(), place_key: key })}
                    className="min-w-0 flex-1 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-black text-gray-800">{gem.placeName}</p>
                      <span className="shrink-0 rounded-full bg-[#E8F8F5] px-2 py-0.5 text-[10px] font-black text-[#2AB5A0]">{gem.category}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{gem.area} · {gem.address}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 break-keep">{gem.description}</p>
                  </a>
                  {/* key에 wished를 넣어 위 찜 목록에서 해제했을 때 하트도 같이 되돌아가게 한다 */}
                  <WishlistButton key={`${gem.placeName}-${wished}`} place={gem} rank="candidate" source="discover" onChange={refresh} />
                </div>

                {wished && (
                  <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#2AB5A0]">
                    <IconCheck className="h-3 w-3" strokeWidth={2.6} />
                    담았어요
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {restGems > 0 && (
          <button
            onClick={() => setShowAllGems((v) => !v)}
            aria-expanded={showAllGems}
            className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-gray-400 active:scale-[0.99] transition-transform"
          >
            {showAllGems ? '원석 접기' : `원석 ${restGems}곳 더 보기`}
            <IconChevronDown className={`h-4 w-4 transition-transform ${showAllGems ? 'rotate-180' : ''}`} />
          </button>
        )}

        <p className="mt-4 text-center text-[11px] text-gray-400">원석 추천은 매주 업데이트될 예정이에요</p>
      </section>
    </div>
  );
}
