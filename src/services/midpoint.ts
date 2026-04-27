export interface Coordinates {
  lat: number;
  lng: number;
}

export function calcMidpoint(coords: Coordinates[]): Coordinates {
  if (coords.length === 0) return { lat: 37.5665, lng: 126.9780 };
  const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const lng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;
  return { lat, lng };
}

// 서울 주요 지역 매핑 (혼잡도 API 지역명과 매칭)
const SEOUL_AREAS: { name: string; lat: number; lng: number }[] = [
  { name: '강남 MICE 관광특구', lat: 37.5115, lng: 127.0595 },
  { name: '동대문 관광특구', lat: 37.5700, lng: 127.0097 },
  { name: '명동', lat: 37.5636, lng: 126.9869 },
  { name: '홍대입구역', lat: 37.5573, lng: 126.9243 },
  { name: '이태원 관광특구', lat: 37.5344, lng: 126.9942 },
  { name: '합정역', lat: 37.5498, lng: 126.9137 },
  { name: '성수역', lat: 37.5447, lng: 127.0557 },
  { name: '건대입구역', lat: 37.5403, lng: 127.0699 },
  { name: '신촌·이대역', lat: 37.5576, lng: 126.9368 },
  { name: '왕십리역', lat: 37.5612, lng: 127.0383 },
  { name: '여의도', lat: 37.5219, lng: 126.9245 },
  { name: '강남역', lat: 37.4979, lng: 127.0276 },
  { name: '삼성역', lat: 37.5088, lng: 127.0630 },
  { name: '역삼역', lat: 37.5001, lng: 127.0366 },
  { name: '서울역', lat: 37.5547, lng: 126.9707 },
  { name: '종각역', lat: 37.5701, lng: 126.9823 },
  { name: '혜화역', lat: 37.5822, lng: 127.0016 },
  { name: '한남·이태원', lat: 37.5338, lng: 126.9976 },
  { name: '잠실 관광특구', lat: 37.5131, lng: 127.1000 },
  { name: '북촌한옥마을', lat: 37.5827, lng: 126.9845 },
];

export function findNearestAreas(midpoint: Coordinates, count = 3): string[] {
  const withDist = SEOUL_AREAS.map((area) => ({
    name: area.name,
    dist: Math.sqrt(
      Math.pow(area.lat - midpoint.lat, 2) + Math.pow(area.lng - midpoint.lng, 2)
    ),
  }));
  withDist.sort((a, b) => a.dist - b.dist);
  return withDist.slice(0, count).map((a) => a.name);
}
