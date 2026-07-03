interface Props {
  expectedCount: number;
  onExpectedCount: (n: number) => void;
  hasSecond: boolean;
  onHasSecond: (v: boolean) => void;
  error: string | null;
  creating: boolean;
  onCreate: () => void;
}

// 그룹 모드: 인원수·코스 선택 + 공유 링크 생성
export default function GroupSetup({ expectedCount, onExpectedCount, hasSecond, onHasSecond, error, creating, onCreate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">참여 인원수 (호스트 포함)</p>
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => onExpectedCount(n)}
              className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 border-2 ${
                expectedCount === n
                  ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#3CDBC0]/50'
              }`}
            >
              {n === 6 ? '6명+' : `${n}명`}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">코스 선택</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onHasSecond(false)}
            className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 border-2 flex flex-col items-center gap-1 ${
              !hasSecond
                ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#3CDBC0]/50'
            }`}
          >
            <span className="text-xl">🍽️</span>
            <span>1차만</span>
          </button>
          <button
            onClick={() => onHasSecond(true)}
            className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 border-2 flex flex-col items-center gap-1 ${
              hasSecond
                ? 'bg-[#3CDBC0] text-white border-[#3CDBC0] shadow-lg shadow-[#3CDBC0]/30'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#3CDBC0]/50'
            }`}
          >
            <span className="text-xl">🍻</span>
            <span>1차+2차</span>
          </button>
        </div>
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}
      <button
        onClick={onCreate}
        disabled={creating}
        className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 ${
          creating
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-[#3CDBC0] text-white shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0]'
        }`}
      >
        {creating ? '생성 중...' : '링크 생성하기 →'}
      </button>
    </div>
  );
}
