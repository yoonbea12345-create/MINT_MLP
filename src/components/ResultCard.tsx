import { useState, useEffect } from 'react';
import type { PlaceRecommendation, CourseRecommendation, CoursePlace } from '../services/ai';
import { congestionDotClass } from '../services/seoulData';
import type { CongestionLevel } from '../services/seoulData';
import MiniMap from './MiniMap';

interface TravelResult {
  label: string;
  formatted: string;
  source?: string;
  error?: boolean;
}

interface Props {
  results: PlaceRecommendation[];
  travelTimes: TravelResult[] | null;
  midpointAreaName?: string;
  courseVisible: boolean;
  courseLoading: boolean;
  courseData: CourseRecommendation | null;
  courseError: string | null;
  treasurer: string | null;
  treasurerPicked: boolean;
  onPickTreasurer: () => void;
  onToggleCourse: () => void;
  onRetry: () => void;
  onShare: () => void;
  onReserve: () => void;
}

const COURSE_LOADING_MSGS = ['맛집 찾는 중...', '2차 장소 매칭 중...', '동선 계산 중...'];

function formatTotalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `약 ${mins}분`;
  if (mins === 0) return `약 ${hours}시간`;
  return `약 ${hours}시간 ${mins}분`;
}

function kakaoMapLink(place: Pick<CoursePlace, 'placeName' | 'address' | 'lat' | 'lng'>): string {
  if (place.lat && place.lng) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(place.placeName)},${place.lat},${place.lng}`;
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(place.address || place.placeName)}`;
}

function getCurrentTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function parseOpenStatus(openingHours?: string): { label: string; isOpen: boolean } | null {
  if (!openingHours) return null;
  const match = openingHours.match(/(\d{2}):(\d{2})\s*[~\-]\s*(\d{2}):(\d{2})/);
  if (!match) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
  let closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);

  if (closeMin < openMin) closeMin += 24 * 60;

  const isOpen = nowMin >= openMin && nowMin < closeMin;
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

const rankLabel = ['🥇', '🥈', '🥉'];

