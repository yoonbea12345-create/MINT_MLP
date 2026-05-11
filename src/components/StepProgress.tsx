interface Props {
  current: number;
  total: number;
}

const STEP_LABELS = ['출발지', '목적', '분위기', '장소'];

export default function StepProgress({ current, total }: Props) {
  return (
    <div className="w-full px-4 pt-6 pb-2">
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
          className="absolute inset-y-0 left-0 bg-[#3CDBC0] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(current / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
