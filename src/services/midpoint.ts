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

// 전국 주요 도시 (수도권 외)
const NATIONAL_AREAS: { name: string; lat: number; lng: number }[] = [
  // 제주
  { name: '제주시 연동',   lat: 33.4996, lng: 126.5312 },
  { name: '제주 애월',     lat: 33.4601, lng: 126.3124 },
  { name: '제주 중문',     lat: 33.2544, lng: 126.4120 },
  { name: '서귀포시',      lat: 33.2534, lng: 126.5600 },
  { name: '제주 성산',     lat: 33.4614, lng: 126.9199 },
  // 부산
  { name: '부산 해운대',   lat: 35.1631, lng: 129.1635 },
  { name: '부산 서면',     lat: 35.1579, lng: 129.0586 },
  { name: '부산 남포동',   lat: 35.0976, lng: 129.0319 },
  { name: '부산역',        lat: 35.1151, lng: 129.0424 },
  // 대구
  { name: '대구 동성로',   lat: 35.8714, lng: 128.5958 },
  { name: '대구 수성구',   lat: 35.8585, lng: 128.6313 },
  // 광주
  { name: '광주 상무지구', lat: 35.1544, lng: 126.8526 },
  { name: '광주 충장로',   lat: 35.1467, lng: 126.9157 },
  // 대전
  { name: '대전 둔산동',   lat: 36.3504, lng: 127.3845 },
  { name: '대전역',        lat: 36.3323, lng: 127.4343 },
  // 울산
  { name: '울산 삼산동',   lat: 35.5428, lng: 129.3320 },
  // 강원
  { name: '강릉 시내',     lat: 37.7519, lng: 128.8760 },
  { name: '춘천 명동',     lat: 37.8813, lng: 127.7298 },
  // 충청
  { name: '청주 성안길',   lat: 36.6424, lng: 127.4890 },
  // 전라
  { name: '전주 한옥마을', lat: 35.8150, lng: 127.1531 },
  // 경상
  { name: '경주 시내',     lat: 35.8562, lng: 129.2247 },
];

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

const ALL_AREAS = [...METRO_AREAS, ...NATIONAL_AREAS];

// 서울 중심 기준점
const SEOUL_CENTER: Coordinates = { lat: 37.5665, lng: 126.9780 };

// 볼록 껍질(Convex Hull) — Graham Scan, CCW 순서
function computeConvexHull(points: Coordinates[]): Coordinates[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.lng !== b.lng ? a.lng - b.lng : a.lat - b.lat);
  const cross = (O: Coordinates, A: Coordinates, B: Coordinates) =>
    (A.lng - O.lng) * (B.lat - O.lat) - (A.lat - O.lat) * (B.lng - O.lng);
  const lower: Coordinates[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Coordinates[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// n각형 무게중심 (신발끈/Shoelace 공식) — 2명: 선분 중점, 3명: 삼각형 무게중심, n명: 다각형 무게중심
function polygonCentroid(hull: Coordinates[]): Coordinates {
  if (hull.length === 0) return SEOUL_CENTER;
  if (hull.length === 1) return hull[0];
  if (hull.length === 2) return { lat: (hull[0].lat + hull[1].lat) / 2, lng: (hull[0].lng + hull[1].lng) / 2 };
  let area = 0, cx = 0, cy = 0;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = hull[i].lng * hull[j].lat - hull[j].lng * hull[i].lat;
    area += cross;
    cx += (hull[i].lng + hull[j].lng) * cross;
    cy += (hull[i].lat + hull[j].lat) * cross;
  }
  area /= 2;
  // 면적 0 (점들이 일직선) → 산술평균으로 폴백
  if (Math.abs(area) < 1e-10) {
    return { lat: hull.reduce((s, p) => s + p.lat, 0) / hull.length, lng: hull.reduce((s, p) => s + p.lng, 0) / hull.length };
  }
  return { lat: cy / (6 * area), lng: cx / (6 * area) };
}

/**
 * 2명: 두 거주지 선분의 직선 중점
 * n명: n개 거주지로 이루어진 n각형의 기하학적 무게중심 (Shoelace 공식)
 * 반환하는 midpoint는 항상 이론상 완벽한 거리 중간지점.
 */
export function findBalancedAreas(
  departures: Coordinates[],
  count = 3,
): { areas: string[]; midpoint: Coordinates; areaName: string; compromiseMessage?: string } {
  const fallback = { areas: ['명동', '홍대입구역', '강남역'], midpoint: SEOUL_CENTER, areaName: '서울 중심부' };
  if (departures.length === 0) return fallback;

  // 볼록 껍질 → 다각형 무게중심
  const hull = computeConvexHull(departures);
  const midpoint = polygonCentroid(hull);

  // 출발지 간 최대 직선거리
  let maxPairDist = 0;
  for (let i = 0; i < departures.length; i++) {
    for (let j = i + 1; j < departures.length; j++) {
      const d = haversineKm(departures[i].lat, departures[i].lng, departures[j].lat, departures[j].lng);
      if (d > maxPairDist) maxPairDist = d;
    }
  }

  // 중심점에서 가장 가까운 지역 순으로 정렬
  const nearest = ALL_AREAS
    .map((area) => ({ ...area, dist: haversineKm(midpoint.lat, midpoint.lng, area.lat, area.lng) }))
    .sort((a, b) => a.dist - b.dist);

  const areas = nearest.slice(0, count).map((a) => a.name);
  const areaName = nearest[0]?.name ?? '알 수 없는 지역';

  const compromiseMessage = maxPairDist > 150
    ? `출발지 간 거리가 멀어 ${areaName}을(를) 중간 지점으로 보완했어요 📍`
    : undefined;

  return { areas, midpoint, areaName, compromiseMessage };
}

// 특정 좌표 근처 지역명 반환 — 전국 목록 사용
export function findNearestAreas(midpoint: Coordinates, count = 3): string[] {
  return ALL_AREAS
    .map((area) => ({
      name: area.name,
      dist: haversineKm(area.lat, area.lng, midpoint.lat, midpoint.lng),
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
