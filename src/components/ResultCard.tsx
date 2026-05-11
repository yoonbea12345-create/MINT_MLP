import { useState, useEffect } from 'react';
import type { PlaceRecommendation, CourseRecommendation, CoursePlace } from '../services/ai';
import { congestionDotClass } from '../services/seoulData';
import type { CongestionLevel } from '../services/seoulData';

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
  purpose?: { first: string; second: string | null };
  courseVisible: boolean;
  courseLoading: boolean;
  courseData: CourseRecommendation | null;
  courseError: string | null;
  treasurer: string | null;
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
  return {
    label: isOpen ? '영업중' : nowMin < openMin ? '영업 전' : '영업 종료',
    isOpen,
  };
}

const rankLabel = ['🥇', '🥈', '🥉'];

export default function ResultCard({
  results,
  travelTimes,
  midpointAreaName,
  purpose,
  courseVisible,
  courseLoading,
  courseData,
  courseError,
  treasurer,
  onToggleCourse,
  onRetry,
  onShare,
  onReserve,
}: Props) {
  const [moreVisible, setMoreVisible] = useState(false);
  const [courseMsgIdx, setCourseMsgIdx] = useState(0);

  const hasSecond = !!(purpose?.second && purpose.second !== '없음');
  const result = results[0];
  const secondResult = hasSecond ? results[1] : null;
  const extraResults = hasSecond ? results.slice(2) : results.slice(1);
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
            <span className="text-xs font-black text-gray-600">📍 {midpointAreaName} 기준</span>
            <span className="text-xs text-gray-400">대중교통 예상</span>
          </div>
          {travelTimes === null ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
              계산 중...
            </div>
          ) : travelTimes.length === 0 ? (
            <p className="text-xs text-gray-400">소요시간을 가져올 수 없어요</p>
          ) : (
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
          )}
        </div>
      )}

      {/* 1차 라벨 (2차가 있을 때만) */}
      {hasSecond && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-black bg-[#3CDBC0] text-white px-3 py-1 rounded-full">1차 추천</span>
          <span className="text-sm font-bold text-gray-600">{purpose!.first}</span>
        </div>
      )}

      {/* 메인 장소 카드 */}
      <div className="result-gradient rounded-3xl p-5 text-white shadow-xl shadow-[#3CDBC0]/30">
        {/* 혼잡도 - 우측 상단 */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
            <div className={`w-2 h-2 rounded-full ${congestionDotClass(result.congestionLevel as CongestionLevel)}`} />
            <span className="text-xs font-medium">{currentTime} 기준 혼잡도: {result.congestionLevel}</span>
          </div>
        </div>

        {/* 카테고리 배지 - 장소명 위 강조 */}
        <div className="mb-2">
          <span className="text-sm font-black bg-white/40 text-white px-3.5 py-1 rounded-full border border-white/40 tracking-tight">
            {result.category}
          </span>
        </div>

        {/* 장소명 */}
        <h2 className="text-3xl font-black mb-1 leading-tight">{result.placeName}</h2>

        {/* 바이브 태그 */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {result.vibeTags.map((tag) => (
            <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>

        <p className="text-sm opacity-90 mb-4">{result.description}</p>

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
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  openStatus.isOpen ? 'bg-green-400 text-white' : 'bg-red-400 text-white'
                }`}>
                  {openStatus.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 더보기 - 카드 내부 하단 중앙 */}
        {extraResults.length > 0 && (
          <button
            onClick={() => setMoreVisible(!moreVisible)}
            className="w-full mt-4 text-white/80 text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            {moreVisible ? '접기 ▲' : `추천 더보기 (${extraResults.length}개 더) ▼`}
          </button>
        )}
      </div>

      {/* 2차 추천 카드 */}
      {hasSecond && secondResult && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black bg-[#2AB5A0] text-white px-3 py-1 rounded-full">2차 추천</span>
            <span className="text-sm font-bold text-gray-600">{purpose!.second}</span>
          </div>
          <div className="result-gradient rounded-3xl p-5 text-white shadow-xl shadow-[#3CDBC0]/30" style={{ background: 'linear-gradient(135deg, #2AB5A0 0%, #1A9080 100%)' }}>
            <div className="flex justify-end mb-2">
              <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
                <div className={`w-2 h-2 rounded-full ${congestionDotClass(secondResult.congestionLevel as CongestionLevel)}`} />
                <span className="text-xs font-medium">{currentTime} 기준 혼잡도: {secondResult.congestionLevel}</span>
              </div>
            </div>
            <div className="mb-2">
              <span className="text-sm font-black bg-white/40 text-white px-3.5 py-1 rounded-full border border-white/40">
                {secondResult.category}
              </span>
            </div>
            <h2 className="text-2xl font-black mb-1 leading-tight">{secondResult.placeName}</h2>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {secondResult.vibeTags.map((tag) => (
                <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">#{tag}</span>
              ))}
            </div>
            <p className="text-sm opacity-90 mb-3">{secondResult.description}</p>
            <div className="bg-white/15 rounded-2xl p-3 flex flex-col gap-1.5">
              <div className="flex items-start gap-2 text-sm">
                <span className="opacity-70 shrink-0">📍</span>
                <span className="opacity-90">{secondResult.address || secondResult.area}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-70">💰</span>
                <span className="opacity-90">{secondResult.priceRange}</span>
              </div>
              {secondResult.openingHours && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="opacity-70">🕐</span>
                  <span className="opacity-90">{secondResult.openingHours}</span>
                  {(() => {
                    const s = parseOpenStatus(secondResult.openingHours);
                    return s ? (
                      <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.isOpen ? 'bg-green-400 text-white' : 'bg-red-400 text-white'}`}>
                        {s.label}
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 추가 추천 장소 (더보기 펼침) */}
      {moreVisible && extraResults.length > 0 && (
        <div className="flex flex-col gap-3 animate-fade-in-up">
          {extraResults.map((place, idx) => (
            <div key={idx} className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{rankLabel[idx + 1]}</span>
                  <div>
                    <p className="text-sm font-black text-gray-800">{place.placeName}</p>
                    <p className="text-xs font-bold text-[#2AB5A0]">{place.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${congestionDotClass(place.congestionLevel as CongestionLevel)}`} />
                  <span className="text-xs text-gray-400">{place.congestionLevel}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">{place.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {place.vibeTags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>💰 {place.priceRange}</span>
                <span className="truncate flex-1">📍 {place.address}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 이 장소 예약하기 */}
      <button
        onClick={onReserve}
        className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] active:scale-95 transition-all"
      >
        📋 이 장소 예약하기
      </button>

      {/* 카카오톡으로 공유하기 */}
      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl bg-[#FEE500] text-[#3A1D1D] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.13 1.73 5.9 4.35 7.57V22l3.97-2.18c1.06.29 2.18.44 3.33.44 5.52 0 10-4.08 10-9.1C23.65 6.08 17.52 2 12 2z" />
        </svg>
        카카오톡으로 공유하기
      </button>

      {/* 카카오맵으로 보기 */}
      <a
        href={hasCoords
          ? `https://map.kakao.com/link/to/${encodeURIComponent(result.placeName)},${result.lat},${result.lng}`
          : `https://map.kakao.com/link/search/${encodeURIComponent(result.placeName)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-black text-base flex items-center justify-center gap-2 hover:border-gray-300 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
        카카오맵으로 보기
      </a>

      {/* 오늘의 총무 */}
      {treasurer && (
        <div className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 flex items-center gap-4">
          <span className="text-3xl flex-shrink-0">🎲</span>
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">오늘의 총무</p>
            <p className="text-sm font-black text-amber-800">오늘은 {treasurer}에서 오신 분이 총 계산을 맡아주세요</p>
          </div>
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
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
              courseVisible ? 'left-6' : 'left-0.5'
            }`} />
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
                <p className="text-xs text-gray-400 mt-1 animate-mint-pulse">{COURSE_LOADING_MSGS[courseMsgIdx]}</p>
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
                      <span className="text-xs text-gray-400 font-medium">도보 {place.walkingMinutes}분</span>
                    </div>
                  )}
                  <div className="bg-[#F5FBF8] rounded-2xl p-3.5 border border-[#E0F5F0]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full text-white ${idx === 0 ? 'bg-[#3CDBC0]' : 'bg-[#2AB5A0]'}`}>
                        {idx + 1}차
                      </span>
                      <span className="text-sm font-black text-gray-800">{place.placeName}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-200">{place.category}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {place.vibeTags.map((tag) => (
                        <span key={tag} className="text-xs text-[#2AB5A0] bg-white px-2 py-0.5 rounded-full border border-[#C8F0E8]">
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
              <span className="text-sm font-black text-[#2AB5A0]">{formatTotalTime(courseData.totalMinutes)}</span>
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

      <div className="pb-4" />

    </div>
  );
}
