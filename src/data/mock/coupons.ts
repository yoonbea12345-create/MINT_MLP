// 민트샵 골목 쿠폰 목업 — 교환 기능은 없다(가짜 문). 포인트도 차감되지 않는다.
// 상호는 전부 가상이다. 실존 프랜차이즈·유명 맛집 이름을 쓰지 않기 위해 "{동네}+{업종 일반명사}"로만 조합했다.
export type CouponBenefitType =
  | 'side' | 'drink' | 'discount_amount' | 'discount_percent'
  | 'time' | 'group' | 'first_visit';

export type CouponTier = 'low' | 'mid' | 'high';

export interface MintCoupon {
  id: string;
  shopName: string;
  area: string;
  category: string;
  benefitType: CouponBenefitType;
  title: string;
  description: string;
  pointCost: number;
  tier: CouponTier;
}

export const MOCK_COUPONS: MintCoupon[] = [
  { id: 'c001', shopName: '성수 골목집', area: '성수', category: '고깃집', benefitType: 'side', title: '계란찜 무료 제공', description: '2인 이상 식사 주문 시 계란찜 하나를 무료로 드려요.', pointCost: 600, tier: 'low' },
  { id: 'c002', shopName: '연남 우동가', area: '연남', category: '일식', benefitType: 'drink', title: '유자차 무료 제공', description: '식사 메뉴 주문 시 따뜻한 유자차 1잔을 무료로 드려요.', pointCost: 500, tier: 'low' },
  { id: 'c003', shopName: '망원 브런치룸', area: '망원', category: '브런치카페', benefitType: 'side', title: '감자튀김 무료 추가', description: '브런치 세트 주문 시 감자튀김을 무료로 추가해드려요.', pointCost: 700, tier: 'low' },
  { id: 'c004', shopName: '이태원 타코야', area: '이태원', category: '멕시칸', benefitType: 'first_visit', title: '웰컴 나초 무료', description: '첫 방문 손님께 웰컴 나초 한 접시를 무료로 드려요.', pointCost: 1200, tier: 'low' },
  { id: 'c005', shopName: '을지로 노가리집', area: '을지로', category: '호프집', benefitType: 'discount_amount', title: '계산서 5,000원 할인', description: '3만원 이상 주문 시 계산서에서 5,000원을 할인해드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c006', shopName: '합정 짬뽕장인', area: '합정', category: '중식', benefitType: 'discount_percent', title: '전메뉴 10% 할인', description: '방문 시 주문하신 전 메뉴를 10% 할인해드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c007', shopName: '홍대 곱창골목', area: '홍대', category: '곱창집', benefitType: 'time', title: '평일 오후 한산할 때 15% 할인', description: '평일 17시~19시 방문 시 전 메뉴 15%를 할인해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c008', shopName: '건대 양갈비하우스', area: '건대', category: '양고기 전문점', benefitType: 'group', title: '4인 이상 사이드 2개 무료', description: '4인 이상 방문 시 사이드 메뉴 2개를 무료로 제공해요.', pointCost: 4500, tier: 'high' },
  { id: 'c009', shopName: '잠실 다이닝룸', area: '잠실', category: '양식 다이닝', benefitType: 'group', title: '단체석 예약비 면제', description: '6인 이상 예약 시 단체석 예약비 1만원을 면제해드려요.', pointCost: 6000, tier: 'high' },
  { id: 'c010', shopName: '여의도 브루하우스', area: '여의도', category: '펍', benefitType: 'group', title: '웰컴 맥주 피처 무료', description: '8인 이상 모임 시 웰컴 맥주 피처 1개를 무료로 드려요.', pointCost: 7500, tier: 'high' },

  { id: 'c011', shopName: '한남 파스타룸', area: '한남', category: '파스타집', benefitType: 'side', title: '샐러드 무료 제공', description: '파스타 2접시 이상 주문 시 사이드 샐러드 하나를 무료로 드려요.', pointCost: 700, tier: 'low' },
  { id: 'c012', shopName: '서촌 마당카페', area: '서촌', category: '카페', benefitType: 'drink', title: '아메리카노 1잔 무료', description: '디저트 2개 이상 주문 시 아메리카노 1잔을 무료로 드려요.', pointCost: 600, tier: 'low' },
  { id: 'c013', shopName: '익선동 한잔상', area: '익선동', category: '이자카야', benefitType: 'side', title: '기본 안주 무료 제공', description: '2인 이상 방문 시 기본 안주 한 접시를 무료로 드려요.', pointCost: 600, tier: 'low' },
  { id: 'c014', shopName: '신촌 고기굽는집', area: '신촌', category: '고깃집', benefitType: 'discount_amount', title: '계산서 3,000원 할인', description: '2만원 이상 주문 시 계산서에서 3,000원을 할인해드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c015', shopName: '성수 분식당', area: '성수', category: '분식', benefitType: 'side', title: '순대 한 접시 무료', description: '2인 이상 분식 세트 주문 시 순대 한 접시를 무료로 드려요.', pointCost: 500, tier: 'low' },
  { id: 'c016', shopName: '연남 브런치뜰', area: '연남', category: '브런치카페', benefitType: 'discount_percent', title: '브런치 세트 12% 할인', description: '2인 이상 주문 시 브런치 세트 메뉴를 12% 할인해드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c017', shopName: '을지로 만두관', area: '을지로', category: '중식', benefitType: 'drink', title: '자스민차 무료 제공', description: '식사 메뉴 2개 이상 주문 시 자스민차 1주전자를 무료로 드려요.', pointCost: 500, tier: 'low' },
  { id: 'c018', shopName: '홍대 평양냉면가', area: '홍대', category: '냉면집', benefitType: 'side', title: '군만두 3알 무료 추가', description: '냉면 2그릇 이상 주문 시 군만두 3알을 무료로 추가해드려요.', pointCost: 700, tier: 'low' },
  { id: 'c019', shopName: '망원 골목카페', area: '망원', category: '카페', benefitType: 'time', title: '평일 오후 3~5시 20% 할인', description: '평일 15시~17시 방문 시 음료 전 메뉴를 20% 할인해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c020', shopName: '합정 다이닝바', area: '합정', category: '양식 다이닝', benefitType: 'side', title: '오늘의 수프 무료 제공', description: '메인 요리 2개 이상 주문 시 오늘의 수프를 무료로 드려요.', pointCost: 800, tier: 'low' },
  { id: 'c021', shopName: '이태원 골목포차', area: '이태원', category: '포차', benefitType: 'drink', title: '생맥주 1잔 무료', description: '안주 2개 이상 주문 시 생맥주 500cc 1잔을 무료로 드려요.', pointCost: 900, tier: 'low' },
  { id: 'c022', shopName: '건대 화로구이집', area: '건대', category: '고깃집', benefitType: 'discount_amount', title: '계산서 20,000원 할인', description: '10만원 이상 주문 시 계산서에서 20,000원을 할인해드려요.', pointCost: 5000, tier: 'high' },
  { id: 'c023', shopName: '잠실 스시상', area: '잠실', category: '일식', benefitType: 'side', title: '계란초밥 2피스 무료', description: '스시 세트 2인분 이상 주문 시 계란초밥 2피스를 무료로 드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c024', shopName: '여의도 아침식탁', area: '여의도', category: '브런치카페', benefitType: 'first_visit', title: '첫 방문 커피 무료', description: '첫 방문 손님께 아메리카노 1잔을 무료로 드려요.', pointCost: 800, tier: 'low' },

  { id: 'c025', shopName: '한남 와인다이닝', area: '한남', category: '양식 다이닝', benefitType: 'discount_percent', title: '와인 전품목 15% 할인', description: '식사 메뉴 2개 이상 주문 시 와인 전 품목을 15% 할인해드려요.', pointCost: 2500, tier: 'mid' },
  { id: 'c026', shopName: '서촌 국밥터', area: '서촌', category: '국밥집', benefitType: 'side', title: '공깃밥 무제한 제공', description: '2인 이상 방문 시 공깃밥을 무제한으로 드려요.', pointCost: 500, tier: 'low' },
  { id: 'c027', shopName: '익선동 빵공방', area: '익선동', category: '베이커리', benefitType: 'drink', title: '드립커피 1잔 무료', description: '빵 15,000원 이상 구매 시 드립커피 1잔을 무료로 드려요.', pointCost: 700, tier: 'low' },
  { id: 'c028', shopName: '신촌 한잔호프', area: '신촌', category: '호프집', benefitType: 'time', title: '평일 오후 5~7시 안주 20% 할인', description: '평일 17시~19시 방문 시 안주 전 메뉴를 20% 할인해드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c029', shopName: '성수 커피창고', area: '성수', category: '카페', benefitType: 'discount_amount', title: '음료·디저트 3,000원 할인', description: '2만원 이상 주문 시 계산서에서 3,000원을 할인해드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c030', shopName: '연남 막창골목', area: '연남', category: '곱창집', benefitType: 'side', title: '볶음밥 1인분 무료', description: '3인 이상 방문 시 마무리 볶음밥 1인분을 무료로 드려요.', pointCost: 900, tier: 'low' },
  { id: 'c031', shopName: '을지로 뒷골목포차', area: '을지로', category: '포차', benefitType: 'discount_percent', title: '안주 전메뉴 12% 할인', description: '3인 이상 방문 시 안주 전 메뉴를 12% 할인해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c032', shopName: '홍대 분식골목', area: '홍대', category: '분식', benefitType: 'drink', title: '식혜 1잔 무료', description: '2인 이상 세트 주문 시 식혜 1잔을 무료로 드려요.', pointCost: 500, tier: 'low' },
  { id: 'c033', shopName: '망원 정육식당', area: '망원', category: '고깃집', benefitType: 'side', title: '된장찌개 무료 제공', description: '3인 이상 고기 주문 시 된장찌개 1인분을 무료로 드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c034', shopName: '합정 책방카페', area: '합정', category: '카페', benefitType: 'first_visit', title: '첫 방문 쿠키 증정', description: '첫 방문 손님께 수제 쿠키 1개를 무료로 드려요.', pointCost: 600, tier: 'low' },
  { id: 'c035', shopName: '이태원 다이닝하우스', area: '이태원', category: '양식 다이닝', benefitType: 'discount_amount', title: '계산서 15,000원 할인', description: '8만원 이상 주문 시 계산서에서 15,000원을 할인해드려요.', pointCost: 4500, tier: 'high' },
  { id: 'c036', shopName: '건대 짜장면가', area: '건대', category: '중식', benefitType: 'time', title: '평일 점심 15% 할인', description: '평일 11시~14시 방문 시 식사 메뉴를 15% 할인해드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c037', shopName: '잠실 국밥상', area: '잠실', category: '국밥집', benefitType: 'side', title: '수육 3점 무료 추가', description: '국밥 2그릇 이상 주문 시 수육 3점을 무료로 추가해드려요.', pointCost: 700, tier: 'low' },
  { id: 'c038', shopName: '여의도 화로집', area: '여의도', category: '고깃집', benefitType: 'group', title: '6인 이상 사이드 3개 무료', description: '6인 이상 방문 시 사이드 메뉴 3개를 무료로 제공해요.', pointCost: 5000, tier: 'high' },

  { id: 'c039', shopName: '한남 스시가', area: '한남', category: '일식', benefitType: 'side', title: '연어 사시미 2점 무료 추가', description: '2인 이상 세트 주문 시 연어 사시미 2점을 무료로 추가해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c040', shopName: '서촌 냉면가', area: '서촌', category: '냉면집', benefitType: 'discount_amount', title: '계산서 4,000원 할인', description: '3만원 이상 주문 시 계산서에서 4,000원을 할인해드려요.', pointCost: 2200, tier: 'mid' },
  { id: 'c041', shopName: '익선동 약주집', area: '익선동', category: '술집', benefitType: 'drink', title: '전통주 1병 무료', description: '안주 3만원 이상 주문 시 전통주 1병을 무료로 드려요.', pointCost: 2500, tier: 'mid' },
  { id: 'c042', shopName: '신촌 아침뜰', area: '신촌', category: '브런치카페', benefitType: 'time', title: '평일 오전 10~12시 15% 할인', description: '평일 10시~12시 방문 시 브런치 메뉴를 15% 할인해드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c043', shopName: '성수 파스타공방', area: '성수', category: '파스타집', benefitType: 'side', title: '트러플 감자튀김 무료', description: '메인 메뉴 2개 이상 주문 시 트러플 감자튀김을 무료로 드려요.', pointCost: 1800, tier: 'mid' },
  { id: 'c044', shopName: '연남 타코마당', area: '연남', category: '멕시칸', benefitType: 'discount_percent', title: '타코 전메뉴 15% 할인', description: '2인 이상 방문 시 타코 전 메뉴를 15% 할인해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c045', shopName: '을지로 숯불집', area: '을지로', category: '고깃집', benefitType: 'discount_amount', title: '계산서 25,000원 할인', description: '12만원 이상 주문 시 계산서에서 25,000원을 할인해드려요.', pointCost: 6000, tier: 'high' },
  { id: 'c046', shopName: '홍대 야키토리집', area: '홍대', category: '이자카야', benefitType: 'first_visit', title: '첫 방문 꼬치 3개 무료', description: '첫 방문 손님께 야키토리 3꼬치를 무료로 드려요.', pointCost: 1500, tier: 'mid' },
  { id: 'c047', shopName: '한남 브런치가', area: '한남', category: '브런치카페', benefitType: 'discount_percent', title: '주말 브런치 10% 할인', description: '주말 2인 이상 방문 시 브런치 세트를 10% 할인해드려요.', pointCost: 2200, tier: 'mid' },
  { id: 'c048', shopName: '서촌 골목다방', area: '서촌', category: '카페', benefitType: 'time', title: '평일 오후 2~4시 디저트 30% 할인', description: '평일 14시~16시 방문 시 디저트 메뉴를 30% 할인해드려요.', pointCost: 2000, tier: 'mid' },
  { id: 'c049', shopName: '익선동 한옥다이닝', area: '익선동', category: '양식 다이닝', benefitType: 'discount_amount', title: '계산서 30,000원 할인', description: '15만원 이상 주문 시 계산서에서 30,000원을 할인해드려요.', pointCost: 7000, tier: 'high' },
  { id: 'c050', shopName: '신촌 중화반점', area: '신촌', category: '중식', benefitType: 'drink', title: '탄산음료 2캔 무료', description: '2만원 이상 주문 시 탄산음료 2캔을 무료로 드려요.', pointCost: 500, tier: 'low' },
];
