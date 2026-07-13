interface Props {
  progress: number;
  message: string;
}

const PROGRESS_RADIUS = 82;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

// 추천을 기다리는 시간을 브랜드 경험으로 바꾸는 MINT 큐레이션 스플래시
export default function LoadingScreen({ progress, message }: Props) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  const roundedProgress = Math.round(safeProgress);
  const progressOffset = PROGRESS_CIRCUMFERENCE * (1 - safeProgress / 100);

  return (
    <main className="mint-splash relative min-h-[100dvh] overflow-hidden bg-[#F2FCF8] text-[#153A34]">
      <div aria-hidden className="mint-splash__wash mint-splash__wash--top" />
      <div aria-hidden className="mint-splash__wash mint-splash__wash--bottom" />
      <div aria-hidden className="mint-splash__grain" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]">
        <header className="mint-splash__enter text-center">
          <p className="pl-[0.3em] text-2xl font-black tracking-[0.3em] text-[#3CDBC0]">MINT</p>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <div className="mint-splash__scene mint-splash__enter mint-splash__enter--delay-2" aria-hidden>
            <div className="mint-splash__orbit mint-splash__orbit--one" />
            <div className="mint-splash__orbit mint-splash__orbit--two" />

            <span className="mint-splash__signal mint-splash__signal--place">실존 장소</span>
            <span className="mint-splash__signal mint-splash__signal--vibe">취향</span>
            <span className="mint-splash__signal mint-splash__signal--route">동선</span>

            <svg className="absolute inset-1/2 h-[214px] w-[214px] -translate-x-1/2 -translate-y-1/2 -rotate-90" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="mintSplashProgress" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#79E9D5" />
                  <stop offset="100%" stopColor="#20B49C" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r={PROGRESS_RADIUS} fill="none" stroke="rgba(255,255,255,.78)" strokeWidth="7" />
              <circle
                cx="100"
                cy="100"
                r={PROGRESS_RADIUS}
                fill="none"
                stroke="url(#mintSplashProgress)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={PROGRESS_CIRCUMFERENCE}
                strokeDashoffset={progressOffset}
                className="mint-splash__progress-ring"
              />
            </svg>

            <div className="mint-splash__core">
              <div className="mint-splash__mascot-halo" />
              <img src="/image/mascot-bird.webp" alt="" className="mint-splash__mascot" />
              <div className="relative z-10 mt-1 flex items-baseline justify-center gap-0.5">
                <span className="text-[26px] font-black leading-none tracking-[-0.06em] text-[#173D36]">{roundedProgress}</span>
                <span className="text-[11px] font-extrabold text-[#58A397]">%</span>
              </div>
            </div>
          </div>

          <div className="mint-splash__status mint-splash__enter mint-splash__enter--delay-3 w-full">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 text-left">
                <p className="text-[9px] font-extrabold tracking-[0.15em] text-[#73A69D]">NOW CURATING</p>
                <p
                  className="mt-1 break-keep text-[13px] font-extrabold leading-[1.35] tracking-[-0.025em] text-[#23574E]"
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#E7F8F3] px-2.5 py-1 text-[10px] font-black text-[#25AD97]">{roundedProgress}%</span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DFF2EC]"
              role="progressbar"
              aria-label="추천 준비 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={roundedProgress}
            >
              <div className="mint-splash__bar h-full rounded-full" style={{ width: `${safeProgress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-bold text-[#749A93]">
              <span className="flex items-center gap-1.5"><i className="mint-splash__check" />실존 후보 확인</span>
              <span className="h-3 w-px bg-[#D9EBE6]" />
              <span className="flex items-center gap-1.5"><i className="mint-splash__check" />조건별 비교</span>
            </div>
          </div>
        </section>

        <footer className="mint-splash__enter mint-splash__enter--delay-3 text-center">
          <p className="text-[10px] font-semibold tracking-[-0.01em] text-[#8AA9A3]">
            선택은 가볍게, 추천은 꼼꼼하게.
          </p>
        </footer>
      </div>
    </main>
  );
}
