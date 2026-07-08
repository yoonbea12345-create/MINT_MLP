interface Props {
  current: number;
  total: number;
  labels?: string[];
}

const DEFAULT_LABELS = ['모임·목적', '관계', '지역·장소', '분위기', '추천'];

export default function StepProgress({ current, total, labels }: Props) {
  const STEP_LABELS = labels ?? DEFAULT_LABELS;
  // 캐릭터를 현재 스텝 원(w-7 = 1.75rem) 중앙에 정확히 올린다.
  // 원 중앙 x = 14px(원 반지름) + (사용 가능 폭 - 28px) × 진행비율
  const mascotLeft = `calc(0.875rem + (100% - 1.75rem) * ${total > 1 ? current / (total - 1) : 0})`;
  return (
    <div className="w-full px-4 pt-9 pb-2">
      <div className="relative">
        <div
          className="absolute -top-7 z-10 pointer-events-none transition-[left] duration-500 ease-in-out"
          style={{ left: mascotLeft, transform: 'translateX(-50%)' }}
        >
          <img
            src="/image/mascot-bird.webp"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 select-none drop-shadow-sm animate-mascot-bob"
          />
        </div>
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
          style={{ width: `${(current / (total - 1)) * 100}%` }}
        />
      </div>
      </div>
    </div>
  );
}
