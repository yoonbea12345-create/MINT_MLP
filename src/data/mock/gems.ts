// 발굴 탭 '오늘의 원석' 목업 — 찜(wishlist)은 실제 저장되므로 place_key가 어긋나지 않게 주소를 고정한다.
// 좌표는 전부 null — 실존 가게라 검증 안 된 좌표를 박으면 지도 링크가 엉뚱한 곳을 열어서, 카카오맵이 이름으로 찾게 비워 둔다.
// 사진 필드는 두지 않는다 — 실존 가게라 무단 이미지를 쓸 수 없고 외부 URL도 못 쓴다.
// 카드 썸네일은 Discover.tsx가 category 문자열로 만드는 컬러 블록이 대신한다(찜 목록의 자유 문자열 category도 같은 매핑을 탄다).
export interface MockGem {
  placeName: string; category: string; address: string; area: string;
  lat: number | null; lng: number | null; description: string;
}

export const MOCK_GEMS: MockGem[] = [
  { placeName: '몽탄', category: '고깃집', address: '서울 용산구 한강대로40가길 30', area: '용산', lat: null, lng: null, description: '힙한 우대갈비 노포, 아는 사람만 아는 웨이팅 맛집' },
  { placeName: '카페 온천집', category: '카페', address: '서울 마포구 동교로 199', area: '연남', lat: null, lng: null, description: '온천 콘셉트 인스타 감성 카페, 아직 안 알려진 신상' },
  { placeName: '우육면가', category: '중식', address: '서울 중구 청계천로 100', area: '을지로', lat: null, lng: null, description: '현지인만 아는 을지로 뒷골목 우육탕면' },
  { placeName: '밀도', category: '베이커리', address: '서울 성동구 아차산로7길 5', area: '성수', lat: null, lng: null, description: '오후면 식빵이 먼저 동나는 동네 빵집, 시간 맞춰 가야 해요' },
  { placeName: '쿠시마사', category: '이자카야', address: '서울 마포구 와우산로29길 6', area: '홍대', lat: null, lng: null, description: '카운터 자리가 전부인 꼬치집, 둘이 조용히 마시기 좋아요' },
  { placeName: '바 참', category: '바', address: '서울 종로구 자하문로1길 12', area: '서촌', lat: null, lng: null, description: '간판이 눈에 잘 안 띄는 칵테일 바, 대화가 끊기지 않는 분위기' },
  { placeName: '리틀넥', category: '파스타집', address: '서울 용산구 대사관로 31', area: '한남', lat: null, lng: null, description: '브런치와 파스타를 같이 하는 집, 주말 오전이 의외로 한산해요' },
  { placeName: '옥동식', category: '한식', address: '서울 마포구 양화로7길 44-10', area: '합정', lat: null, lng: null, description: '돼지곰탕 한 그릇만 파는 작은 가게, 재료가 떨어지면 문을 닫아요' },
];
