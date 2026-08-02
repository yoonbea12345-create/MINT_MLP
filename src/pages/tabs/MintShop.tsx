import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { getBalance, getDeviceId } from '../../utils/points';
import { trackEvent } from '../../utils/analytics';
import { MOCK_COUPONS, type CouponBenefitType, type MintCoupon } from '../../data/mock/coupons';
import { getNotifyList, toggleNotify } from '../../utils/couponNotify';
import PointsBadge from '../../components/PointsBadge';
import {
  IconGift, IconUtensils, IconCup, IconTag, IconClock, IconUsers, IconSparkle,
  IconCheck, IconBell, type IconProps,
} from '../../components/icons';

const PAGE_SIZE = 10;

const BENEFIT_ICON: Record<CouponBenefitType, (p: IconProps) => ReactElement> = {
  side: IconUtensils,
  drink: IconCup,
  discount_amount: IconTag,
  discount_percent: IconTag,
  time: IconClock,
  group: IconUsers,
  first_visit: IconSparkle,
};

const FILTERS: { key: string; label: string; types: CouponBenefitType[] | null }[] = [
  { key: 'all', label: '전체', types: null },
  { key: 'side', label: '사이드메뉴', types: ['side'] },
  { key: 'drink', label: '음료', types: ['drink'] },
  { key: 'discount', label: '할인', types: ['discount_amount', 'discount_percent'] },
  { key: 'time', label: '시간대 혜택', types: ['time'] },
  { key: 'group', label: '모임 혜택', types: ['group'] },
  { key: 'first_visit', label: '첫 방문', types: ['first_visit'] },
];

