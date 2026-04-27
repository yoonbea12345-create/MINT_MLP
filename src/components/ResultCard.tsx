import { useState } from 'react';
import type { PlaceRecommendation } from '../services/ai';
import { congestionDotClass } from '../services/seoulData';
import type { CongestionLevel } from '../services/seoulData';
import MiniMap from './MiniMap';

interface Props {
  result: PlaceRecommendation;
  withCourse: boolean;
  onToggleCourse: () => void;
  onRetry: () => void;
  onShare: () => void;
  onReserve: () => void;
}

function getCurrentTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function parseOpenStatus(openingHours?: string): { label: string; isOpen: boolean } | null {
  if (!openingHours) return null;
  // "11:00 ~ 23:00" 또는 "17:00 ~ 02:00" 형태
  const match = openingHours.match(/(\d{2}):(\d{2})\s*[~\-]\s*(\d{2}):(\d{2})/);
  if (!match) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
  let closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);

  // 자정 넘기는 케이스 (예: 17:00 ~ 02:00)
  if (closeMin < openMin) closeMin += 24 * 60;

  const isOpen = nowMin >= openMin && nowMin < closeMin;

  // 영업 전 vs 영업 종료 구분
  let label: string;
  if (isOpen) {
    label = '영업중';
  } else if (nowMin < openMin) {
    label = '영업 전';
  } else {
    label = '영업 종료';
  }
  return { label, isOpen };
}

export default function ResultCard({ result, withCourse, onToggleCourse, onRetry, onShare, onReserve }: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const hasCoords = !!(result.lat && result.lng);
  const currentTime = getCurrentTimeStr();
  const openStatus = parseOpenStatus(result.openingHours);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* 메인 카드 */}
      <div className="result-gradient rounded-3xl p-5 text-white shadow-xl shadow-[#3CDBC0]/30">
        {/* 상단: 카테고리 + 혼잡도 */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold opacity-80 bg-white/20 px-2.5 py-1 rounded-full">
            {result.category}
          </span>
          <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
            <div
              className={`w-2 h-2 rounded-full ${congestionDotClass(result.congestionLevel as CongestionLevel)}`}
            />
            <span className="text-xs font-medium">
              {currentTime} 기준 · {result.congestionLevel}
            </span>
          </div>
        </div>

        {/* 장소명 */}
        <h2 className="text-2xl font-black mt-3 mb-1 leading-tight">
          오늘은<br /><span className="text-3xl">{result.placeName}</span>
        </h2>
        <p className="text-sm opacity-90 mb-3">{result.description}</p>

        {/* 바이브 태그 */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {result.vibeTags.map((tag) => (
            <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>

        {/* 상세 정보 */}
        <div className="bg-white/15 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-start gap-2 text-sm">
            <span className="opacity-70 shrink-0">📍</span>
            <span className="opacity-90">{result.address || result.area}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-70">💰</span>
            <span className="opacity-90">{result.priceRange}</span>
          </div>
          {result.openingHours && (
            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-70">🕐</span>
              <span className="opacity-90">{result.openingHours}</span>
              {openStatus && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    openStatus.isOpen
                      ? 'bg-green-400 text-white'
                      : 'bg-red-400 text-white'
                  }`}
                >
                  {openStatus.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 실시간 혼잡도 강조 배너 */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border-2 border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${congestionDotClass(result.congestionLevel as CongestionLevel)} animate-mint-pulse`}
          />
          <span className="text-xs font-bold text-gray-500">실시간 혼잡도</span>
        </div>
        <div className="flex-1 text-sm font-bold text-gray-800">
          {result.area || result.placeName} 지역
        </div>
        <span
          className={`text-xs font-black px-2.5 py-1 rounded-full ${
            result.congestionLevel === '여유'
              ? 'bg-green-100 text-green-700'
              : result.congestionLevel === '보통'
              ? 'bg-yellow-100 text-yellow-700'
              : result.congestionLevel === '약간 붐빔'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {result.congestionLevel}
        </span>
      </div>

      {/* 지도 토글 */}
      {hasCoords && (
        <button
          onClick={() => setMapVisible(!mapVisible)}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all"
        >
          {mapVisible ? '🗺️ 지도 숨기기' : '🗺️ 지도로 보기'}
        </button>
      )}

      {mapVisible && hasCoords && (
        <div className="animate-fade-in-up">
          <MiniMap lat={result.lat!} lng={result.lng!} placeName={result.placeName} />
        </div>
      )}

      {/* 2차 코스 */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-800">2차 코스</div>
            <div className="text-xs text-gray-400">근처 2차 장소도 추천받기</div>
          </div>
          <button
            onClick={onToggleCourse}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
              withCourse ? 'bg-[#3CDBC0]' : 'bg-gray-200'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                withCourse ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {withCourse && result.secondPlace && (
          <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">2차</span>
              <span className="text-sm font-bold text-gray-800">{result.secondPlace.placeName}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{result.secondPlace.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>🚶 도보 {result.secondPlace.walkingMinutes}분</span>
              <span>·</span>
              <span>{result.secondPlace.category}</span>
            </div>
          </div>
        )}
      </div>

      {/* 예약하기 버튼 */}
      <button
        onClick={onReserve}
        className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] active:scale-95 transition-all"
      >
        📋 이 장소 예약하기
      </button>

      {/* 카카오톡 공유 */}
      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl bg-[#FEE500] text-[#3A1D1D] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.13 1.73 5.9 4.35 7.57V22l3.97-2.18c1.06.29 2.18.44 3.33.44 5.52 0 10-4.08 10-9.1C23.65 6.08 17.52 2 12 2z"/>
        </svg>
        카카오톡으로 공유하기
      </button>

      {/* 다시 뽑기 */}
      <button
        onClick={onRetry}
        className="w-full py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-bold text-sm flex items-center justify-center gap-2 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all active:scale-95"
      >
        🔄 다시 뽑기
      </button>
    </div>
  );
}
