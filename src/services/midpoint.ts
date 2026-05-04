export interface Coordinates {
  lat: number;
  lng: number;
}

// 구형(球形) 지구 기준 두 좌표 간 직선거리 (km)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 직선거리 → 대중교통 예상 소요시간(분) — 수도권 실측 기반 구간 보정
// 구간별 실제 지하철+환승+대기 시간을 역산해 맞춤
function estimateTransitMin(km: number): number {
  if (km <= 3)  return Math.round(7   + km * 3.5);        // ~18분
  if (km <= 10) return Math.round(17.5 + (km -  3) * 2.5); // 18→35분
  if (km <= 25) return Math.round(35  + (km - 10) * 2.0);  // 35→65분
  return        Math.round(65  + (km - 25) * 1.8);         // 65분~
}

// 수도권 도심 상업지역만 포함 (도시화 낮은 지역 제외)
const METRO_AREAS: { name: string; lat: number; lng: number }[] = [
  // 서울
  { name: '강남 MICE 관광특구', lat: 37.5115, lng: 127.0595 },
  { name: '동대문 관광특구',     lat: 37.5700, lng: 127.0097 },
  { name: '명동',               lat: 37.5636, lng: 126.9869 },
  { name: '홍대입구역',          lat: 37.5573, lng: 126.9243 },
  { name: '이태원 관광특구',     lat: 37.5344, lng: 126.9942 },
  { name: '합정역',              lat: 37.5498, lng: 126.9137 },
  { name: '성수역',              lat: 37.5447, lng: 127.0557 },
  { name: '건대입구역',          lat: 37.5403, lng: 127.0699 },
  { name: '신촌·이대역',         lat: 37.5576, lng: 126.9368 },
  { name: '왕십리역',            lat: 37.5612, lng: 127.0383 },
  { name: '여의도',              lat: 37.5219, lng: 126.9245 },
  { name: '강남역',              lat: 37.4979, lng: 127.0276 },
  { name: '삼성역',              lat: 37.5088, lng: 127.0630 },
  { name: '역삼역',              lat: 37.5001, lng: 127.0366 },
  { name: '서울역',              lat: 37.5547, lng: 126.9707 },
  { name: '종각역',              lat: 37.5701, lng: 126.9823 },
  { name: '혜화역',              lat: 37.5822, lng: 127.0016 },
  { name: '한남·이태원',         lat: 37.5338, lng: 126.9976 },
  { name: '잠실 관광특구',       lat: 37.5131, lng: 127.1000 },
  { name: '북촌한옥마을',        lat: 37.5827, lng: 126.9845 },
  // 경기 남부 (상업 중심지만)
  { name: '수원역',              lat: 37.2660, lng: 127.0000 },
  { name: '수원 인계동',         lat: 37.2636, lng: 127.0286 },
  { name: '판교역',              lat: 37.3943, lng: 127.1108 },
  { name: '분당 서현역',         lat: 37.3838, lng: 127.1228 },
  { name: '성남 모란역',         lat: 37.4340, lng: 127.1290 },
  { name: '안양 범계역',         lat: 37.3934, lng: 126.9528 },
  // 경기 북부 (상업 중심지만)
  { name: '고양 정발산역',       lat: 37.6759, lng: 126.7716 },
  { name: '의정부역',            lat: 37.7381, lng: 127.0439 },
  // 경기 서부 / 인천
  { name: '부천 중동',           lat: 37.5033, lng: 126.7613 },
  { name: '인천 부평역',         lat: 37.4883, lng: 126.7238 },
];

/**
 * 출발지들로부터 소요시간 편차가 가장 작은 도심 지역을 반환.
 *
 * 스코어 = 소요시간 범위(max-min) × 2  +  평균 소요시간 × 0.3
 *          + 평균 60분 초과 시 추가 패널티
 * → 스코어가 낮을수록 공평하고 접근성 좋은 지역
 */
