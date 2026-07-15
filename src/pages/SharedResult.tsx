import { useEffect, useState } from 'react';
import type { PlaceRecommendation } from '../services/ai';
import { congestionDotClass } from '../services/seoulData';
import MiniMap from '../components/MiniMap';

// 공유 URL에 실려오는 투표 후보 (슬림 포맷: n=이름, c=카테고리, s=적합도)
interface VoteCandidate {
  n: string;
  c?: string;
  s?: number | null;
}

interface SharedPayload extends PlaceRecommendation {
  shareId?: string;
  candidates?: VoteCandidate[];
}

// 투표자 식별 — 기기당 1표 (로그인 없는 서비스라 localStorage 익명 ID)
function getVoterId(): string {
  try {
    let id = localStorage.getItem('mint_voter_id');
    if (!id) {
      id = 'v';
      const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
      for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
      localStorage.setItem('mint_voter_id', id);
    }
    return id;
  } catch {
    return 'vanonymous';
  }
}

function VoteSection({ shareId, candidates }: { shareId: string; candidates: VoteCandidate[] }) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  // 이 기기에서 이미 투표했으면 복원 (기기당 1표)
  const [myChoice, setMyChoice] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`mint_vote_${shareId}`);
      return saved !== null ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    fetch(`/api/share-vote?id=${encodeURIComponent(shareId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.disabled) setDisabled(true);
        else if (d.counts) setCounts(d.counts);
      })
      .catch(() => setDisabled(true));
  }, [shareId]);

  function vote(choice: number) {
    if (disabled) return;
    const prev = myChoice;
    if (prev === choice) return; // 같은 후보 재클릭은 무시 (한 기기 1표 유지)
    // 낙관적 업데이트 — 재투표는 이전 표를 옮긴다
    setMyChoice(choice);
    setCounts((c) => {
      const next = { ...c, [choice]: (c[choice] ?? 0) + 1 };
      if (prev !== null) next[prev] = Math.max(0, (next[prev] ?? 1) - 1);
      return next;
    });
    try { localStorage.setItem(`mint_vote_${shareId}`, String(choice)); } catch { /* ignore */ }
    fetch('/api/share-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, voterId: getVoterId(), choice, placeName: candidates[choice]?.n }),
    }).catch(() => {});
  }

  if (disabled) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4 animate-fade-in-up">
      <p className="text-sm font-black text-gray-800 mb-0.5">🙌 어디가 제일 좋아요?</p>
      <p className="text-[11px] text-gray-400 mb-3">
        투표하면 모두에게 집계가 보여요{total > 0 ? ` · 지금까지 ${total}표` : ''}
      </p>
      <div className="flex flex-col gap-2">
        {candidates.map((c, i) => {
          const n = counts[i] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const mine = myChoice === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              className={`relative overflow-hidden text-left rounded-xl border-2 px-3 py-2.5 transition-all active:scale-[0.99] ${
                mine ? 'border-[#3CDBC0] bg-[#E8F8F5]' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'
              }`}
            >
              {/* 득표율 바 */}
              {total > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#3CDBC0]/10 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${mine ? 'text-[#1A7A6E]' : 'text-gray-800'}`}>
                    {i === 0 ? '⭐ ' : ''}{c.n}
                  </p>
                  {c.c && <p className="text-[10px] text-gray-400 truncate">{c.c}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.s != null && (
                    <span className="text-[10px] font-bold text-[#2AB5A0] bg-white/80 border border-[#3CDBC0]/30 px-1.5 py-0.5 rounded-full">
                      {c.s}점
                    </span>
                  )}
                  <span className={`text-xs font-black ${mine ? 'text-[#2AB5A0]' : 'text-gray-400'}`}>
                    👍 {n}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SharedResult() {
  const [result, setResult] = useState<SharedPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('data');
      if (!data) throw new Error('no data');
      // URLSearchParams.get()이 이미 1회 디코드한다. 여기서 또 decodeURIComponent하면
      // description 등에 '%'가 섞였을 때(예: "만족도 90%") URIError로 정상 링크도 깨진다.
      const parsed = JSON.parse(data);
      // URL 잘림 등으로 필수 필드가 결손되면 렌더 중 크래시(특히 208줄 vibeTags.map) 대신 에러 화면으로.
      if (!parsed?.placeName || !Array.isArray(parsed.vibeTags)) throw new Error('malformed payload');
      setResult(parsed);
    } catch {
      setError(true);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex flex-col items-center justify-center p-8 text-center">
        <div className="text-4xl mb-4">😔</div>
        <p className="text-gray-600 mb-6">링크가 올바르지 않아요.</p>
        <a href="/" className="px-6 py-3 bg-[#3CDBC0] text-white rounded-2xl font-bold">
          MINT로 직접 정하기
        </a>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#F5FBF8] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pb-10 pt-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#2AB5A0]">MINT</h1>
          <p className="text-sm text-gray-400 mt-1">오늘의 추천 장소</p>
        </div>

        {/* 메인 카드 */}
        <div className="result-gradient rounded-3xl overflow-hidden text-white shadow-xl shadow-[#3CDBC0]/30 mb-4 animate-fade-in-up">
          {result.imageUrl && (
            <img
              src={result.imageUrl}
              alt={result.placeName}
              className="w-full h-40 object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-80 bg-white/20 px-2.5 py-1 rounded-full">
                {result.category}
              </span>
              {result.congestionLevel && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${congestionDotClass(result.congestionLevel as Parameters<typeof congestionDotClass>[0])}`} />
                  <span className="text-xs opacity-90">{result.congestionLevel}</span>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-black mt-3 mb-1 leading-tight">
              오늘은<br /><span className="text-3xl">{result.placeName}</span>
            </h2>
            {result.description && (
              <p className="text-sm font-semibold opacity-95 mb-3 leading-snug bg-white/15 rounded-xl px-3 py-2">
                💬 {result.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {result.vibeTags.map((tag) => (
                <span key={tag} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="bg-white/15 rounded-2xl p-3 flex flex-col gap-1.5">
              <div className="flex items-start gap-2 text-sm">
                <span className="opacity-70 shrink-0">📍</span>
                <span className="opacity-90">{result.address || result.area}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-70">💰</span>
                <span className="opacity-90">{result.priceRange}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 멤버 투표 — 공유받은 사람이 후보에 한 표 */}
        {result.shareId && result.candidates && result.candidates.length >= 2 && (
          <VoteSection shareId={result.shareId} candidates={result.candidates} />
        )}

        {result.lat && result.lng && (
          <div className="mb-4 animate-fade-in-up">
            <MiniMap lat={result.lat} lng={result.lng} placeName={result.placeName} />
          </div>
        )}

        <div className="text-center mb-4">
          <p className="text-xs text-gray-400">AI가 이 모임에 딱 맞는 장소를 골라줬어요</p>
        </div>
        <a
          href="/app"
          className="block w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base text-center shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-colors active:scale-95"
        >
          🌿 나도 30초 만에 추천받기
        </a>
        <a
          href="/"
          className="block w-full py-3 text-center text-sm text-gray-400 hover:text-[#2AB5A0] transition-colors mt-1"
        >
          MINT가 뭔지 알아보기 →
        </a>
      </div>
    </div>
  );
}
