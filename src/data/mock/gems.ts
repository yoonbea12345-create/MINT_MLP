// 발굴 탭 '오늘의 원석' 목업 — 찜(wishlist)은 실제 저장되므로 place_key가 어긋나지 않게 주소를 고정한다.
export interface MockGem {
  placeName: string; category: string; address: string; area: string;
  lat: number | null; lng: number | null; description: string; imageUrl?: string | null;
}

export const MOCK_GEMS: MockGem[] = [
  { placeName: '몽탄', category: '고깃집', address: '서울 용산구 한강대로40가길 30', area: '용산', lat: 37.5326, lng: 126.9707, description: '힙한 우대갈비 노포, 아는 사람만 아는 웨이팅 맛집', imageUrl: null },
  { placeName: '카페 온천집', category: '카페', address: '서울 마포구 동교로 199', area: '연남', lat: 37.5622, lng: 126.9256, description: '온천 콘셉트 인스타 감성 카페, 아직 안 알려진 신상', imageUrl: null },
  { placeName: '우육면가', category: '중식', address: '서울 중구 청계천로 100', area: '을지로', lat: null, lng: null, description: '현지인만 아는 을지로 뒷골목 우육탕면', imageUrl: null },
];
