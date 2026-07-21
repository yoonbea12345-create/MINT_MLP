import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';

type FileGroup = 'recommendation' | 'payment';
type Phase = 'form' | 'spinning' | 'reward' | 'soldout' | 'reclaim' | 'done';

const BUCKET = 'pilot-feedback';

interface Prize { title: string; tier: string; imageUrl: string | null; claimCode: string; }
interface Selections { purpose: string | null; relation: string | null; region: string; vibes: string[]; source: 'chips' | 'session'; }

const PURPOSE_OPTS = [
  { v: '밥', emoji: '🍽️' }, { v: '술', emoji: '🍻' }, { v: '카페', emoji: '☕' }, { v: '디저트', emoji: '🍰' },
];
const RELATION_OPTS = [
  { v: '연인', emoji: '💑' }, { v: '친구들', emoji: '🍻' }, { v: '가족', emoji: '👨‍👩‍👧' }, { v: '혼자', emoji: '🧍' }, { v: '직장', emoji: '💼' },
];
const VIBE_OPTS = ['시끌벅적', '조용하게', '아늑한', '감성적인', '힙한', '로맨틱한', '뷰 좋은 곳', '인스타감성', '가성비'];

function makeId(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = 'pf';
  for (let i = 0; i < 14; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function fileLabel(files: File[]): string {
  if (files.length === 0) return '이미지 선택';
  if (files.length === 1) return files[0].name;
  return `${files.length}개 선택됨`;
}

async function uploadFiles(id: string, group: FileGroup, files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${id}/${group}/${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000', contentType: file.type || 'image/jpeg', upsert: false,
    });
    if (error) throw new Error(`이미지 업로드에 실패했어요: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export default function Pilot() {
  const [phase, setPhase] = useState<Phase>('form');

  // 입력 조건(세션 자동첨부 or 칩)
  const [purpose, setPurpose] = useState<string | null>(null);
  const [relation, setRelation] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [vibes, setVibes] = useState<string[]>([]);
  const [source, setSource] = useState<'chips' | 'session'>('chips');
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  // 인증 + 평가
  const [recommendationFiles, setRecommendationFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [fitRating, setFitRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 결과
  const [prize, setPrize] = useState<Prize | null>(null);
  const [claimCode, setClaimCode] = useState('');

  // 세션키로 조건 자동 불러오기 (없으면 조용히 콜드 칩 모드)
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session');
    if (!sid || !/^[a-z0-9]{4,32}$/i.test(sid)) return;
    setSessionKey(sid);
    (async () => {
      try {
        const res = await fetch(`/api/session-get?id=${encodeURIComponent(sid)}`);
        if (!res.ok) return;
        const data = await res.json();
        const m = Array.isArray(data.members) ? data.members[0] : null;
        if (!m) return;
        if (typeof m.purpose_first === 'string') setPurpose(mapPurpose(m.purpose_first));
        if (typeof m.location_name === 'string') setRegion(m.location_name);
        const vibeLabels = extractVibes(m);
        if (vibeLabels.length) setVibes(vibeLabels.slice(0, 3));
        setSource('session');
      } catch { /* 콜드 칩 모드로 폴백 */ }
    })();
  }, []);

  const selections: Selections = useMemo(
    () => ({ purpose, relation, region: region.trim(), vibes, source }),
    [purpose, relation, region, vibes, source],
  );

  const canSubmit = useMemo(
    () =>
      recommendationFiles.length > 0 &&
      paymentFiles.length > 0 &&
      fitRating > 0 &&
      feedbackText.trim().length > 0 &&
      !!purpose &&
      !!relation &&
      !submitting,
    [recommendationFiles, paymentFiles, fitRating, feedbackText, purpose, relation, submitting],
  );

  async function handleSubmit() {
    if (!canSubmit) { setError('목적·관계 선택, 인증 이미지 2종, 별점, 한 줄 후기를 모두 채워주세요.'); return; }
    setSubmitting(true);
    setError(null);
    const id = makeId();
    try {
      const [recommendationImagePaths, paymentImagePaths] = await Promise.all([
        uploadFiles(id, 'recommendation', recommendationFiles),
        uploadFiles(id, 'payment', paymentFiles),
      ]);
      const res = await fetch('/api/pilot-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          recommendationImagePaths,
          paymentImagePaths,
          fitRating,
          fitText: feedbackText.trim(),
          sessionKey,
          selections,
          placeName: region.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '제출에 실패했어요. 잠시 후 다시 시도해주세요.');

      setClaimCode(data.claimCode ?? '');
      if (data.prize) {
        setPrize(data.prize);
        setPhase('spinning'); // 룰렛 돌린 뒤 onDone에서 reward로
      } else {
        setPhase('soldout');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'spinning') {
    return <Roulette onDone={() => setPhase('reward')} />;
  }
  if (phase === 'reward' && prize) {
    return <RewardView prize={prize} onClose={() => setPhase('done')} />;
  }
  if (phase === 'soldout') {
    return <SoldOutView claimCode={claimCode} onClose={() => setPhase('done')} />;
  }
  if (phase === 'reclaim') {
    return <ReclaimView onBack={() => setPhase('form')} />;
  }
  if (phase === 'done') {
    return (
      <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-5">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-[#3CDBC0]/30 shadow-xl shadow-[#3CDBC0]/10 px-6 py-8 text-center animate-fade-in-up">
          <div className="w-20 h-20 rounded-full bg-[#3CDBC0] mx-auto mb-5 flex items-center justify-center shadow-lg shadow-[#3CDBC0]/30">
            <span className="text-white text-4xl font-black">✓</span>
          </div>
          <p className="text-2xl font-black text-gray-800 mb-2">참여 완료!</p>
          <p className="text-sm text-gray-500 leading-relaxed mb-2">소중한 선발대 데이터 정말 감사합니다.</p>
          {claimCode && (
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              당첨코드 <strong className="text-[#2AB5A0]">{claimCode}</strong> 는 꼭 보관하세요.<br />
              언제든 <strong>당첨코드로 다시 받기</strong>로 재수령할 수 있어요.
            </p>
          )}
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base active:scale-95 transition-all"
          >
            MINT로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── 폼 ──
  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8]">
      <div className="max-w-md lg:max-w-6xl mx-auto px-5 lg:px-8 pt-5 lg:pt-8 pb-10 lg:pb-16">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => { window.location.href = '/'; }} className="text-xl font-black text-[#3CDBC0] tracking-tight">MINT</button>
          <div className="flex items-center gap-2">
            <button onClick={() => setPhase('reclaim')} className="text-xs font-bold text-[#2AB5A0] bg-[#E8F8F5] border border-[#3CDBC0]/30 px-3 py-1.5 rounded-full active:scale-95 transition-all">당첨코드로 다시 받기</button>
            <button onClick={() => { window.location.href = '/pilot-admin'; }} className="text-xs font-bold text-gray-400 bg-white border border-gray-100 px-3 py-1.5 rounded-full active:scale-95 transition-all">관리자</button>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:items-start">
          <section className="mb-6 lg:mb-0 lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-1.5 bg-[#E8F8F5] border border-[#3CDBC0]/30 text-[#2AB5A0] text-xs font-bold px-3 py-1 rounded-full mb-3">✦ MINT 선발대</div>
            <h1 className="text-3xl lg:text-5xl font-black text-gray-800 leading-tight mb-2 lg:mb-4">다녀온 인증만 하면<br />그 자리에서 100% 당첨</h1>
            <p className="text-sm lg:text-base text-gray-500 leading-relaxed mb-5">MINT 추천으로 다녀온 곳을 인증하고 짧은 후기를 남기면, <strong className="text-[#2AB5A0]">꽝 없는 룰렛</strong>으로 기프티콘을 그 자리에서 바로 받아요. 이메일·전화번호 입력 없이 논스톱!</p>
            <div className="hidden lg:grid grid-cols-3 gap-3">
              {[
                { v: '100%', d: '꽝 없는 즉시 당첨' },
                { v: '0단계', d: '연락처 입력 없이' },
                { v: '바로', d: '화면에서 기프티콘 수령' },
              ].map((item) => (
                <div key={item.v} className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-[#3CDBC0]">{item.v}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-tight">{item.d}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4">
            {/* 조건 */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {source === 'session' && (
                <div className="mb-3 flex items-center gap-2 bg-[#E8F8F5] border border-[#3CDBC0]/30 rounded-xl px-3 py-2">
                  <span className="text-base">✨</span>
                  <p className="text-[11px] text-[#2AB5A0] leading-snug">추천받았던 조건을 불러왔어요. 다르면 아래에서 바로 고치면 돼요.</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-gray-800">어떤 조건으로 추천받으셨나요?</p>
                  <p className="text-xs text-gray-400 mt-0.5">탭 몇 번이면 끝나요. (알고리즘 학습용)</p>
                </div>
                <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full shrink-0">필수</span>
              </div>

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">목적</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PURPOSE_OPTS.map((o) => (
                  <ChipBtn key={o.v} selected={purpose === o.v} onClick={() => setPurpose(purpose === o.v ? null : o.v)} emoji={o.emoji} label={o.v} />
                ))}
              </div>

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">누구랑</p>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {RELATION_OPTS.map((o) => (
                  <ChipBtn key={o.v} selected={relation === o.v} onClick={() => setRelation(relation === o.v ? null : o.v)} emoji={o.emoji} label={o.v} small />
                ))}
              </div>

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">지역 <span className="text-gray-300 normal-case">· 선택</span></p>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="예: 홍대 / 성수동 / 강남역"
                maxLength={40}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors mb-4"
              />

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">분위기 <span className="text-gray-300 normal-case">· 선택 · 최대 3개</span></p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_OPTS.map((v) => {
                  const on = vibes.includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => setVibes(on ? vibes.filter((x) => x !== v) : vibes.length >= 3 ? vibes : [...vibes, v])}
                      className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all active:scale-95 ${on ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0]' : 'border-gray-200 bg-white text-gray-600'}`}
                    >{v}</button>
                  );
                })}
              </div>
            </section>

            {/* 인증 업로드 */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 flex flex-col gap-4">
              <UploadBox title="MINT 추천 결과 화면" desc="추천받은 결과 화면 캡처 1장이면 충분해요." files={recommendationFiles} onChange={setRecommendationFiles} />
              <UploadBox title="결제 인증 이미지" desc="영수증·카드 승인·결제 내역 등 방문 결제가 보이는 이미지." files={paymentFiles} onChange={setPaymentFiles} />
            </div>

            {/* 별점 + 후기 통합 1칸 */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-gray-800">조건에 잘 맞았나요?</p>
                  <p className="text-xs text-gray-400 mt-0.5">별점 + 한 줄 후기면 끝. 다음 추천 품질에 바로 반영돼요.</p>
                </div>
                <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
              </div>
              <div className="flex gap-1.5 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setFitRating(n)} aria-label={`${n}점`}
                    className={`w-11 h-11 rounded-xl border-2 text-xl transition-all active:scale-95 ${fitRating >= n ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0]' : 'border-gray-200 bg-white text-gray-300'}`}>★</button>
                ))}
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="예: 조용한 분위기랑 예산은 딱 맞았고, 역에서 거리는 살짝 멀었어요. 한 줄이면 충분해요!"
                className="w-full min-h-24 resize-none border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors"
              />
            </section>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${canSubmit ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              {submitting ? '제출 중...' : '🎁 제출하고 룰렛 돌리기'}
            </button>
            <p className="text-center text-[11px] text-gray-400">꽝 없는 룰렛 · 제출하면 그 자리에서 100% 당첨돼요</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 룰렛 (꽝 칸은 있지만 확률 0%) ─────────────────────────
const SLICES = 8;
const SLICE_DEG = 360 / SLICES;
// 짝수 인덱스 = 상품칸(🎁), 홀수 = 꽝칸. 항상 상품칸에만 멈춘다.
const PRIZE_INDEX = 0;

function Roulette({ onDone }: { onDone: () => void }) {
  const [rot, setRot] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    // 상품칸(중심 = i*45+22.5)을 12시(0deg)로 → 회전량 = 360*n - (center)
    const center = PRIZE_INDEX * SLICE_DEG + SLICE_DEG / 2;
    const target = 360 * 6 + (360 - center);
    const t = setTimeout(() => setRot(target), 60);
    // 안전핀: transitionend를 못 받아도 반드시 진행(감속 모션 off 등)
    const fallback = setTimeout(() => { if (!firedRef.current) { firedRef.current = true; onDone(); } }, 5200);
    return () => { clearTimeout(t); clearTimeout(fallback); };
  }, [onDone]);

  const gradient = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i < SLICES; i++) {
      const color = i % 2 === 0 ? '#3CDBC0' : '#E5E7EB';
      parts.push(`${color} ${i * SLICE_DEG}deg ${(i + 1) * SLICE_DEG}deg`);
    }
    return `conic-gradient(${parts.join(', ')})`;
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8] flex flex-col items-center justify-center px-6">
      <p className="text-2xl font-black text-gray-800 mb-1">🎉 꽝 없는 룰렛</p>
      <p className="text-sm text-gray-500 mb-8">100% 당첨! 어떤 상품이 걸릴까요?</p>
      <div className="relative w-72 h-72">
        {/* 포인터 */}
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-20"
          style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '22px solid #FF6B6B' }} />
        {/* 휠 */}
        <div
          className="absolute inset-0 rounded-full border-8 border-white shadow-xl"
          style={{ background: gradient, transform: `rotate(${rot}deg)`, transition: 'transform 4.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onTransitionEnd={() => { if (!firedRef.current) { firedRef.current = true; onDone(); } }}
        >
          {Array.from({ length: SLICES }).map((_, i) => {
            const angle = i * SLICE_DEG + SLICE_DEG / 2;
            const prize = i % 2 === 0;
            return (
              <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${angle}deg) translateY(-92px)` }}>
                <span className="block -translate-x-1/2 text-lg font-black" style={{ transform: `rotate(${-angle}deg)`, color: prize ? '#fff' : '#9CA3AF' }}>
                  {prize ? '🎁' : '꽝'}
                </span>
              </div>
            );
          })}
        </div>
        {/* 허브 */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-md border-2 border-[#3CDBC0] flex items-center justify-center z-10 text-xl">🎯</div>
      </div>
    </div>
  );
}

// ───────────────────────── 수령 화면 ─────────────────────────
function RewardView({ prize, onClose, reclaimed = false }: { prize: Prize; onClose: () => void; reclaimed?: boolean }) {
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(prize.claimCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }
  async function finish() {
    if (!reclaimed && contact.trim()) {
      setSaving(true);
      try {
        await fetch('/api/pilot-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set-contact', code: prize.claimCode, contact: contact.trim() }) });
      } catch { /* 선택사항이라 실패해도 진행 */ }
      setSaving(false);
    }
    onClose();
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-[#3CDBC0]/30 shadow-xl shadow-[#3CDBC0]/10 px-6 py-7 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-1.5 bg-[#E8F8F5] text-[#2AB5A0] text-xs font-black px-3 py-1 rounded-full mb-3">🎉 100% 당첨</div>
        <p className="text-2xl font-black text-gray-800 mb-1">{prize.title}</p>
        <p className="text-xs text-gray-400 mb-4">지금 <strong className="text-[#2AB5A0]">스크린샷으로 저장</strong>하세요!</p>

        {prize.imageUrl ? (
          <a href={prize.imageUrl} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 mb-4">
            <img src={prize.imageUrl} alt={prize.title} className="w-full object-contain max-h-80" />
          </a>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 py-10 mb-4 text-sm text-gray-400">이미지를 불러오지 못했어요.<br />아래 당첨코드로 다시 받아주세요.</div>
        )}

        <div className="bg-[#F5FBF8] border border-[#3CDBC0]/30 rounded-2xl px-4 py-3 mb-4">
          <p className="text-[11px] text-gray-400 mb-1">당첨코드 (재수령용 · 꼭 보관)</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl font-black tracking-widest text-[#2AB5A0]">{prize.claimCode}</span>
            <button onClick={copyCode} className="text-xs font-bold text-[#2AB5A0] bg-[#E8F8F5] border border-[#3CDBC0]/30 px-2.5 py-1 rounded-full active:scale-95">{copied ? '복사됨!' : '복사'}</button>
          </div>
        </div>

        {!reclaimed && (
          <div className="mb-4 text-left">
            <p className="text-[11px] text-gray-400 mb-1">혹시 몰라 재발송 받을 연락처 <span className="text-gray-300">(선택)</span></p>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="카톡ID / 이메일 / 전화 (안 적어도 돼요)" maxLength={100}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors" />
          </div>
        )}

        <button onClick={finish} disabled={saving} className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base active:scale-95 transition-all disabled:opacity-60">
          {saving ? '저장 중...' : reclaimed ? '닫기' : '저장했어요, 완료'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 재고 소진 예외 ─────────────────────────
function SoldOutView({ claimCode, onClose }: { claimCode: string; onClose: () => void }) {
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!contact.trim()) { setErr('연락처를 입력해주세요.'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/pilot-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set-contact', code: claimCode, contact: contact.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '저장에 실패했어요.');
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-[#3CDBC0]/30 shadow-xl shadow-[#3CDBC0]/10 px-6 py-7 text-center animate-fade-in-up">
        <div className="text-4xl mb-3">🎁</div>
        <p className="text-2xl font-black text-gray-800 mb-1">당첨 확정!</p>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">상품이 잠시 품절이라 <strong className="text-[#2AB5A0]">충전 즉시 보내드릴게요.</strong> 이번만 연락처를 남겨주세요.</p>
        <div className="bg-[#F5FBF8] border border-[#3CDBC0]/30 rounded-2xl px-4 py-3 mb-4">
          <p className="text-[11px] text-gray-400 mb-1">당첨코드 (꼭 보관 · 이 코드로도 수령 가능)</p>
          <span className="text-xl font-black tracking-widest text-[#2AB5A0]">{claimCode}</span>
        </div>
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="카톡ID / 이메일 / 전화번호" maxLength={100}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors mb-1 text-center" />
        {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
        <button onClick={save} disabled={saving} className="w-full mt-3 py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base active:scale-95 transition-all disabled:opacity-60">{saving ? '저장 중...' : '연락처 남기기'}</button>
      </div>
    </div>
  );
}

// ───────────────────────── 당첨코드 재수령 ─────────────────────────
function ReclaimView({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup() {
    const c = code.trim().toUpperCase();
    if (!/^MINT-[A-Z0-9]{5}$/.test(c)) { setErr('MINT-XXXXX 형식의 당첨코드를 입력해주세요.'); return; }
    setLoading(true); setErr(null); setPending(false);
    try {
      const res = await fetch('/api/pilot-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reclaim', code: c }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '조회에 실패했어요.');
      if (data.pending) { setPending(true); return; }
      if (data.prize) setPrize({ ...data.prize, claimCode: c });
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  if (prize) return <RewardView prize={prize} onClose={onBack} reclaimed />;

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-8 text-center">
        <div className="text-3xl mb-3">🎟️</div>
        <h1 className="text-lg font-black text-gray-800 mb-1">당첨코드로 다시 받기</h1>
        <p className="text-sm text-gray-400 mb-5">받았던 당첨코드(MINT-XXXXX)를 입력하면 기프티콘을 다시 보여드려요.</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MINT-XXXXX" maxLength={10}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest uppercase text-[#2AB5A0] placeholder-gray-300 focus:outline-none focus:border-[#3CDBC0] transition-colors" />
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        {pending && <p className="text-xs text-[#2AB5A0] mt-2">아직 상품 충전 대기 중이에요. 곧 지급되면 이 코드로 받을 수 있어요.</p>}
        <button onClick={lookup} disabled={loading} className="w-full mt-4 py-3.5 rounded-xl bg-[#3CDBC0] text-white font-black active:scale-95 transition-all disabled:opacity-60">{loading ? '조회 중...' : '기프티콘 받기'}</button>
        <button onClick={onBack} className="w-full mt-2 py-2 text-sm font-bold text-gray-400">돌아가기</button>
      </div>
    </div>
  );
}

// ───────────────────────── 공용 소품 ─────────────────────────
function ChipBtn({ selected, onClick, emoji, label, small }: { selected: boolean; onClick: () => void; emoji: string; label: string; small?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={selected}
      className={`flex flex-col items-center justify-center ${small ? 'h-16' : 'h-[72px]'} rounded-2xl border-2 transition-all duration-200 active:scale-95 ${selected ? 'border-[#3CDBC0] bg-[#E8F8F5] shadow-md shadow-[#3CDBC0]/20' : 'border-gray-200 bg-white hover:border-[#3CDBC0]/50'}`}>
      <span className={`${small ? 'text-lg' : 'text-xl'} mb-0.5 leading-none`}>{emoji}</span>
      <span className={`${small ? 'text-[11px]' : 'text-xs'} font-bold leading-none ${selected ? 'text-[#2AB5A0]' : 'text-gray-700'}`}>{label}</span>
    </button>
  );
}

function UploadBox({ title, desc, files, onChange }: { title: string; desc: string; files: File[]; onChange: (files: File[]) => void }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-black text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
        </div>
        <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full shrink-0">필수</span>
      </div>
      <label className="block border-2 border-dashed border-[#3CDBC0]/60 rounded-2xl bg-[#F0FDF9] px-4 py-5 text-center active:scale-[0.99] transition-all cursor-pointer">
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
        <span className="block text-2xl mb-1">＋</span>
        <span className="block text-sm font-black text-[#2AB5A0] truncate">{fileLabel(files)}</span>
        <span className="block text-[11px] text-[#2AB5A0]/60 mt-1">여러 장도 가능</span>
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {files.map((file) => (
            <span key={`${file.name}-${file.size}`} className="max-w-full truncate text-xs font-bold text-[#2AB5A0] bg-[#E8F8F5] px-2.5 py-1 rounded-full">{file.name}</span>
          ))}
        </div>
      )}
    </section>
  );
}

// 세션 멤버 필드 → 파일럿 조건 매핑 (best-effort)
function mapPurpose(raw: string): string | null {
  if (['밥', '술', '카페', '디저트'].includes(raw)) return raw;
  if (raw === '기타') return null;
  return raw.length <= 6 ? raw : null;
}
function extractVibes(m: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => { if (typeof v === 'string' && v && VIBE_OPTS.includes(v)) out.push(v); };
  push(m.vibe_atmosphere);
  if (Array.isArray(m.vibe_keywords)) for (const k of m.vibe_keywords) push(k);
  return Array.from(new Set(out));
}
