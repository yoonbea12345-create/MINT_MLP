import proj4 from 'proj4';

// EPSG:5174 (Korean 1985 / Central Belt, Bessel 1841, 중부원점 TM) → WGS84(EPSG:4326).
// 행안부 인허가 API(CRD_INFO_X/CRD_INFO_Y)의 좌표계로 실제 API 응답(예: X≈204644, Y≈444138 →
// 서울 강남구 대치동 부근 lng≈127.0504, lat≈37.4994)으로 검증 완료.
const EPSG_5174 =
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel ' +
  '+units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43';

proj4.defs('EPSG:5174', EPSG_5174);

export function tmToWgs84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('EPSG:5174', 'EPSG:4326', [x, y]);
  return { lat, lng };
}