export function findBalancedAreas(
  departures: Coordinates[],
  count = 3,
): { areas: string[]; midpoint: Coordinates; areaName: string } {
  const fallback = { areas: ['명동', '홍대입구역', '강남역'], midpoint: { lat: 37.5665, lng: 126.9780 }, areaName: '서울 중심부' };
  if (departures.length === 0) return fallback;

  const scored = METRO_AREAS.map((area) => {
    const times = departures.map((dep) =>
      estimateTransitMin(haversineKm(dep.lat, dep.lng, area.lat, area.lng))
    );
    const maxT = Math.max(...times);
    const minT = Math.min(...times);
    const range = maxT - minT;
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    // 편차 최소화 + 과도하게 먼 지역 패널티
    const score = range * 2 + avg * 0.3 + Math.max(0, avg - 60) * 1.5;
    return { ...area, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];

  return {
    areas: scored.slice(0, count).map((s) => s.name),
    midpoint: { lat: best.lat, lng: best.lng },
    areaName: best.name,
  };
}

// 프리셋 지역용: 특정 좌표 근처 지역명 반환 (기존 유지)
export function findNearestAreas(midpoint: Coordinates, count = 3): string[] {
  return METRO_AREAS
    .map((area) => ({
      name: area.name,
      dist: Math.sqrt((area.lat - midpoint.lat) ** 2 + (area.lng - midpoint.lng) ** 2),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map((a) => a.name);
}

// 하위 호환용 (프리셋 등에서 사용)
export function calcMidpoint(coords: Coordinates[]): Coordinates {
  if (coords.length === 0) return { lat: 37.5665, lng: 126.9780 };
  return {
    lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
    lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
  };
}

// 직접 선택용 지역 프리셋
export interface PresetRegion {
  id: string;
  label: string;
  sublabel: string;
  midpoint: Coordinates;
}

export const PRESET_REGIONS: PresetRegion[] = [
  { id: 'gangnam',        label: '강남/서초',   sublabel: '강남역·역삼·선릉',     midpoint: { lat: 37.4979, lng: 127.0276 } },
  { id: 'hongdae',        label: '홍대/마포',   sublabel: '홍대입구·합정·연남',   midpoint: { lat: 37.5535, lng: 126.9240 } },
  { id: 'itaewon',        label: '이태원/한남', sublabel: '이태원·경리단길·한남', midpoint: { lat: 37.5344, lng: 126.9942 } },
  { id: 'sinchon',        label: '신촌/연대',   sublabel: '신촌·이대·연남동',     midpoint: { lat: 37.5576, lng: 126.9368 } },
  { id: 'seongsu',        label: '성수/건대',   sublabel: '성수역·건대입구·뚝섬', midpoint: { lat: 37.5425, lng: 127.0628 } },
  { id: 'myeongdong',     label: '명동/시청',   sublabel: '명동·을지로·종각',     midpoint: { lat: 37.5636, lng: 126.9869 } },
  { id: 'jamsil',         label: '잠실/송파',   sublabel: '잠실역·잠실나루·석촌', midpoint: { lat: 37.5131, lng: 127.1000 } },
  { id: 'jongno',         label: '종로/혜화',   sublabel: '대학로·혜화·낙원동',   midpoint: { lat: 37.5822, lng: 127.0016 } },
  { id: 'yeouido',        label: '여의도',      sublabel: '여의도·영등포역',      midpoint: { lat: 37.5219, lng: 126.9245 } },
  { id: 'gyeonggi-south', label: '경기 남부',   sublabel: '수원·성남·판교',       midpoint: { lat: 37.3500, lng: 127.0500 } },
  { id: 'gyeonggi-north', label: '경기 북부',   sublabel: '고양·일산·의정부',     midpoint: { lat: 37.6600, lng: 126.8900 } },
  { id: 'incheon',        label: '인천/부천',   sublabel: '인천·부천·김포',       midpoint: { lat: 37.4900, lng: 126.7500 } },
];
