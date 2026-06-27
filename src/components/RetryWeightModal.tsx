import { useState } from 'react';
import type { VibeState } from './VibeSelect';
import { VIBE_KEY_TO_LABEL } from './VibeSelect';

export type VibeWeights = Record<string, number>;

interface Props {
  vibe: VibeState;
  budget: string | null;
  onRetryImmediate: () => void;
  onRetryWithWeights: (weights: VibeWeights) => void;
  onClose: () => void;
}

const WEIGHT_LABELS: Record<number, string> = {
  1: '거의 무시',
  2: '낮음',
  3: '보통',
  4: '중요',
  5: '최우선',
};

export default function RetryWeightModal({ vibe, budget, onRetryImmediate, onRetryWithWeights, onClose }: Props) {
  const selectedVibes: { key: string; label: string }[] = [];
  Object.values(vibe).forEach((g) => {
    if (g.first) selectedVibes.push({ key: g.first, label: VIBE_KEY_TO_LABEL[g.first] ?? g.first });
    if (g.second) selectedVibes.push({ key: g.second, label: VIBE_KEY_TO_LABEL[g.second] ?? g.second });
  });

  const initialWeights: VibeWeights = Object.fromEntries(selectedVibes.map((v) => [v.key, 3]));
  if (budget) initialWeights[`budget:${budget}`] = 3;

  const [weights, setWeights] = useState<VibeWeights>(initialWeights);

  const hasItems = selectedVibes.length > 0 || !!budget;

  function setWeight(key: string, val: number) {
    setWeights((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <button
          onClick={onRetryImmediate}
          className="w-full py-3.5 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-600 font-bold text-sm mb-5 hover:border-[#3CDBC0] hover:text-[#2AB5A0] transition-all active:scale-95"
        >
          슬라이더 조절 없이 바로 재추천
        </button>

        {hasItems && (
          <>
            <h3 className="text-base font-black text-gray-800 mb-0.5">취향 가중치 조정</h3>
            <p className="text-xs text-gray-400 mb-5">높을수록 AI가 더 우선해서 반영해요</p>

            <div className="flex flex-col gap-5 mb-6">
              {selectedVibes.map((v) => (
                <SliderRow
                  key={v.key}
                  label={v.label}
                  value={weights[v.key] ?? 3}
                  onChange={(val) => setWeight(v.key, val)}
                />
              ))}
              {budget && (
                <SliderRow
                  label={`예산 ${budget}`}
                  value={weights[`budget:${budget}`] ?? 3}
                  onChange={(val) => setWeight(`budget:${budget}`, val)}
                />
              )}
            </div>

            <button
              onClick={() => onRetryWithWeights(weights)}
              className="w-full py-4 rounded-2xl bg-[#3CDBC0] text-white font-black text-base shadow-lg shadow-[#3CDBC0]/30 hover:bg-[#2AB5A0] transition-all active:scale-95"
            >
              이 가중치로 재추천받기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        <span className="text-xs font-black text-[#2AB5A0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">
          {WEIGHT_LABELS[value]}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#3CDBC0]"
      />
      <div className="flex justify-between text-[10px] text-gray-300 mt-1">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
      </div>
    </div>
  );
}
