import { useState, useRef, useEffect } from 'react';
import { searchAddress } from '../services/kakaoMap';
import type { KakaoPlace } from '../services/kakaoMap';

export interface LocationEntry {
  name: string;
  lat?: number;
  lng?: number;
}

interface Props {
  locations: LocationEntry[];
  onChange: (locations: LocationEntry[]) => void;
}

interface InputState {
  value: string;
  suggestions: KakaoPlace[];
  loading: boolean;
  selected: boolean;
}

export default function LocationInput({ locations, onChange }: Props) {
  const [inputs, setInputs] = useState<InputState[]>(
    locations.length >= 2
      ? locations.map((l) => ({ value: l.name, suggestions: [], loading: false, selected: true }))
      : [
          { value: '', suggestions: [], loading: false, selected: false },
          { value: '', suggestions: [], loading: false, selected: false },
        ]
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function update(index: number, partial: Partial<InputState>) {
    setInputs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  }

  function addInput() {
    setInputs((prev) => [
      ...prev,
      { value: '', suggestions: [], loading: false, selected: false },
    ]);
  }

  function removeInput(index: number) {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleChange(index: number, value: string) {
    update(index, { value, selected: false, suggestions: [] });
    clearTimeout(timers.current[index]);
    if (value.length < 1) return;
    update(index, { loading: true });
    timers.current[index] = setTimeout(async () => {
      try {
        const results = await searchAddress(value);
        update(index, { suggestions: results.slice(0, 5), loading: false });
      } catch {
        update(index, { loading: false });
      }
    }, 350);
  }

  function selectPlace(index: number, place: KakaoPlace) {
    update(index, {
      value: place.place_name,
      suggestions: [],
      selected: true,
      loading: false,
    });
  }

  useEffect(() => {
    const selected = inputs
      .filter((i) => i.selected && i.value)
      .map((i) => ({ name: i.value }));
    onChange(selected);
  }, [inputs]);

  const canAdd = inputs.length < 6;

  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="text-center mb-2">
        <p className="text-sm text-gray-500">각자 출발하는 동네나 역을 입력해요</p>
      </div>
      {inputs.map((inp, i) => (
        <div key={i} className="relative animate-fade-in-up">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-3 flex items-center">
                <span className="text-[#3CDBC0] text-sm font-bold">{i + 1}</span>
              </div>
              <input
                type="text"
                value={inp.value}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={i === 0 ? '예: 성수역, 합정역...' : '예: 강남역, 이태원...'}
                className={`w-full pl-8 pr-10 py-3.5 rounded-xl border-2 text-sm outline-none transition-all duration-200 bg-white ${
                  inp.selected
                    ? 'border-[#3CDBC0] bg-[#E8F8F5]'
                    : 'border-gray-200 focus:border-[#3CDBC0]'
                }`}
              />
              {inp.loading && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <div className="w-4 h-4 border-2 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
                </div>
              )}
              {inp.selected && !inp.loading && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <span className="text-[#3CDBC0]">✓</span>
                </div>
              )}
            </div>
            {inputs.length > 2 && (
              <button
                onClick={() => removeInput(i)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            )}
          </div>

          {inp.suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {inp.suggestions.map((place) => (
                <button
                  key={place.id}
                  onMouseDown={() => selectPlace(i, place)}
                  className="w-full text-left px-4 py-3 hover:bg-[#E8F8F5] transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="text-sm font-medium text-gray-800">{place.place_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{place.road_address_name || place.address_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {canAdd && (
        <button
          onClick={addInput}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#3CDBC0] text-[#3CDBC0] text-sm font-medium hover:bg-[#E8F8F5] transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          출발지 추가
        </button>
      )}
    </div>
  );
}
