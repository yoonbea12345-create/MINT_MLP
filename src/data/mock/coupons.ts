// 민트샵 쿠폰 목업 — 교환 기능은 없다(가짜 문). 포인트 차감도 하지 않는다.
export interface MockCoupon {
  id: string; brand: string; title: string; pointCost: number;
  imageEmoji: string; stock: 'available' | 'soldout' | 'comingSoon';
}

export const MOCK_COUPONS: MockCoupon[] = [
  { id: 'c1', brand: '스타벅스', title: '아메리카노 Tall', pointCost: 3000, imageEmoji: '☕', stock: 'available' },
  { id: 'c2', brand: 'CU', title: '모바일 상품권 3천원', pointCost: 2500, imageEmoji: '🏪', stock: 'available' },
  { id: 'c3', brand: '배달의민족', title: '배달비 할인쿠폰', pointCost: 1500, imageEmoji: '🛵', stock: 'comingSoon' },
  { id: 'c4', brand: 'CGV', title: '영화 예매권', pointCost: 8000, imageEmoji: '🎬', stock: 'soldout' },
];
