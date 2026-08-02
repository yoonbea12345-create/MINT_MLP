import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { getBalance, getLedger, getDeviceId } from '../../utils/points';
import { loadHistory, openHistoryEntry, type HistoryEntry } from '../../utils/history';
import {
  getSession, onAuthChange, signInWithKakao, signOut, syncProfile, deleteAccount,
  getNickname, getAvatarUrl,
} from '../../utils/auth';

const CONTACT_MAIL = 'mailto:issuebell@naver.com?subject=MINT%20%EB%AC%B8%EC%9D%98';

// 프로필 탭 — 적립 이력은 실제 데이터(getLedger), 설정은 대부분 목업.
// 로그인은 선택이다. 비로그인 상태의 화면·기능은 로그인 이전과 완전히 동일하게 둔다.
export default function Profile() {
  const [balance] = useState(() => getBalance());
  const [ledger] = useState(() => getLedger());
  const [deviceId] = useState(() => getDeviceId());
  const [history] = useState<HistoryEntry[]>(() => loadHistory());
  const [pushOn, setPushOn] = useState(true);
  const [marketingOn, setMarketingOn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSession().then((s) => {
      if (!alive) return;
      setUser(s?.user ?? null);
      if (s?.user) void syncProfile();
    });
    const unsubscribe = onAuthChange((s) => {
      setUser(s?.user ?? null);
      if (s?.user) void syncProfile();
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  const nickname = getNickname(user);
  const avatarUrl = getAvatarUrl(user);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithKakao();
    } catch {
      setSigningIn(false);
      alert('로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('정말 탈퇴하시겠어요? 로그인 정보가 모두 삭제돼요.')) return;
    const r = await deleteAccount();
    if (r.ok) {
      setUser(null);
      alert('탈퇴가 완료됐어요. 그동안 이용해주셔서 고마워요.');
    } else {
      alert(r.error ?? '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-black text-gray-900">👤 프로필</h1>

      {/* 요약 */}
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F8F5] text-2xl">🌿</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-gray-800">{user ? `${nickname ?? '카카오 이용자'}님` : 'MINT 이용자님'}</p>
            <p className="text-xs text-gray-400">방문 인증 {ledger.length}회 · 적립 {balance.toLocaleString()}P</p>
          </div>
          {user && (
            <button onClick={() => void handleSignOut()} className="shrink-0 text-[11px] text-gray-400 underline">로그아웃</button>
          )}
        </div>
        <p className="mt-3 truncate text-[10px] text-gray-300">기기 ID · {deviceId}</p>
      </div>

      {/* 로그인 유도 — 비로그인 상태에서만. 로그인은 어디까지나 선택이다. */}
      {!user && (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-black text-gray-800">기기가 바뀌면 기록이 사라져요</p>
          <p className="mt-0.5 text-xs text-gray-400">카카오로 로그인하면 다음에도 이어져요</p>
          <button
            onClick={() => void handleSignIn()}
            disabled={signingIn}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] py-3 text-sm font-black text-[#191919] active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919" aria-hidden="true">
              <path d="M12 3C6.99 3 3 6.2 3 10.15c0 2.5 1.65 4.7 4.14 5.97l-.9 3.3c-.09.32.27.58.55.4l3.96-2.6c.4.04.82.06 1.25.06 5.01 0 9-3.2 9-7.13S17.01 3 12 3z" />
            </svg>
            카카오로 로그인
          </button>
          <p className="mt-2 text-[11px] text-gray-400">닉네임과 프로필 사진만 사용해요. 이메일·전화번호는 요구하지 않아요.</p>
        </div>
      )}

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
        {user && (
          <>
            <div className="h-px bg-gray-100" />
            <LinkRow label="로그아웃" onClick={() => void handleSignOut()} />
            <div className="h-px bg-gray-100" />
            <button
              onClick={() => void handleDeleteAccount()}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-gray-50"
            >
              <span className="text-sm font-bold text-red-500">회원 탈퇴</span>
              <span className="text-xs text-gray-300">›</span>
            </button>
          </>
        )}
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
