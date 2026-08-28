import { useEffect, useState } from 'react';
import { IconFeedback } from './icons';

interface Props {
  hidden: boolean;      // 피드백 시트가 열려 있는 동안엔 비운다(언마운트는 하지 않는다 — 아래 주석)
  onOpen: () => void;
}

const HINT_KEY = 'mint_feedback_hint_shown';
const HINT_DELAY_MS = 1200;   // 화면이 자리를 잡은 뒤에 말을 건다
const HINT_LIFE_MS = 4000;    // 읽고 흘려보낼 만큼만

// 우하단 피드백 진입점. AppShell이 탭바를 보여줄 때만 마운트되므로
// 입력 스텝 중·결과 화면·바텀시트가 열린 동안은 규칙 하나로 알아서 사라진다.
// 왼쪽이 아니라 오른쪽인 이유: 폰을 한 손으로 쥐면 엄지가 가장 편하게 닿는 구석이 오른쪽 아래고,
// 떠 있는 동그란 말풍선이 거기 있으면 "여기 눌러 말 걸어라"로 이미 읽힌다(다들 그 자리에 둔다).
// 학습 비용 0이어야 피드백이 실제로 쌓인다.
// 컬럼(max-w-md)에 붙이는 이유: 앱 콘텐츠가 전부 가운데 컬럼이라 뷰포트 구석에 붙이면
// 데스크톱에서 혼자 화면 끝으로 떨어져 나간다.
export default function FeedbackFab({ hidden, onOpen }: Props) {
  const [scrolling, setScrolling] = useState(false);
  const [hint, setHint] = useState(false);

  // 스크롤 중에는 살짝 물러난다. 치우지는 않되 읽기를 방해하지 않는 최소한의 예의.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      setScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 350);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 최초 힌트 툴팁 — 평생 1회. 반복 노출은 구걸처럼 보인다.
  // 자동 소멸이든 화면 터치든, 사라지는 순간 기록한다(본 적 있다는 사실이 중요하지 방법은 상관없다).
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      return; // localStorage를 못 쓰는 환경이면 힌트도 포기한다(매번 뜨는 게 더 나쁘다)
    }

    let alive = false;
    const dismiss = () => {
      if (!alive) return;
      alive = false;
      setHint(false);
      window.removeEventListener('pointerdown', dismiss);
    };
    const showTimer = setTimeout(() => {
      alive = true;
      setHint(true);
      // "봤다"는 기록은 소멸이 아니라 노출 시점에 남긴다. 이 FAB은 탭바와 함께 조건부로
      // 마운트돼서, 힌트가 떠 있는 동안 입력 스텝으로 들어가면 언마운트되며 dismiss가 안 불린다.
      // 소멸 시점에 기록했더니 그때마다 키가 안 남아 툴팁이 계속 다시 떴다.
      try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
      window.addEventListener('pointerdown', dismiss);
    }, HINT_DELAY_MS);
    const hideTimer = setTimeout(dismiss, HINT_DELAY_MS + HINT_LIFE_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, []);

  return (
    // 시트가 열려도 언마운트하지 않는 이유: 닫을 때 포커스를 이 버튼으로 돌려줘야 한다.
    // 대신 투명하게 비우고 탭 순서에서 뺀다(시트의 포커스 트랩과 싸우지 않게).
    <div
      className="pointer-events-none fixed inset-x-0 z-40"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      {/* 힌트가 버튼 왼쪽에 서고 둘이 오른쪽 끝으로 정렬된다 — 꼬리도 따라서 오른쪽을 본다. */}
      <div className="mx-auto flex max-w-md items-center justify-end gap-2 px-4">
        {hint && !hidden && (
          <span
            role="status"
            className="relative animate-fade-in-up rounded-2xl bg-[#1A7A6E] px-3.5 py-2 text-xs font-bold text-white shadow-lg"
          >
            어떤 피드백이든 남겨주세요!
            <span
              aria-hidden
              className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-[#1A7A6E]"
            />
          </span>
        )}

        <button
          onClick={onOpen}
          aria-label="피드백 남기기"
          tabIndex={hidden ? -1 : 0}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3CDBC0] to-[#2AB5A0] text-white shadow-lg shadow-[#2AB5A0]/30 transition-[opacity,transform] duration-200 ${
            hidden ? 'opacity-0' : 'pointer-events-auto'
          } ${!hidden && scrolling ? 'scale-90 opacity-50' : ''} active:scale-95`}
        >
          <IconFeedback className="h-[22px] w-[22px]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
