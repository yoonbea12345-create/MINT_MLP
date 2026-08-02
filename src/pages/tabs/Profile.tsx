import { useState } from 'react';
import { getBalance, getLedger, getDeviceId } from '../../utils/points';
import { loadHistory, openHistoryEntry, type HistoryEntry } from '../../utils/history';

const CONTACT_MAIL = 'mailto:issuebell@naver.com?subject=MINT%20%EB%AC%B8%EC%9D%98';

// 프로필 탭 — 적립 이력은 실제 데이터(getLedger), 설정은 대부분 목업.
export default function Profile() {
  const [balance] = useState(() => getBalance());
  const [ledger] = useState(() => getLedger());
  const [deviceId] = useState(() => getDeviceId());
  const [history] = useState<HistoryEntry[]>(() => loadHistory());
  const [pushOn, setPushOn] = useState(true);
  const [marketingOn, setMarketingOn] = useState(false);

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-black text-gray-900">👤 프로필</h1>

      {/* 요약 */}
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F8F5] text-2xl">🌿</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-800">MINT 이용자님</p>
            <p className="text-xs text-gray-400">방문 인증 {ledger.length}회 · 적립 {balance.toLocaleString()}P</p>
          </div>
        </div>
        <p className="mt-3 truncate text-[10px] text-gray-300">기기 ID · {deviceId}</p>
      </div>

      {/* 지난 추천 — 스냅샷 복원 */}
      {history.length > 0 && (
        <>
          <p className="mt-6 px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">지난 추천</p>
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
        </>
      )}

      {/* 적립 이력 */}
      <p className="mt-6 px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">적립 내역</p>
      {ledger.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center">
          <p className="text-sm leading-relaxed text-gray-500">
            아직 적립 내역이 없어요.<br />추천받은 곳에 방문하고 인증하면 포인트가 쌓여요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ledger.map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-800">{e.place_name || '방문 인증'}</p>
                <p className="text-[11px] text-gray-400">
                  {new Date(e.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  {e.method === 'gps' ? ' · 위치 인증' : ' · 사진 인증'}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black text-[#2AB5A0]">+{e.points}P</span>
            </div>
          ))}
        </div>
      )}

      {/* 설정 */}
      <p className="mt-6 px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">설정</p>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <ToggleRow label="모임 알림" desc="약속 확정·응답 알림을 받아요" on={pushOn} onToggle={() => setPushOn((v) => !v)} />
        <div className="h-px bg-gray-100" />
        <ToggleRow label="혜택·소식 알림" desc="새 원석과 쿠폰 소식을 받아요" on={marketingOn} onToggle={() => setMarketingOn((v) => !v)} />
        <div className="h-px bg-gray-100" />
        <LinkRow label="이용약관" onClick={() => alert('이용약관은 출시 준비 중이에요.')} />
        <div className="h-px bg-gray-100" />
        <LinkRow label="개인정보처리방침" onClick={() => alert('개인정보처리방침은 출시 준비 중이에요.')} />
        <div className="h-px bg-gray-100" />
        <a href={CONTACT_MAIL} className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50">
          <span className="text-sm font-bold text-gray-700">문의하기</span>
          <span className="text-xs text-gray-300">›</span>
        </a>
      </div>

      <p className="mt-5 text-center text-[11px] text-gray-400">알림 설정은 아직 저장되지 않아요 · 출시 준비 중</p>
    </div>
  );
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-[#3CDBC0]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-gray-50">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <span className="text-xs text-gray-300">›</span>
    </button>
  );
}
