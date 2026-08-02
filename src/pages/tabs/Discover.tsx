import { useState } from 'react';
import { getWishlist, removeWish, wishMapLink, isWished, type WishItem } from '../../utils/wishlist';
import { placeKey, getDeviceId } from '../../utils/points';
import { trackEvent } from '../../utils/analytics';
import { MOCK_GEMS } from '../../data/mock/gems';
import WishlistButton from '../../components/WishlistButton';

// 발굴 탭 — 내가 찜한 곳 + 오늘의 원석. 찜은 결과 화면과 같은 localStorage를 공유한다.
export default function Discover() {
  const [items, setItems] = useState<WishItem[]>(() => getWishlist());

  function refresh() {
    setItems(getWishlist());
  }

  function remove(key: string) {
    setItems(removeWish(key));
    trackEvent('wishlist_remove', { device_id: getDeviceId(), place_key: key });
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-black text-gray-900">💎 발굴</h1>
      <p className="mt-1 text-sm text-gray-400">마음에 든 곳을 저장하고, 아직 안 알려진 곳을 먼저 찾아보세요.</p>

      {/* 섹션 1 — 내가 찜한 곳 */}
      <section className="mt-5">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">내가 찜한 곳</p>
          {items.length > 0 && <span className="text-[11px] font-bold text-[#2AB5A0]">{items.length}곳</span>}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center">
            <p className="mb-2 text-3xl">🫧</p>
            <p className="text-sm leading-relaxed text-gray-500">
              아직 찜한 곳이 없어요.<br />
              아래 원석의 하트를 눌러 저장해보세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((w) => (
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
        )}
      </section>

      {/* 섹션 2 — 오늘의 원석 */}
      <section className="mt-7">
        <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">오늘의 원석</p>
        <div className="flex flex-col gap-3">
          {MOCK_GEMS.map((gem) => {
            const wished = isWished(placeKey(gem));
            return (
              <div key={gem.placeName} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-black text-gray-800">{gem.placeName}</p>
                      <span className="shrink-0 rounded-full bg-[#E8F8F5] px-2 py-0.5 text-[10px] font-black text-[#2AB5A0]">{gem.category}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{gem.area} · {gem.address}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 break-keep">{gem.description}</p>
                  </div>
                  {/* key에 wished를 넣어 위 찜 목록에서 해제했을 때 하트도 같이 되돌아가게 한다 */}
                  <WishlistButton key={`${gem.placeName}-${wished}`} place={gem} rank="candidate" source="discover" onChange={refresh} />
                </div>

                {/* 내 기기 기준 개인화 카피 — 다른 사람 순위를 말하지 않는다 */}
                <p className={`mt-3 text-[11px] font-bold ${wished ? 'text-[#2AB5A0]' : 'text-gray-400'}`}>
                  {wished ? '✓ 내 발굴 목록에 담았어요' : '아직 담지 않은 곳이에요 — 하트로 먼저 찜해두세요'}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-gray-400">원석 추천은 매주 업데이트될 예정이에요</p>
      </section>
    </div>
  );
}
