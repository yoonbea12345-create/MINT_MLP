interface Props {
  progress: number;
  message: string;
}

// 추천 생성 중 원형 프로그레스 화면
export default function LoadingScreen({ progress, message }: Props) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5FBF8] px-4 gap-6">
      <p className="text-[#3CDBC0] font-black text-2xl tracking-widest">MINT</p>

      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#E8F8F5" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke="#3CDBC0"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-[#2AB5A0]">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-bold text-[#2AB5A0]">{message}</p>
        <p className="text-xs text-gray-400 mt-1">AI가 서울을 탐색하고 있어요</p>
      </div>
    </div>
  );
}
