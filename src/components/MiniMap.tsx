import { useEffect, useRef } from 'react';
import { ensureKakaoMaps } from '../utils/kakaoLoader';

interface KakaoMapInstance {
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
}
interface KakaoLatLng { getLat: () => number; getLng: () => number }
interface KakaoMarker { setMap: (map: KakaoMapInstance | null) => void }
interface KakaoInfoWindow {
  open: (map: KakaoMapInstance, marker: KakaoMarker) => void;
  close: () => void;
  setContent: (content: string) => void;
}

interface Props {
  lat: number;
  lng: number;
  placeName: string;
}

export default function MiniMap({ lat, lng, placeName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<KakaoMapInstance | null>(null);
  const markerInstance = useRef<KakaoMarker | null>(null);
  const infoWindowInstance = useRef<KakaoInfoWindow | null>(null);

  function renderMap() {
    if (!mapRef.current || !window.kakao?.maps) return;

    const center = new window.kakao.maps.LatLng(lat, lng);

    if (mapInstance.current) {
      // 지도 이미 존재 → 센터 이동 + 마커 갱신
      mapInstance.current.setCenter(center);
      if (markerInstance.current) markerInstance.current.setMap(null);
      const marker = new window.kakao.maps.Marker({ position: center, map: mapInstance.current });
      markerInstance.current = marker;
      infoWindowInstance.current?.setContent(infoContent(placeName));
      infoWindowInstance.current?.open(mapInstance.current, marker);
      return;
    }

    // 최초 생성
    const map = new window.kakao.maps.Map(mapRef.current, { center, level: 4 });
    mapInstance.current = map;

    const marker = new window.kakao.maps.Marker({ position: center, map });
    markerInstance.current = marker;

    const infoWindow = new window.kakao.maps.InfoWindow({ content: infoContent(placeName) });
    infoWindowInstance.current = infoWindow;
    infoWindow.open(map, marker);
  }

  function infoContent(name: string) {
    return `<div style="padding:6px 10px;font-size:12px;font-weight:700;color:#2AB5A0;font-family:'Pretendard',sans-serif;">${name}</div>`;
  }

  useEffect(() => {
    let active = true;
    ensureKakaoMaps()
      .then(() => { if (active) renderMap(); })
      .catch(() => { /* SDK 로드 실패 시 지도 없이 링크만 노출 */ });
    return () => { active = false; };
  }, [lat, lng, placeName]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      <div ref={mapRef} className="w-full h-52" />
      <a
        href={`https://map.kakao.com/link/map/${encodeURIComponent(placeName)},${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2.5 bg-[#FFE812] text-[#3A1D1D] text-sm font-bold hover:bg-[#FFD700] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
        카카오맵에서 길찾기
      </a>
    </div>
  );
}
