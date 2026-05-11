import { useState } from 'react';
import type { PlaceRecommendation } from '../services/ai';
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
  treasurer: string | null;
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
  const match = openingHours.match(/(\d{2}):(\d{2})\s*[~\-]\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
  let closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);
  if (closeMin < openMin) closeMin += 24 * 60;
  const isOpen = nowMin >= openMin && nowMin < closeMin;
  return { label: isOpen ? '영업중' : nowMin < openMin ? '영업 전' : '영업 종료', isOpen };
}

function congestionTextColor(level: string): string {
  if (!level) return 'text-white/70';
  if (level.includes('여유') || level.includes('원활')) return 'text-green-300';
  if (level.includes('보통')) return 'text-yellow-300';
  return 'text-red-300';
}

interface CardProps {
  place: PlaceRecommendation;
  timeStr: string;
  compact?: boolean;
  extraResults?: PlaceRecommendation[];
}

function PlaceCard({ place, timeStr, compact = false, extraResults = [] }: CardProps) {
  const [moreVisible, setMoreVisible] = useState(false);
  const openStatus = parseOpenStatus(place.openingHours);
  const hasCoords = !!(place.lat && place.lng);

  return (
    <div className="rounded-2xl text-white shadow-xl shadow-[#3CDBC0]/25 overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #3CDBC0 0%, #2AB5A0 100%)' }}>
      <div className={compact ? 'py-3 px-4' : 'py-4 px-4'}>
        {/* 혼잡도 우상단 */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
            <div className={`w-2 h-2 rounded-full ${congestionDotClass(place.congestionLevel as CongestionLevel)}`} />
            <span className={`text-xs font-medium ${congestionTextColor(place.congestionLevel)}`}>
              🕐 {timeStr} 기준 혼잡도: {place.congestionLevel}
            </span>
          </div>
        </div>

        {/* 카테고리 */}
        <div className="mb-2">
          <span className="text-xs font-black bg-white/30 text-white px-3 py-0.5 rounded-full border border-white/30">
            {place.category}
          </span>
        </div>

        {/* 장소명 */}
        <h2 className={`font-black leading-tight mb-1 ${compact ? 'text-xl' : 'text-2xl'}`}>
          {place.placeName}
        </h2>

        {/* 해시태그 */}
        <div className="flex flex-wrap gap-1 mb-2">
          {place.vibeTags.slice(0, compact ? 2 : 4).map((tag) => (
            <span key={tag} className="text-xs text-white/80 bg-white/15 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        {!compact && (
          <p className="text-sm text-white/90 mb-3 leading-relaxed">{place.description}</p>
        )}

        {/* 핵심 정보 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-1.5 text-sm text-white/80">
            <span className="shrink-0">📍</span>
            <span className="leading-tight">{place.address || place.area}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-white/80">
            <span>💰</span>
            <span>{place.priceRange}</span>
          </div>
          {place.openingHours && (
            <div className="flex items-center gap-1.5 text-sm text-white/80">
              <span>🕐</span>
              <span>{place.openingHours}</span>
              {openStatus && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  openStatus.isOpen ? 'bg-green-400 text-white' : 'bg-red-400/80 text-white'
                }`}>
                  {openStatus.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 더보기 버튼 */}
        {!compact && extraResults.length > 0 && (
          <button
            onClick={() => setMoreVisible(!moreVisible)}
            className="w-full mt-3 text-white/70 text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            {moreVisible ? '접기 ▲' : `추천 더보기 (${extraResults.length}개 더) ▼`}
          </button>
        )}
      </div>

      {/* 더보기 펼침 */}
      {!compact && moreVisible && extraResults.length > 0 && (
        <div className="border-t border-white/20 px-4 pb-3 pt-3 flex flex-col gap-2 animate-fade-in-up">
          {extraResults.map((p, idx) => (
            <div key={idx} className="bg-white/15 rounded-xl p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-sm font-black">{p.placeName}</p>
                  <p className="text-xs text-white/70">{p.category}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${congestionDotClass(p.congestionLevel as CongestionLevel)}`} />
                  <span className="text-xs text-white/60">{p.congestionLevel}</span>
                </div>
              </div>
              <p className="text-xs text-white/70 mb-1.5 leading-relaxed">{p.description}</p>
              <div className="flex items-center gap-3 text-xs text-white/60">
                <span>💰 {p.priceRange}</span>
                {p.address && <span className="truncate flex-1">📍 {p.address}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 카카오맵 링크 (compact 2차 카드용) */}
      {compact && (
        <a
          href={hasCoords
            ? `https://map.kakao.com/link/to/${encodeURIComponent(place.placeName)},${place.lat},${place.lng}`
            : `https://map.kakao.com/link/search/${encodeURIComponent(place.placeName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 mb-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/20 text-white text-xs font-bold active:scale-95 transition-transform"
        >
          📍 카카오맵에서 보기
        </a>
      )}
    </div>
  );
}

export default function ResultCard({
  results,
  travelTimes,
  midpointAreaName,
  purpose,
  treasurer,
  onRetry,
  onShare,
  onReserve,
}: Props) {
  const hasSecond = !!(purpose?.second && purpose.second !== '없음');
  const result = results[0];
  const secondResult = hasSecond ? results[1] : null;
  const extraResults = hasSecond ? results.slice(2) : results.slice(1);
  const hasCoords = !!(result.lat && result.lng);
  const currentTime = getCurrentTimeStr();
  const nearbySpots = result.nearbySpots ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">

      {/* 상단 요약 바 */}
      {midpointAreaName && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-black text-gray-700">📍 {midpointAreaName} 기준</span>
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
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {travelTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="text-gray-500 truncate max-w-[80px]">{t.label}</span>
                  <span className="text-gray-400">→ 약</span>
                  <span className={`font-black ${t.error ? 'text-gray-400' : 'text-[#3CDBC0]'}`}>
                    {t.formatted}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1차 라벨 */}
      {hasSecond && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-black bg-[#3CDBC0] text-white px-3 py-1 rounded-full">
            1차 추천 {purpose!.first}
          </span>
        </div>
      )}

      {/* 1차 카드 */}
      <PlaceCard
        place={result}
        timeStr={currentTime}
        extraResults={extraResults}
      />

      {/* 1차→2차 이동 표시 */}
      {hasSecond && secondResult && (
        <div className="flex items-center justify-center gap-1.5 py-0.5">
          <span className="text-gray-300 text-sm">↓</span>
          <span className="text-xs text-gray-400 font-medium">이동</span>
          <span className="text-gray-300 text-sm">↓</span>
        </div>
      )}

      {/* 2차 라벨 + 카드 */}
      {hasSecond && secondResult && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black bg-[#F5A623] text-white px-3 py-1 rounded-full">
              2차 추천 {purpose!.second}
            </span>
          </div>
          <div className="rounded-2xl text-white shadow-xl shadow-[#F5A623]/20 overflow-hidden"
               style={{ background: 'linear-gradient(135deg, #F5A623 0%, #D4861A 100%)' }}>
            <div className="py-3 px-4">
              <div className="flex justify-end mb-2">
                <div className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${congestionDotClass(secondResult.congestionLevel as CongestionLevel)}`} />
                  <span className="text-xs font-medium text-white/80">
                    🕐 {currentTime} 기준 혼잡도: {secondResult.congestionLevel}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-xs font-black bg-white/30 text-white px-3 py-0.5 rounded-full border border-white/30">
                  {secondResult.category}
                </span>
              </div>
              <h2 className="text-xl font-black leading-tight mb-1">{secondResult.placeName}</h2>
              <div className="flex flex-wrap gap-1 mb-2">
                {secondResult.vibeTags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs text-white/80 bg-white/15 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-start gap-1.5 text-sm text-white/80">
                  <span className="shrink-0">📍</span>
                  <span className="leading-tight">{secondResult.address || secondResult.area}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-white/80">
                  <span>💰</span><span>{secondResult.priceRange}</span>
                </div>
                {secondResult.openingHours && (
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <span>🕐</span><span>{secondResult.openingHours}</span>
                    {(() => {
                      const s = parseOpenStatus(secondResult.openingHours);
                      return s ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.isOpen ? 'bg-green-400 text-white' : 'bg-red-400/80 text-white'}`}>
                          {s.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
            <a
              href={secondResult.lat && secondResult.lng
                ? `https://map.kakao.com/link/to/${encodeURIComponent(secondResult.placeName)},${secondResult.lat},${secondResult.lng}`
                : `https://map.kakao.com/link/search/${encodeURIComponent(secondResult.placeName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-4 mb-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/20 text-white text-xs font-bold active:scale-95 transition-transform"
            >
              📍 카카오맵에서 보기
            </a>
          </div>
        </div>
      )}

      {/* 예약하기 */}
      <button
        onClick={onReserve}
        className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] active:scale-95 transition-all"
      >
        📋 이 장소 예약하기
      </button>

      {/* 카카오톡 공유 */}
      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl bg-[#FEE500] text-gray-900 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.13 1.73 5.9 4.35 7.57V22l3.97-2.18c1.06.29 2.18.44 3.33.44 5.52 0 10-4.08 10-9.1C23.65 6.08 17.52 2 12 2z" />
        </svg>
        💬 카카오톡으로 공유하기
      </button>

      {/* 카카오맵으로 보기 */}
      <a
        href={hasCoords
          ? `https://map.kakao.com/link/to/${encodeURIComponent(result.placeName)},${result.lat},${result.lng}`
          : `https://map.kakao.com/link/search/${encodeURIComponent(result.placeName)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-base flex items-center justify-center gap-2 hover:border-gray-300 active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
        📍 카카오맵으로 보기
      </a>

      {/* 오늘의 총무 */}
      {treasurer && (
        <div className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🎲</span>
          <p className="text-sm font-black text-amber-800">
            {midpointAreaName ?? treasurer}에서 계산은 늦게 온 사람이 내기!
          </p>
        </div>
      )}

      {/* 근처 스팟 */}
      {nearbySpots.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-2">📍 근처 구경할 곳</p>
          <div className="flex flex-wrap gap-2">
            {nearbySpots.slice(0, 2).map((spot, i) => (
              <span
                key={i}
                className="text-xs text-[#2AB5A0] bg-[#E8F8F5] px-3 py-1.5 rounded-full font-medium"
              >
                {spot}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 다시 뽑기 */}
      <button
        onClick={onRetry}
        className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all active:scale-95"
      >
        🔄 다시 뽑기
      </button>

      <div className="pb-4" />
    </div>
  );
}
