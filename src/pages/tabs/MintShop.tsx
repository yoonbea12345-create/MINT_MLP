import { useState } from 'react';
import { getBalance, getDeviceId } from '../../utils/points';
import { trackEvent } from '../../utils/analytics';
import { MOCK_COUPONS, type MockCoupon } from '../../data/mock/coupons';
import PointsBadge from '../../components/PointsBadge';

const STOCK_LABEL: Record<MockCoupon['stock'], { text: string; className: string }> = {
  available: { text: '교환 가능', className: 'bg-[#E8F8F5] text-[#2AB5A0]' },
  comingSoon: { text: '준비 중', className: 'bg-amber-50 text-amber-600' },
  soldout: { text: '품절', className: 'bg-gray-100 text-gray-400' },
};

// 민트샵 — 아직 교환은 열리지 않았다(가짜 문). 클릭해도 포인트는 차감되지 않는다.
export default function MintShop() {
  const [balance] = useState(() => getBalance());
  const [toast, setToast] = useState<string | null>(null);

  function tapCoupon(c: MockCoupon) {
    trackEvent('shop_coupon_click', { device_id: getDeviceId(), coupon_id: c.id, brand: c.brand, point_cost: c.pointCost, balance });
    setToast(`${c.brand} ${c.title} · 교환은 출시 준비 중이에요`);
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-black text-gray-900">🎁 민트샵</h1>
        <PointsBadge balance={balance} />
      </div>

      {/* 포인트 잔액 히어로 */}
      <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#3CDBC0] to-[#2AB5A0] px-6 py-7 text-white shadow-lg shadow-[#3CDBC0]/25">
        <p className="text-xs font-bold tracking-widest opacity-90">내 포인트</p>
        <p className="mt-1 text-4xl font-black">{balance.toLocaleString()}P</p>
        <p className="mt-2 text-xs opacity-90 break-keep">추천받은 곳에 방문하고 인증하면 한 번에 500P씩 쌓여요.</p>
      </div>

      {/* 쿠폰 그리드 */}
      <p className="mt-6 px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">포인트로 바꾸기</p>
      <div className="grid grid-cols-2 gap-3">
        {MOCK_COUPONS.map((c) => {
          const stock = STOCK_LABEL[c.stock];
          return (
            <button
              key={c.id}
              onClick={() => tapCoupon(c)}
              className={`rounded-2xl border border-gray-100 bg-white p-4 text-left transition-transform active:scale-[0.98] ${c.stock === 'soldout' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl leading-none">{c.imageEmoji}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${stock.className}`}>{stock.text}</span>
              </div>
              <p className="mt-3 text-[11px] font-bold text-gray-400">{c.brand}</p>
              <p className="text-sm font-black leading-snug text-gray-800 break-keep">{c.title}</p>
              <p className="mt-2 text-sm font-black text-[#2AB5A0]">{c.pointCost.toLocaleString()}P</p>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-[11px] text-gray-400">아직 교환되지 않아요 · 포인트도 차감되지 않아요</p>

      {toast && (
        <div className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3CDBC0]/35 bg-white/95 px-4 py-2.5 text-xs font-bold text-[#2AB5A0] shadow-xl shadow-[#2AB5A0]/20 backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}
