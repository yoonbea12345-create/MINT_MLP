import { useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';

type FileGroup = 'recommendation' | 'payment';
type SubmitState = 'idle' | 'submitting' | 'done';

const BUCKET = 'pilot-feedback';

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
      cacheControl: '31536000',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(`이미지 업로드에 실패했어요: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export default function Pilot() {
  const [recommendationFiles, setRecommendationFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [fitRating, setFitRating] = useState(0);
  const [fitText, setFitText] = useState('');
  const [extraText, setExtraText] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      recommendationFiles.length > 0 &&
      paymentFiles.length > 0 &&
      fitRating > 0 &&
      fitText.trim().length > 0 &&
      extraText.trim().length > 0 &&
      state !== 'submitting',
    [recommendationFiles, paymentFiles, fitRating, fitText, extraText, state],
  );

  async function handleSubmit() {
    if (!canSubmit) {
      setError('필수 항목을 모두 채워주세요.');
      return;
    }

    setState('submitting');
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
          fitText: fitText.trim(),
          extraText: extraText.trim(),
          contact: contact.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '제출에 실패했어요. 잠시 후 다시 시도해주세요.');
      setState('done');
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="min-h-[100dvh] bg-[#F5FBF8] flex items-center justify-center px-5">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-[#3CDBC0]/30 shadow-xl shadow-[#3CDBC0]/10 px-6 py-8 text-center animate-fade-in-up">
          <div className="w-20 h-20 rounded-full bg-[#3CDBC0] mx-auto mb-5 flex items-center justify-center shadow-lg shadow-[#3CDBC0]/30">
            <span className="text-white text-4xl font-black">✓</span>
          </div>
          <p className="text-2xl font-black text-gray-800 mb-2">제출이 완료됐습니다!</p>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            소중한 선발대 데이터 정말 감사합니다.<br />
            확인 후 <strong className="text-[#2AB5A0]">1일 이내에 상품을 전달드릴게요!</strong>
          </p>
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

  return (
    <div className="min-h-[100dvh] bg-[#F5FBF8]">
      <div className="max-w-md lg:max-w-6xl mx-auto px-5 lg:px-8 pt-5 lg:pt-8 pb-10 lg:pb-16">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => { window.location.href = '/'; }} className="text-xl font-black text-[#3CDBC0] tracking-tight">
            MINT
          </button>
          <button
            onClick={() => { window.location.href = '/pilot-admin'; }}
            className="text-xs font-bold text-gray-400 bg-white border border-gray-100 px-3 py-1.5 rounded-full active:scale-95 transition-all"
          >
            관리자
          </button>
        </header>

        <div className="lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:items-start">
          <section className="mb-6 lg:mb-0 lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-1.5 bg-[#E8F8F5] border border-[#3CDBC0]/30 text-[#2AB5A0] text-xs font-bold px-3 py-1 rounded-full mb-3">
              ✦ MINT 선발대
            </div>
            <h1 className="text-3xl lg:text-5xl font-black text-gray-800 leading-tight mb-2 lg:mb-4">
              추천받은 그곳,<br />
              진짜 어땠나요?
            </h1>
            <p className="text-sm lg:text-base text-gray-500 leading-relaxed mb-5">
              MINT 알고리즘을 더 정교하게 만들기 위해 실제 방문 인증과 솔직한 피드백을 받고 있어요.
              남겨주신 데이터는 추천 품질 검증에만 사용됩니다.
            </p>
            <div className="hidden lg:grid grid-cols-3 gap-3">
              {[
                { v: '2종', d: '추천 화면 + 결제 인증' },
                { v: '5점', d: '조건 부합도 정량화' },
                { v: '1일', d: '확인 후 상품 전달' },
              ].map((item) => (
                <div key={item.v} className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-[#3CDBC0]">{item.v}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-tight">{item.d}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 flex flex-col gap-4">
              <UploadBox
                title="MINT 추천 인증 화면"
                desc="서비스 안에서 해당 맛집을 추천받은 화면을 올려주세요."
                files={recommendationFiles}
                onChange={setRecommendationFiles}
              />
              <UploadBox
                title="결제 인증 이미지"
                desc="영수증, 카드 승인 화면, 결제 내역 등 방문 결제가 확인되는 이미지면 모두 괜찮아요."
                files={paymentFiles}
                onChange={setPaymentFiles}
              />
            </div>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-gray-800">입력한 조건에 부합했나요?</p>
                <p className="text-xs text-gray-400 mt-0.5">별점과 이유를 모두 남겨주세요.</p>
              </div>
              <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
            </div>

            <div className="flex gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setFitRating(n)}
                  className={`w-11 h-11 rounded-xl border-2 text-xl transition-all active:scale-95 ${
                    fitRating >= n
                      ? 'border-[#3CDBC0] bg-[#E8F8F5] text-[#2AB5A0]'
                      : 'border-gray-200 bg-white text-gray-300'
                  }`}
                  aria-label={`${n}점`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={fitText}
              onChange={(e) => setFitText(e.target.value)}
              placeholder="예: 조용한 분위기와 예산은 잘 맞았고, 역에서 거리는 생각보다 조금 멀었어요."
              className="w-full min-h-28 resize-none border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors"
            />
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-gray-800">추가로 하고 싶은 말 뭐든지!!</p>
                <p className="text-xs text-gray-400 mt-0.5">진짜 한 줄이라도 간절히 부탁드려요. 다음 추천 품질에 바로 반영할게요.</p>
              </div>
              <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
            </div>
            <textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              placeholder="좋았던 점, 아쉬웠던 점, 이런 조건은 더 봐줬으면 하는 점까지 전부 환영이에요."
              className="w-full min-h-28 resize-none border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] transition-colors"
            />
            </section>

            <section className="bg-[#E8F8F5] border border-[#3CDBC0]/30 rounded-2xl p-5">
            <p className="text-sm font-black text-[#2AB5A0] mb-1">상품 받을 연락처</p>
            <p className="text-xs text-[#2AB5A0]/70 mb-3">카카오톡 ID, 이메일, 전화번호 중 편한 방식으로 남겨주세요. 선택사항이지만 비워두면 전달이 어려울 수 있어요.</p>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="예: mint_kakao / hello@email.com"
              className="w-full border-2 border-[#3CDBC0]/40 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3CDBC0] bg-white transition-colors"
            />
            </section>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
                canSubmit
                  ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {state === 'submitting' ? '제출 중...' : '입력완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadBox({
  title,
  desc,
  files,
  onChange,
}: {
  title: string;
  desc: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
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
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        />
        <span className="block text-2xl mb-1">＋</span>
        <span className="block text-sm font-black text-[#2AB5A0] truncate">{fileLabel(files)}</span>
        <span className="block text-[11px] text-[#2AB5A0]/60 mt-1">여러 장 선택 가능</span>
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {files.map((file) => (
            <span key={`${file.name}-${file.size}`} className="max-w-full truncate text-xs font-bold text-[#2AB5A0] bg-[#E8F8F5] px-2.5 py-1 rounded-full">
              {file.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
