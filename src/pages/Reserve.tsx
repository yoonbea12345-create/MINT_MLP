import { useState } from 'react';
import { trackEvent } from '../utils/analytics';

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

    // 수요 기록 (서버 경유 — admin에서 확인용)
    fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeName,
        address,
        guestName: name.trim(),
        people: people.trim(),
      }),
    }).catch(() => {});

    // 트래킹
    trackEvent('reservation_attempt');

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
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-4 -mt-1">
          <span className="text-xs font-bold text-[#36CFA0] bg-teal-50 px-2 py-0.5 rounded-full">예약 장소</span>
          <div className="mt-2 font-black text-gray-800 text-lg">{placeName}</div>
          {address && <div className="text-sm text-gray-400 mt-1">📍 {address}</div>}
          {openingHours && <div className="text-sm text-gray-400 mt-0.5">🕐 {openingHours}</div>}
        </div>

        {/* 바로 예약 — 예약 플랫폼 딥링크 (입점 매장이면 그 자리에서 예약 완료) */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-4">
          <p className="text-sm font-black text-gray-800 mb-1">⚡ 바로 예약해보기</p>
          <p className="text-[11px] text-gray-400 mb-3">예약 앱에 입점한 매장이면 바로 예약할 수 있어요</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://app.catchtable.co.kr/ct/search?keyword=${encodeURIComponent(placeName)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent('reserve_deeplink_catchtable')}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#FF3D00]/5 border-2 border-[#FF3D00]/20 text-[#E63600] text-sm font-black active:scale-95 transition-all hover:border-[#FF3D00]/40"
            >
              🍽️ 캐치테이블
            </a>
            <a
              href={`https://map.naver.com/p/search/${encodeURIComponent(placeName)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent('reserve_deeplink_naver')}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#03C75A]/5 border-2 border-[#03C75A]/25 text-[#02A64B] text-sm font-black active:scale-95 transition-all hover:border-[#03C75A]/45"
            >
              N 네이버 예약
            </a>
          </div>
        </div>

        {/* 정직한 안내 — MINT 자체 예약 연동은 준비 중, 수요 조사 단계 */}
        <div className="bg-[#E8F8F5] border border-[#3CDBC0]/30 rounded-2xl px-4 py-3 mb-4">
          <p className="text-xs text-[#2AB5A0] leading-relaxed">
            🌱 MINT 안에서 끝나는 예약을 준비 중이에요. 아래 요청을 남겨주시면 연동 우선순위에 반영됩니다.
          </p>
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
              예약 요청 남기기
            </button>
          </>
        ) : (
          /* 접수 완료 — 연동 전이라 직접 예약 안내 */
          <div className="bg-white border-2 border-[#3CDBC0]/30 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🙏</div>
            <div className="text-lg font-black text-gray-800 mb-2">요청이 접수됐어요!</div>
            <div className="text-sm text-gray-500 leading-relaxed">
              아직 MINT 자체 예약 연동은 준비 중이에요.<br />
              위의 <strong className="text-gray-700">⚡ 바로 예약해보기</strong> 버튼이나<br />
              카카오맵에서 직접 예약해주세요.
            </div>
            <a
              href={`https://map.kakao.com/link/search/${encodeURIComponent(placeName)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-5 px-6 py-3 bg-[#FEE500] text-gray-900 font-black text-sm rounded-2xl active:scale-95 transition-transform"
            >
              카카오맵에서 확인하기
            </a>
            <button
              onClick={onBack}
              className="block mx-auto mt-4 text-sm text-gray-400 underline"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
