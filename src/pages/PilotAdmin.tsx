import { useState } from 'react';

interface PilotFeedback {
  id: string;
  createdAt: string;
  fitRating: number;
  fitText: string;
  extraText: string;
  contact: string | null;
  recommendationImageUrls: string[];
  paymentImageUrls: string[];
}

async function callPilotAdmin(password: string): Promise<PilotFeedback[]> {
  const res = await fetch('/api/pilot-admin-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '데이터를 불러오지 못했어요.');
  return Array.isArray(data.feedback) ? data.feedback : [];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export default function PilotAdmin() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [records, setRecords] = useState<PilotFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(pw = password) {
    setLoading(true);
    setError(null);
    try {
      const data = await callPilotAdmin(pw);
      setRecords(data);
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-4">
        <form
          onSubmit={(e) => { e.preventDefault(); if (password.trim()) load(password.trim()); }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-xs text-center"
        >
          <div className="text-3xl mb-3">🔒</div>
          <h1 className="text-lg font-black text-gray-800 mb-1">선발대 피드백 어드민</h1>
          <p className="text-sm text-gray-400 mb-6">비밀번호를 입력해주세요</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl border-2 text-center text-lg tracking-widest outline-none transition-all ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#36CFA0]'}`}
          />
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-[#36CFA0] text-white font-black py-3 rounded-xl hover:bg-[#2AB58C] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
          >
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8]">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
        <header className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-[#2AB5A0]">선발대 피드백</h1>
            <p className="text-sm text-gray-400">알고리즘 검증 제출 내역</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(password)}
              className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full hover:border-[#36CFA0] hover:text-[#36CFA0] transition-colors"
            >
              새로고침
            </button>
            <span className="text-xs bg-[#E8F8F5] text-[#2AB5A0] font-bold px-2.5 py-1 rounded-full">
              총 {records.length}건
            </span>
          </div>
        </header>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {records.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400">아직 제출된 피드백이 없어요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {records.map((r) => (
              <article key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                    <h2 className="text-lg font-black text-gray-800 mt-0.5">적합도 {r.fitRating}/5점</h2>
                    {r.contact && <p className="text-xs text-[#2AB5A0] font-bold mt-1">연락처: {r.contact}</p>}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{r.id}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <TextBlock title="조건 부합 피드백" text={r.fitText} />
                  <TextBlock title="추가 의견" text={r.extraText} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <ImageGroup title="MINT 추천 인증" urls={r.recommendationImageUrls} />
                  <ImageGroup title="결제 인증" urls={r.paymentImageUrls} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-[#F5FBF8] rounded-2xl px-4 py-3">
      <p className="text-[11px] font-bold text-[#2AB5A0] uppercase tracking-widest mb-2">{title}</p>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function ImageGroup({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-square">
            <img src={url} alt={title} className="w-full h-full object-cover" loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}