export default function ResultCard({
  results,
  travelTimes,
  midpointAreaName,
  courseVisible,
  courseLoading,
  courseData,
  courseError,
  treasurer,
  treasurerPicked,
  onPickTreasurer,
  onToggleCourse,
  onRetry,
  onShare,
  onReserve,
}: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [courseMsgIdx, setCourseMsgIdx] = useState(0);

  const result = results[0];
  const extraResults = results.slice(1);
  const hasCoords = !!(result.lat && result.lng);
  const currentTime = getCurrentTimeStr();
  const openStatus = parseOpenStatus(result.openingHours);

  useEffect(() => {
    if (!courseLoading) return;
    setCourseMsgIdx(0);
    const interval = setInterval(() => {
      setCourseMsgIdx((i) => (i + 1) % COURSE_LOADING_MSGS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [courseLoading]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">

      {/* 소요시간 */}
      {midpointAreaName && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-gray-600">
              📍 {midpointAreaName} 기준
            </span>
            <span className="text-xs text-gray-400">대중교통 예상</span>
          </div>
          {travelTimes ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {travelTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-1 text-sm">
                  <span className="text-gray-500 truncate max-w-[90px]">{t.label}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-black ${t.error ? 'text-gray-400' : 'text-[#3CDBC0]'}`}>
                    {t.formatted}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
              계산 중...
            </div>
          )}
        </div>
      )}

      {/* 메인 장소 카드 (1위) */}
      <div className="result-gradient rounded-3xl p-5 text-white shadow-xl shadow-[#3CDBC0]/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black">{rankLabel[0]} 1위 추천</span>
            <span className="text-xs font-semibold opacity-80 bg-white/20 px-2.5 py-1 rounded-full">
              {result.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
            <div
              className={`w-2 h-2 rounded-full ${congestionDotClass(result.congestionLevel as CongestionLevel)}`}
            />
            <span className="text-xs font-medium">
              {currentTime} · {result.congestionLevel}
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-black mt-3 mb-1 leading-tight">
          오늘은<br /><span className="text-3xl">{result.placeName}</span>
        </h2>
        <p className="text-sm opacity-90 mb-3">{result.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {result.vibeTags.map((tag) => (
            <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>

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
                    openStatus.isOpen ? 'bg-green-400 text-white' : 'bg-red-400 text-white'
                  }`}
                >
                  {openStatus.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 추천 더보기 / 접기 */}
      {extraResults.length > 0 && (
        <>
          <button
            onClick={() => setMoreVisible(!moreVisible)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-[#3CDBC0] bg-white text-[#2AB5A0] font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[#F5FBF8]"
          >
            {moreVisible
              ? '접기 ▲'
              : `추천 더보기 (${extraResults.length}개 더) ▼`}
          </button>

          {moreVisible && (
            <div className="flex flex-col gap-3 animate-fade-in-up">
              {extraResults.map((place, idx) => (
                <div key={idx} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{rankLabel[idx + 1]}</span>
                    <span className="text-sm font-black text-gray-800">{place.placeName}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{place.category}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{place.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                    <span>💰 {place.priceRange}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${congestionDotClass(place.congestionLevel as CongestionLevel)}`} />
                      <span>{place.congestionLevel}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">📍 {place.address}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 예약하기 */}
      <button
        onClick={onReserve}
        className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] active:scale-95 transition-all"
      >
        📋 이 장소 예약하기
      </button>

      {/* 총무 뽑기 */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
        {!treasurerPicked ? (
          <button
            onClick={onPickTreasurer}
            className="w-full py-3.5 rounded-xl bg-[#F5FBF8] border-2 border-dashed border-[#3CDBC0] text-[#2AB5A0] font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[#E8F8F5]"
          >
            🎲 오늘의 총무 뽑기
          </button>
        ) : (
          <div className="text-center py-1 animate-fade-in-up">
            <p className="text-xs text-gray-400 mb-1">오늘의 총무</p>
            <p className="text-base font-black text-[#2AB5A0]">
              🎉 {treasurer}에서 출발하시는 분!
            </p>
          </div>
        )}
      </div>

      {/* 카카오톡 공유 */}
      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl bg-[#FEE500] text-[#3A1D1D] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.13 1.73 5.9 4.35 7.57V22l3.97-2.18c1.06.29 2.18.44 3.33.44 5.52 0 10-4.08 10-9.1C23.65 6.08 17.52 2 12 2z" />
        </svg>
        카카오톡으로 공유하기
      </button>

      {/* 지도로 보기 */}
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

      {/* 코스 추천 */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-sm font-bold text-gray-800">코스 추천</div>
            <div className="text-xs text-gray-400 mt-0.5">1차부터 2차까지 동선을 추천해드려요</div>
          </div>
          <button
            onClick={onToggleCourse}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
              courseVisible ? 'bg-[#3CDBC0]' : 'bg-gray-200'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                courseVisible ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {courseVisible && courseLoading && (
          <div className="border-t border-gray-100 px-4 py-6">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-[#E8F8F5]" />
                <div className="absolute inset-0 rounded-full border-2 border-t-[#3CDBC0] border-transparent animate-spin-slow" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#2AB5A0]">코스 생성 중...</p>
                <p className="text-xs text-gray-400 mt-1 animate-mint-pulse">
                  {COURSE_LOADING_MSGS[courseMsgIdx]}
                </p>
              </div>
            </div>
          </div>
        )}

        {courseVisible && !courseLoading && courseError && (
          <div className="border-t border-gray-100 px-4 py-4">
            <p className="text-xs text-red-500 text-center">{courseError}</p>
          </div>
        )}

        {courseVisible && !courseLoading && courseData && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 animate-fade-in-up">
            <div className="flex flex-col">
              {courseData.places.map((place, idx) => (
                <div key={idx}>
                  {idx > 0 && (
                    <div className="flex items-center gap-3 my-2 ml-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-px h-2 bg-[#3CDBC0]/50" />
                        <span className="text-[#3CDBC0] text-base leading-none">↓</span>
                        <div className="w-px h-2 bg-[#3CDBC0]/50" />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        도보 {place.walkingMinutes}분
                      </span>
                    </div>
                  )}

                  <div className="bg-[#F5FBF8] rounded-2xl p-3.5 border border-[#E0F5F0]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-full text-white ${
                          idx === 0 ? 'bg-[#3CDBC0]' : 'bg-[#2AB5A0]'
                        }`}
                      >
                        {idx + 1}차
                      </span>
                      <span className="text-sm font-black text-gray-800">{place.placeName}</span>
                    </div>

                    <div className="mb-2">
                      <span className="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-200">
                        {place.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {place.vibeTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-[#2AB5A0] bg-white px-2 py-0.5 rounded-full border border-[#C8F0E8]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-gray-500 mb-2">{place.description}</p>

                    <div className="flex items-start gap-1 text-xs text-gray-400 mb-3">
                      <span className="shrink-0">📍</span>
                      <span>{place.address}</span>
                    </div>

                    <a
                      href={kakaoMapLink(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[#FEE500] text-[#3A1D1D] text-xs font-bold active:scale-95 transition-transform"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.13 1.73 5.9 4.35 7.57V22l3.97-2.18c1.06.29 2.18.44 3.33.44 5.52 0 10-4.08 10-9.1C23.65 6.08 17.52 2 12 2z" />
                      </svg>
                      카카오맵 길찾기
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 py-2.5 bg-[#E8F8F5] rounded-xl">
              <span className="text-xs text-gray-500">총 소요 시간</span>
              <span className="text-sm font-black text-[#2AB5A0]">
                {formatTotalTime(courseData.totalMinutes)}
              </span>
            </div>
          </div>
        )}
      </div>

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
