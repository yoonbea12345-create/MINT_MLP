interface Props {
  current: number;
  total: number;
  labels?: string[];
}

const DEFAULT_LABELS = ['모임·목적', '관계', '지역·장소', '분위기', '추천'];

export default function StepProgress({ current, total, labels }: Props) {
  const STEP_LABELS = labels ?? DEFAULT_LABELS;
  const progress = total > 1 ? current / (total - 1) : 0;
  return (
    <div className="w-full px-4 pt-6 pb-2">
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          {STEP_LABELS.slice(0, total).map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < current
                    ? 'bg-[#3CDBC0] text-white'
                    : i === current
                    ? 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/40'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {i < current ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  i <= current ? 'text-[#2AB5A0]' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[#3CDBC0] rounded-full transition-all duration-500 ease-in-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {/* 마스코트 — 진행 직선의 세로 중앙에 얹혀(슬라이더 손잡이처럼) 진행 지점을 따라 이동.
            라벨을 가리지 않도록 선 가운데 정렬 + 고정 너비(w-6)로 가장자리 찌그러짐 방지. */}
        <div
          className="absolute w-6 z-10 pointer-events-none transition-[left] duration-500 ease-in-out"
          style={{ left: `${progress * 100}%`, bottom: '3px', transform: 'translate(-50%, 50%)' }}
        >
          <img
            src="/image/mascot-bird.webp"
            alt=""
            aria-hidden="true"
            className="w-6 h-6 select-none drop-shadow-sm animate-mascot-bob"
          />
        </div>
      </div>
    </div>
  );
}
