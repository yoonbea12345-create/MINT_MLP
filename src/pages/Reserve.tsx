import { useState } from 'react';
import { trackEvent } from '../utils/analytics';
import { supabase } from '../utils/supabase';

export interface ReservationRecord {
  id: string;
  placeName: string;
  address: string;
  guestName: string;
  people: string;
  arrivalTime: string;
  createdAt: string;
}

interface Props {
  placeName: string;
  address: string;
  openingHours: string;
  onBack: () => void;
}

type Status = 'form' | 'unavailable';

export default function Reserve({ placeName, address, openingHours, onBack }: Props) {
  const [name, setName] = useState('');
  const [people, setPeople] = useState('');
  const [status, setStatus] = useState<Status>('form');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!name.trim() || !people.trim()) {
      setError('이름과 인원수를 입력해주세요.');
      return;
    }

    // 데이터 저장 (admin에서 확인용)
    const record: ReservationRecord = {
      id: Date.now().toString(),
      placeName,
      address,
      guestName: name.trim(),
      people: people.trim(),
      arrivalTime: '-',
      createdAt: new Date().toISOString(),
    };
    supabase.from('reservations').insert({
      id: record.id,
      place_name: record.placeName,
      address: record.address,
      guest_name: record.guestName,
      people: record.people,
      arrival_time: record.arrivalTime,
      created_at: record.createdAt,
    }).then(() => {});

    // 트래킹
    trackEvent('reservation_attempt');

    // 사용자에게는 예약 불가 메시지
    setStatus('unavailable');
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-6 pb-16">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl border-2 border-gray-200 bg-white flex items-center justify-center text-gray-500 font-bold"
          >
            ←
          </button>
          <h1 className="text-lg font-black text-gray-800">예약 요청하기</h1>
        </div>

        {/* 장소 정보 */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-6">
          <span className="text-xs font-bold text-[#36CFA0] bg-teal-50 px-2 py-0.5 rounded-full">예약 장소</span>
          <div className="mt-2 font-black text-gray-800 text-lg">{placeName}</div>
          {address && <div className="text-sm text-gray-400 mt-1">📍 {address}</div>}
          {openingHours && <div className="text-sm text-gray-400 mt-0.5">🕐 {openingHours}</div>}
        </div>

        {status === 'form' ? (
          <>
            {/* 이름 */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#36CFA0] transition-colors"
              />
            </div>

            {/* 인원수 */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                인원수 <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                placeholder="3"
                min={1}
                value={people}
                onChange={(e) => { setPeople(e.target.value); setError(''); }}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#36CFA0] transition-colors"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-500 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full bg-[#36CFA0] text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-teal-200 active:scale-95 transition-all hover:bg-[#2AB58C]"
            >
              예약 확인하기
            </button>
          </>
        ) : (
          /* 예약 불가 메시지 */
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">😔</div>
            <div className="text-lg font-black text-red-600 mb-2">죄송합니다.</div>
            <div className="text-sm text-red-400 leading-relaxed">
              현재 예약이 불가능한 매장입니다.
            </div>
            <button
              onClick={onBack}
              className="mt-6 text-sm text-gray-400 underline"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
