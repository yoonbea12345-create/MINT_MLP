import { useState } from 'react';
import { loadHistory, openHistoryEntry, type HistoryEntry } from '../../utils/history';

// 홈 탭 — 추천 플로우로 들어가는 유일한 입구.
export default function HomeTab({ onStartFlow }: { onStartFlow: () => void }) {
  const [history] = useState<HistoryEntry[]>(() => loadHistory());

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* 히어로 */}
      <div className="rounded-3xl bg-gradient-to-br from-[#3CDBC0] to-[#2AB5A0] px-6 py-8 text-white shadow-lg shadow-[#3CDBC0]/25">
        <p className="text-xs font-bold tracking-widest opacity-90">MINT · Meet in one tap</p>
        <h1 className="mt-2 text-[26px] font-black leading-snug break-keep">
          어디서 만날지,<br />이제 고민하지 마세요
        </h1>
        <p className="mt-2 text-sm leading-relaxed opacity-90 break-keep">
          출발지와 취향만 알려주시면 오늘의 1차·2차 코스를 MINT가 대신 골라드려요.
        </p>
      </div>

      {/* 메인 CTA */}
      <button
        onClick={onStartFlow}
        className="mt-4 w-full rounded-2xl bg-[#3CDBC0] py-4 text-base font-black text-white shadow-lg shadow-[#3CDBC0]/30 active:scale-95 transition-transform"
      >
        ✨ 장소 추천받기
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-400">혼자도, 여럿이서도 30초면 끝나요</p>

      {/* 사용 흐름 안내 */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          { icon: '📍', label: '출발지 입력' },
          { icon: '🎯', label: '취향 선택' },
          { icon: '🍽️', label: '코스 완성' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center">
            <p className="text-xl leading-none">{s.icon}</p>
            <p className="mt-1.5 text-[11px] font-bold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 지난 추천 — 스냅샷 복원 */}
      {history.length > 0 && (
        <div className="mt-7">
          <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">지난 추천</p>
          <div className="flex flex-col gap-2">
            {history.slice(0, 3).map((h) => (
              <button
                key={h.savedAt}
                onClick={() => openHistoryEntry(h)}
                className="w-full text-left rounded-2xl border border-gray-100 bg-white px-4 py-3 active:scale-[0.99] transition-transform"
              >
                <p className="text-sm font-black text-gray-800 truncate">
                  {h.placeName}{h.secondPlaceName ? ` → ${h.secondPlaceName}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-gray-400 truncate">
                  {h.areaName ? `${h.areaName} · ` : ''}
                  {new Date(h.savedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
