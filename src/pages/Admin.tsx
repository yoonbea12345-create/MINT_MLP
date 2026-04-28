import { useState } from 'react';
import type { ReservationRecord } from './Reserve';
import { getAnalytics, getConversionRate } from '../utils/analytics';

function loadReservations(): ReservationRecord[] {
  try {
    return JSON.parse(localStorage.getItem('mint_reservations') ?? '[]');
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export default function Admin() {
  const [records, setRecords] = useState<ReservationRecord[]>(loadReservations);
  const analytics = getAnalytics();
  const conversionRate = getConversionRate();

  function handleDelete(id: string) {
    const updated = records.filter((r) => r.id !== id);
    localStorage.setItem('mint_reservations', JSON.stringify(updated));
    setRecords(updated);
  }

  function handleClear() {
    if (!confirm('전체 예약 내역을 삭제할까요?')) return;
    localStorage.removeItem('mint_reservations');
    setRecords([]);
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#2AB5A0]">MINT 어드민</h1>
            <p className="text-sm text-gray-400">예약 요청 내역</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#E8F8F5] text-[#2AB5A0] font-bold px-2.5 py-1 rounded-full">
              총 {records.length}건
            </span>
            {records.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-red-400 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-50 transition-colors"
              >
                전체 삭제
              </button>
            )}
          </div>
        </div>

        {/* ── 전환율 대시보드 ── */}
        <div className="mb-8">
          <h2 className="text-sm font-black text-gray-600 mb-3">📊 전환율 현황</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">랜딩 조회</div>
              <div className="text-3xl font-black text-[#36CFA0]">{analytics.landingViews}</div>
              <div className="text-xs text-gray-300 mt-1">회</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">CTA 클릭</div>
              <div className="text-3xl font-black text-[#36CFA0]">{analytics.ctaClicks}</div>
              <div className="text-xs text-gray-300 mt-1">회</div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-[#36CFA0] bg-teal-50 p-4 shadow-sm">
              <div className="text-xs text-[#36CFA0] font-bold mb-1">전환율</div>
              <div className="text-3xl font-black text-[#36CFA0]">{conversionRate}%</div>
              <div className="text-xs text-teal-300 mt-1">랜딩 → MVP</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">예약 시도</div>
              <div className="text-3xl font-black text-[#36CFA0]">{analytics.reservationAttempts}</div>
              <div className="text-xs text-gray-300 mt-1">건</div>
            </div>
          </div>
        </div>

        {/* ── 예약 목록 ── */}
        {records.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400">아직 예약 요청이 없어요.</p>
            <a href="/app" className="inline-block mt-4 text-sm text-[#3CDBC0] underline">
              MINT로 장소 추천받기 →
            </a>
          </div>
        ) : (
          <>
            {/* 모바일: 카드형 */}
            <div className="flex flex-col gap-3 md:hidden">
              {records.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-black text-gray-800">{r.placeName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.address}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">예약자</span>
                      <span className="font-bold text-gray-700">{r.guestName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">인원</span>
                      <span className="font-bold text-gray-700">{r.people}명</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">요청: {formatDate(r.createdAt)}</div>
                </div>
              ))}
            </div>

            {/* 데스크탑: 테이블형 */}
            <div className="hidden md:block bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E8F8F5] text-left">
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">장소명</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">주소</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">예약자</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">인원</th>
                    <th className="px-4 py-3 font-bold text-[#2AB5A0]">요청시간</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 font-bold text-gray-800">{r.placeName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{r.address}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{r.guestName}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#E8F8F5] text-[#2AB5A0] font-bold px-2 py-0.5 rounded-full text-xs">
                          {r.people}명
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