// 민트샵 — 아직 교환은 열리지 않았다(가짜 문). 탭은 '알림 신청'일 뿐 포인트는 절대 차감되지 않는다.
export default function MintShop() {
  const [balance] = useState(() => getBalance());
  const [notified, setNotified] = useState<string[]>(() => getNotifyList());
  const [filterKey, setFilterKey] = useState('all');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const types = FILTERS.find((f) => f.key === filterKey)?.types;
    return types ? MOCK_COUPONS.filter((c) => types.includes(c.benefitType)) : MOCK_COUPONS;
  }, [filterKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function selectFilter(key: string) {
    setFilterKey(key);
    setPage(1);
    trackEvent('shop_filter_click', { device_id: getDeviceId(), category: key });
  }

  function goPage(next: number) {
    if (next < 1 || next > pageCount || next === current) return;
    setPage(next);
    trackEvent('shop_page_change', { device_id: getDeviceId(), page: next });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function tapCoupon(c: MintCoupon) {
    trackEvent('shop_coupon_click', { device_id: getDeviceId(), coupon_id: c.id, shop_name: c.shopName, point_cost: c.pointCost, balance });
    const { list, applied } = toggleNotify(c.id);
    setNotified(list);
    if (applied) {
      trackEvent('coupon_notify_add', {
        device_id: getDeviceId(), coupon_id: c.id, shop_name: c.shopName, area: c.area,
        category: c.category, benefit_type: c.benefitType, point_cost: c.pointCost, tier: c.tier, balance,
      });
      setToast(`${c.shopName} 쿠폰, 출시하면 가장 먼저 알려드릴게요`);
    } else {
      trackEvent('coupon_notify_remove', { device_id: getDeviceId(), coupon_id: c.id });
      setToast('신청을 취소했어요');
    }
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-[22px] font-black text-gray-900">
          <IconGift className="h-[22px] w-[22px] text-[#2AB5A0]" />
          민트샵
        </h1>
        <PointsBadge balance={balance} />
      </div>

      {/* 포인트 잔액 히어로 */}
      <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#3CDBC0] to-[#2AB5A0] px-6 py-7 text-white shadow-lg shadow-[#3CDBC0]/25">
        <p className="text-xs font-bold tracking-widest opacity-90">내 포인트</p>
        <p className="mt-1 text-4xl font-black">{balance.toLocaleString()}P</p>
        <p className="mt-2 text-xs opacity-90 break-keep">추천받은 곳에 방문하고 인증하면 한 번에 500P씩 쌓여요.</p>
      </div>

      {/* 혜택 유형 필터 */}
      <p className="mt-6 px-1 text-sm font-black text-gray-800">어떤 혜택을 찾으세요?</p>
      <div className="-mx-5 mt-2.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {FILTERS.map((f) => {
            const on = f.key === filterKey;
            return (
              <button
                key={f.key}
                onClick={() => selectFilter(f.key)}
                aria-pressed={on}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors active:scale-95 ${
                  on ? 'bg-[#3CDBC0] text-white' : 'border border-gray-100 bg-white text-gray-500'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 쿠폰 그리드 */}
      <p className="mt-6 px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        동네 골목 쿠폰 · {filtered.length}종
      </p>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((c) => (
          <CouponCard
            key={c.id}
            coupon={c}
            applied={notified.includes(c.id)}
            balance={balance}
            onTap={() => tapCoupon(c)}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <PageArrow label="이전 페이지" disabled={current === 1} onClick={() => goPage(current - 1)}>‹</PageArrow>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => goPage(n)}
              aria-current={n === current ? 'page' : undefined}
              className={`h-8 w-8 rounded-full text-xs font-black transition-colors ${
                n === current ? 'bg-[#3CDBC0] text-white' : 'text-gray-400 active:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ))}
          <PageArrow label="다음 페이지" disabled={current === pageCount} onClick={() => goPage(current + 1)}>›</PageArrow>
        </div>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed text-gray-400 break-keep">
        신청은 알림용이에요 · 포인트는 차감되지 않아요 · 아직 교환은 열리지 않았어요
      </p>

      {toast && (
        <div className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-full border border-[#3CDBC0]/35 bg-white/95 px-4 py-2.5 text-center text-xs font-bold text-[#2AB5A0] shadow-xl shadow-[#2AB5A0]/20 backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}

function PageArrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-8 w-8 rounded-full text-sm font-black text-gray-400 disabled:text-gray-200"
    >
      {children}
    </button>
  );
}

function CouponCard({ coupon, applied, balance, onTap }: { coupon: MintCoupon; applied: boolean; balance: number; onTap: () => void }) {
  const Icon = BENEFIT_ICON[coupon.benefitType];
  const short = coupon.pointCost - balance;
  const enough = short <= 0;

  return (
    <button
      onClick={onTap}
      aria-pressed={applied}
      className={`flex flex-col rounded-2xl border bg-white p-4 text-left transition-transform active:scale-[0.98] ${
        applied ? 'border-[#3CDBC0]' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8F8F5] text-[#2AB5A0]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {applied && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-black text-[#2AB5A0]">
            <IconCheck className="h-3 w-3" strokeWidth={2.6} />
            신청됨
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-[11px] font-bold text-gray-500">{coupon.shopName}</p>
      <p className="truncate text-[10px] text-gray-400">{coupon.area} · {coupon.category}</p>
      <p className="mt-1.5 text-sm font-black leading-snug text-gray-800 break-keep">{coupon.title}</p>

      <div className="mt-auto pt-2.5">
        <p className={`text-sm font-black ${applied ? 'text-[#2AB5A0]/50' : enough ? 'text-[#2AB5A0]' : 'text-gray-400'}`}>
          {coupon.pointCost.toLocaleString()}P
        </p>
        {!enough && !applied && (
          <p className="mt-0.5 text-[10px] text-gray-400">{short.toLocaleString()}P 더 필요해요</p>
        )}
        {!applied && (
          <p className="mt-1.5 flex items-center justify-end gap-0.5 text-[10px] font-bold text-gray-300">
            <IconBell className="h-3 w-3" />
            알림 받기
          </p>
        )}
      </div>
    </button>
  );
}
