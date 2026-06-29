import { useState } from 'react';

interface Props {
  selected: string[];
  onChange: (keys: string[]) => void;
}

export default function KeywordSelect({ selected, onChange }: Props) {
  const [input, setInput] = useState('');

  function addKeyword() {
    const cleaned = input.replace(/#/g, '').trim();
    if (!cleaned || selected.includes(cleaned)) {
      setInput('');
      return;
    }
    onChange([...selected, cleaned]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    } else if (e.key === 'Backspace' && !input && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  }

  function remove(key: string) {
    onChange(selected.filter((k) => k !== key));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">키워드</p>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">선택사항</span>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-2xl px-3 py-2.5 focus-within:border-[#3CDBC0] transition-all min-h-[52px] flex flex-wrap gap-1.5 items-center">
        {selected.map((k) => (
          <span
            key={k}
            className="flex items-center gap-1 bg-[#3CDBC0] text-white text-xs font-bold px-2.5 py-1 rounded-full"
          >
            #{k}
            <button
              type="button"
              onClick={() => remove(k)}
              className="text-white/70 hover:text-white leading-none ml-0.5 text-sm"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addKeyword}
          placeholder={selected.length === 0 ? '#원하는 분위기를 입력해보세요' : ''}
          className="flex-1 min-w-[130px] text-sm outline-none bg-transparent placeholder:text-gray-300 placeholder:text-xs"
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 px-1">
        예) #2030감성 &nbsp;#단체룸 &nbsp;#야외테라스 &nbsp;· Enter로 추가
      </p>
    </div>
  );
}
