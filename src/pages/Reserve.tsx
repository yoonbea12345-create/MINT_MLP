import { useState } from 'react';

export interface ReservationRecord {
  id: string;
  placeName: string;
  address: string;
  openingHours: string;
  guestName: string;
  arrivalTime: string;
  createdAt: string;
}

function saveReservation(record: ReservationRecord) {
  const existing: ReservationRecord[] = JSON.parse(
    localStorage.getItem('mint_reservations') ?? '[]'
  );
  existing.unshift(record);
  localStorage.setItem('mint_reservations', JSON.stringify(existing));
}

interface Props {
  placeName: string;
  address: string;
  openingHours: string;
  onBack: () => void;
}

export default function Reserve({ placeName, address, openingHours, onBack }: Props) {
  const [guestName, setGuestName] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!arrivalTime) { setError('도착 예정 시간을 선택해주세요.'); return; }

    const record: ReservationRecord = {
      id: Date.now().toString(),
      placeName,
      address,
      openingHours,
      guestName: guestName.trim(),
      arrivalTime,
      createdAt: new Date().toISOString(),
    };
    saveReservation(record);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-in-up flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-[#E8F8F5] flex items-center justify-center text-4xl">
            ✅
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#2AB5A0] mb-2">예약 요청 완료!</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              예약 요청이 전달되었습니다.<br />
              <span className="font-bold text-gray-700">{placeName}</span>에서 만나요!
            </p>
          </div>
          <div className="w-full max-w-xs bg-white rounded-2xl border-2 border-gray-100 p-4 text-left flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">장소</span>
              <span className="font-bold text-gray-800">{placeName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">예약자</span>
              <span className="font-bold text-gray-800">{guestName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">도착 예정</span>
              <span className="font-bold text-gray-800">{arrivalTime}</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-full max-w-xs py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base hover:bg-[#2AB5A0] transition-colors"
          >
            결과로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-6 pb-16">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#3CDBC0] transition-colors"
          >
            ←
          </button>
          <h1 className="text-lg font-black text-gray-800">예약 요청하기</h1>
        </div>

        {/* 장소 정보 */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">예약 장소</span>
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-1">{placeName}</h2>
          <div className="flex flex-col gap-1 text-sm text-gray-500">
            {address && (
              <div className="flex items-start gap-1.5">
                <span>📍</span>
                <span>{address}</span>
              </div>
            )}
            {openingHours && (
              <div className="flex items-center gap-1.5">
                <span>🕐</span>
                <span>{openingHours}</span>
              </div>
            )}
          </div>
        </div>

        {/* 예약 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-in-up">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              이름 <span className="text-[#3CDBC0]">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setError(''); }}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-[#3CDBC0] outline-none text-sm bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              도착 예정 시간 <span className="text-[#3CDBC0]">*</span>
            </label>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => { setArrivalTime(e.target.value); setError(''); }}
              className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-[#3CDBC0] outline-none text-sm bg-white transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] active:scale-95 transition-all mt-2"
          >
            예약 요청하기
          </button>
        </form>
      </div>
    </div>
  );
}
