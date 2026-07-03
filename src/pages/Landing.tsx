import { useEffect, useState } from 'react';
import { trackEvent } from '../utils/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function triggerInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!prompt) return;
    trackEvent('pwa_install_click');
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  const canInstall = !isInstalled && (!!prompt || isIOS);
  return { canInstall, triggerInstall, isIOS, showIOSGuide, setShowIOSGuide };
}

function goToApp() {
  trackEvent('cta_click');
  window.location.pathname = '/app';
}

// ── 히어로 로테이팅 후킹 문구 ──
const TRIGGERS = [
  { type: '친구', text: '"아무데나 좋아" 하다가 결국 아무데도 못 정했다면', color: '#0f8a7e' },
  { type: '연인', text: '데이트 코스 정하다가 싸워본 적 있다면', color: '#e05a7a' },
  { type: '직장', text: '얼떨결에 회식 장소 예약 담당이 되어버렸다면', color: '#3a6ea5' },
  { type: '가족', text: '부모님 모시고 갈 만한 곳이 하나도 안 떠오른다면', color: '#c8881f' },
  { type: '친구', text: '단톡방에서 "어디서 볼까"만 30분째라면', color: '#0f8a7e' },
  { type: '연인', text: '맨날 가던 데만 가서 슬슬 지겨워졌다면', color: '#e05a7a' },
  { type: '직장', text: '다들 사는 곳이 달라 중간지점 계산이 막막하다면', color: '#3a6ea5' },
  { type: '가족', text: '오랜만의 가족 모임, 절대 실패하면 안 된다면', color: '#c8881f' },
];

// ── Toxic 스타일 폰 베젤 목업 ──
function PhoneFrame({ src, alt, highlight = false, maxW = 'max-w-[260px]' }: {
  src: string; alt: string; highlight?: boolean; maxW?: string;
}) {
  return (
    <div className={`${maxW} w-full mx-auto rounded-[2.2rem] overflow-hidden`}
      style={{
        background: '#ffffff',
        border: highlight ? '1.5px solid #2AB5A0' : '1.5px solid #d4e8e2',
        boxShadow: highlight
          ? '0 24px 60px rgba(42,181,160,0.28), 0 0 40px rgba(60,219,192,0.18)'
          : '0 24px 60px rgba(42,181,160,0.16), 0 0 0 1px rgba(42,181,160,0.04)',
      }}>
      <div className="flex justify-center items-center h-[34px] bg-white"><div className="w-16 h-[3px] bg-[#d4e8e2] rounded-full" /></div>
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
      <div className="flex justify-center items-center h-[30px] bg-white"><div className="w-12 h-[3px] bg-[#d4e8e2] rounded-full" /></div>
    </div>
  );
}

function KakaoTalkBubble({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 108" fill="none">
      <ellipse cx="60" cy="46" rx="58" ry="44" fill="#000"/>
      <text x="60" y="58" textAnchor="middle" fill="#FFE500" fontSize="26" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="-0.5">TALK</text>
      <path d="M 26 84 L 12 107 L 50 86 Z" fill="#000"/>
    </svg>
  );
}

const INK = '#0c2b25';        // 딥 잉크 (헤드라인)
const MINT = '#2AB5A0';       // 메인 민트 (진한 쪽 — 텍스트 대비 확보)
const MINT_BRIGHT = '#3CDBC0';
const SUB = '#5a7a72';        // 서브 텍스트
const FAINT = '#8fa8a1';      // 흐린 텍스트

export default function Landing() {
  useEffect(() => { trackEvent('landing_view'); }, []);
  const { canInstall, triggerInstall, isIOS, showIOSGuide, setShowIOSGuide } = useInstallPrompt();
  const [triggerIdx, setTriggerIdx] = useState(0);

  // 스크롤 페이드업
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('fade-visible'); obs.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.fade-section').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // 후킹 문구 로테이션
  useEffect(() => {
    const t = setInterval(() => setTriggerIdx((i) => (i + 1) % TRIGGERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const trigger = TRIGGERS[triggerIdx];

  const installButton = canInstall && (
    <button
      onClick={triggerInstall}
      className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#2AB5A0] text-[#2AB5A0] font-black text-base py-4 rounded-2xl active:scale-95 transition-all hover:bg-teal-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {isIOS ? '홈 화면에 추가하기' : '앱으로 설치하기'}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F0FDF9] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F0FDF9]/90 backdrop-blur-md border-b border-[#2AB5A0]/10">
        <div className="max-w-xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="font-display text-2xl tracking-tight" style={{ color: MINT_BRIGHT }}>MINT</span>
          <button onClick={goToApp}
            className="text-xs text-white bg-[#2AB5A0] px-5 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all font-bold tracking-wider">
            추천받기 →
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center px-5 pt-24 pb-16 max-w-xl mx-auto">
        <p className="text-xs font-light tracking-widest mb-5" style={{ color: SUB }}>
          AI 만남 장소 큐레이션
        </p>

        <h1 className="font-display leading-[1.02] mb-6" style={{ color: INK, fontSize: 'clamp(3.2rem, 14vw, 6rem)' }}>
          오늘 우리<br />
          어디서<br />
          <span style={{ color: MINT_BRIGHT }}>만날까?</span>
        </h1>

        <div className="mb-1 min-h-[2.2rem]">
          <div key={triggerIdx} className="animate-fade-in flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color: trigger.color, borderColor: `${trigger.color}55` }}>{trigger.type}</span>
            <p className="text-sm leading-relaxed" style={{ color: SUB }}>{trigger.text}</p>
          </div>
        </div>

        <p className="text-base leading-relaxed mb-8" style={{ color: INK }}>
          MINT가 <span className="font-bold" style={{ color: MINT }}>30초 만에 딱 1곳</span> 정해드립니다.
        </p>

        <button onClick={goToApp}
          className="w-full text-white font-display text-xl py-5 rounded-2xl tracking-wide hover:opacity-90 active:scale-95 transition-all cta-glow-mint mb-3"
          style={{ background: 'linear-gradient(90deg, #2AB5A0 0%, #3CDBC0 100%)' }}>
          지금 바로 추천받기 →
        </button>
        {installButton}

        <div className="flex justify-center gap-8 items-end text-center mt-10">
          <div>
            <div className="font-display text-2xl whitespace-nowrap" style={{ color: MINT }}>30초</div>
            <div className="text-xs mt-0.5" style={{ color: FAINT }}>추천까지 걸리는 시간</div>
          </div>
          <div>
            <div className="font-display text-2xl whitespace-nowrap" style={{ color: MINT }}>딱 1곳</div>
            <div className="text-xs mt-0.5" style={{ color: FAINT }}>선택 피로 제로</div>
          </div>
          <div>
            <div className="font-display text-2xl whitespace-nowrap" style={{ color: MINT }}>전국</div>
            <div className="text-xs mt-0.5" style={{ color: FAINT }}>실존 장소 79만 곳</div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          PROBLEM — 카카오톡 실랑이
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-20 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <p className="section-label mb-3" style={{ color: MINT }}>PROBLEM</p>
          <h2 className="font-display mb-3" style={{ color: INK, fontSize: 'clamp(2rem, 8vw, 3rem)' }}>
            매번 반복되는<br /><span style={{ color: MINT_BRIGHT }}>"어디 가지" 실랑이</span>
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: FAINT }}>
            장소 하나 정하는 데 30분. 결국 아무도 안 정해서 맨날 같은 곳.
          </p>

          <div className="rounded-2xl overflow-hidden shadow-md">
            <div className="bg-[#3B576E] px-4 py-3 flex items-center gap-2">
              <span className="text-white text-lg">‹</span>
              <span className="text-white text-sm font-bold flex-1 text-center">화생공 24(4)</span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">4</span>
            </div>
            <div className="bg-[#B2C7D9] p-4 flex flex-col gap-3">
              {[
                { emoji: '😎', name: '민준', msg: '이번주 토요일 다들 되지? 어디서 볼까', time: '오후 2:31' },
                { emoji: '🙂', name: '서연', msg: 'ㅇㅇ 난 아무데나~', time: '오후 2:33' },
                { emoji: '😊', name: '지훈', msg: '나도 다 좋은데.. 어디가 좋으려나', time: '오후 2:35' },
                { emoji: '🤔', name: '수빈', msg: '맛집 아는 사람? 나는 모르겠는데', time: '오후 2:38' },
              ].map((m) => (
                <div key={m.name} className="flex items-end gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gray-300 flex items-center justify-center text-base flex-shrink-0">{m.emoji}</div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">{m.name}</div>
                    <div className="bg-white rounded-2xl px-3 py-2 text-sm text-gray-800 shadow-sm">{m.msg}</div>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{m.time}</div>
                </div>
              ))}
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="bg-[#FEE500] rounded-2xl px-3 py-2 text-sm text-gray-800 shadow-sm">ㅋㅋ 누가 정해줘...</div>
                <div className="text-xs text-gray-500 mb-1">오후 2:45</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white border border-[#2AB5A0]/20 rounded-2xl p-5 text-center">
            <div className="font-display text-4xl" style={{ color: MINT_BRIGHT }}>평균 32분</div>
            <div className="text-sm mt-1" style={{ color: FAINT }}>한국인이 모임 장소 정하는 데 쓰는 시간</div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          RESULT PREVIEW — 이게 실제 결과입니다
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-20 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <h2 className="font-display text-center leading-[1.08] mb-1" style={{ color: INK, fontSize: 'clamp(2.4rem, 10vw, 4rem)' }}>
            이게 실제로
          </h2>
          <h2 className="font-display text-center leading-[1.08] mb-3" style={{ color: INK, fontSize: 'clamp(2.4rem, 10vw, 4rem)' }}>
            나오는 추천입니다
          </h2>
          <p className="text-center text-sm mb-10" style={{ color: FAINT }}>
            네이버 검증 실존 장소 · 적합도 점수 · 실시간 혼잡도 · 1차→2차 도보 동선까지
          </p>

          <PhoneFrame src="/image/landing/result.png" alt="MINT 추천 결과 — 1차 이자카야, 2차 와인바 코스" highlight maxW="max-w-[300px]" />

          <div className="grid grid-cols-3 gap-2 mt-8">
            {[
              { t: '적합도 점수', d: '모임 조건과 얼마나 맞는지 0~100점' },
              { t: '실시간 혼잡도', d: '지금 가면 웨이팅인지 미리 확인' },
              { t: '2차 코스 연결', d: '도보 이동 시간까지 계산된 동선' },
            ].map(({ t, d }) => (
              <div key={t} className="bg-white border border-[#d4e8e2] rounded-2xl p-3 text-center">
                <p className="text-xs font-bold mb-1" style={{ color: INK }}>{t}</p>
                <p className="text-[10px] leading-relaxed" style={{ color: FAINT }}>{d}</p>
              </div>
            ))}
          </div>

          <button onClick={goToApp}
            className="w-full mt-8 text-white font-display text-xl py-5 rounded-2xl tracking-wide hover:opacity-90 active:scale-95 transition-all cta-glow-mint"
            style={{ background: 'linear-gradient(90deg, #2AB5A0 0%, #3CDBC0 100%)' }}>
            내 모임 장소 받아보기 →
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS — 혼자 정하기 4스텝
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-20 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <p className="section-label mb-3" style={{ color: MINT }}>HOW IT WORKS</p>
          <h2 className="font-display text-center mb-14" style={{ color: INK, fontSize: 'clamp(2rem, 8vw, 3.2rem)' }}>
            딱 <span style={{ color: MINT_BRIGHT }}>30초</span>면 됩니다
          </h2>

          {[
            { step: 'STEP 1', title: '모임 정보 입력', desc: '혼자 정할지, 다같이 정할지부터. 인원수와 1차·2차 목적(밥/술/카페)을 골라요.', img: '/image/landing/purpose.png' },
            { step: 'STEP 2', title: '관계 · 특별한 날', desc: '친구·연인·가족·직장동료, 생일·기념일·소개팅까지. "여자친구와 100일 데이트"처럼 직접 써도 돼요.', img: '/image/landing/relation.png' },
            { step: 'STEP 3', title: '지역 선택', desc: '자동 중간지점 찾기로 모두에게 공평하게. 원하는 동네가 있다면 직접 입력해도 OK.', img: '/image/landing/region.png' },
            { step: 'STEP 4', title: '분위기 선택', desc: '시끌벅적? 아늑한? 인스타감성? 1차·2차 분위기를 따로 고를 수 있어요.', img: '/image/landing/vibe.png' },
          ].map(({ step, title, desc, img }, i) => (
            <div key={step}>
              {i > 0 && (
                <div className="flex justify-center my-6">
                  <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, rgba(42,181,160,0.5), transparent)' }} />
                </div>
              )}
              <div className="mb-4">
                <span className="step-badge text-white" style={{ background: MINT }}>{step}</span>
                <p className="text-sm font-bold mb-1" style={{ color: INK }}>{title}</p>
                <p className="text-xs leading-relaxed mb-6" style={{ color: FAINT }}>{desc}</p>
                <PhoneFrame src={img} alt={`${step} ${title}`} />
              </div>
            </div>
          ))}

          <div className="flex justify-center my-6">
            <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, rgba(42,181,160,0.5), transparent)' }} />
          </div>

          <div className="mb-4">
            <span className="step-badge" style={{ background: '#E8F8F5', border: `1px solid ${MINT}`, color: MINT }}>RESULT</span>
            <p className="text-sm font-bold mb-1" style={{ color: INK }}>AI가 딱 하나 골라줍니다</p>
            <p className="text-xs leading-relaxed mb-6" style={{ color: FAINT }}>
              실시간 혼잡도 · 날씨 · 블로그 버즈까지 반영한 최종 1곳. 마음에 안 들면 이유를 골라 다시 추천받을 수 있어요.
            </p>
            <PhoneFrame src="/image/landing/result.png" alt="AI 추천 결과" highlight />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          GROUP — 링크 하나로 다같이
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-20 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="step-badge bg-[#0f8a7e] text-white tracking-widest">GROUP MODE</span>
          </div>
          <h2 className="font-display leading-[1.08] mb-2" style={{ color: INK, fontSize: 'clamp(2.4rem, 9vw, 3.6rem)', wordBreak: 'keep-all' }}>
            한 명이 다 정하는 거,
          </h2>
          <h2 className="font-display leading-[1.08] mb-6" style={{ color: '#0f8a7e', fontSize: 'clamp(2.4rem, 9vw, 3.6rem)', wordBreak: 'keep-all' }}>
            이제 그만.
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: SUB }}>
            링크 하나 만들어 단톡방에 던지면 끝.<br />
            각자 이름·출발지·취향을 입력하면<br />
            <span className="font-bold" style={{ color: '#0f8a7e' }}>모두의 조건을 반영한 장소</span>가 자동으로 나옵니다.
          </p>

          {[
            { step: '01', title: '링크 만들기', desc: '인원수와 코스(1차만 / 1차+2차)만 고르고 링크 생성. 3초면 돼요.', img: '/image/landing/group-create.png' },
            { step: '02', title: '단톡방에 공유', desc: '링크 복사해서 붙여넣기. 입력 현황이 실시간으로 보여요.', img: '/image/landing/group-share.png' },
            { step: '03', title: '각자 이름 · 출발지 입력', desc: '멤버는 링크 열고 이름과 출발지만. 회원가입? 없어요.', img: '/image/landing/join-start.png' },
            { step: '04', title: '원하는 분위기 선택', desc: '시끌벅적, 감성적인, 인스타감성… 각자 몰래 취향을 고릅니다.', img: '/image/landing/join-vibe.png' },
            { step: '05', title: '모이면 자동 추천', desc: '전원 제출되면 모두의 중간지점과 취향을 종합해 장소가 나옵니다.', img: '/image/landing/join-done.png' },
          ].map(({ step, title, desc, img }, i) => (
            <div key={step}>
              {i > 0 && (
                <div className="flex justify-center my-6">
                  <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, rgba(15,138,126,0.5), transparent)' }} />
                </div>
              )}
              <div className="mb-4">
                <span className="step-badge bg-[#0f8a7e] text-white">{step}</span>
                <p className="text-sm font-bold mb-1" style={{ color: INK }}>{title}</p>
                <p className="text-xs leading-relaxed mb-6" style={{ color: FAINT }}>{desc}</p>
                <PhoneFrame src={img} alt={`그룹 모드 ${title}`} />
              </div>
            </div>
          ))}

          <div className="bg-white border-l-[3px] border-[#0f8a7e] rounded-r-2xl pl-6 pr-4 py-5 mt-8">
            <p className="text-sm leading-relaxed mb-1" style={{ color: SUB }}>"난 아무데나 괜찮아"가 진짜였는지</p>
            <p className="text-sm leading-relaxed" style={{ color: INK }}>
              각자 몰래 고른 취향이 <span className="font-bold" style={{ color: '#0f8a7e' }}>1차·2차 분위기에 전부 반영</span>됩니다.
              눈치 게임 없이, 공평하게.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WHY MINT — 비교
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-20 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <p className="section-label mb-1" style={{ color: MINT }}>WHY MINT?</p>
          <p className="text-[10px] mb-6" style={{ color: FAINT }}>지도 앱과 다른 점</p>

          <h2 className="font-display leading-[1.08] mb-2" style={{ color: INK, fontSize: 'clamp(2.4rem, 10vw, 4rem)' }}>
            검색하지 말고
          </h2>
          <h2 className="font-display leading-[1.08] mb-10" style={{ fontSize: 'clamp(2.4rem, 10vw, 4rem)', color: MINT_BRIGHT }}>
            추천받으세요
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="border border-[#d4e8e2] rounded-2xl p-5 bg-white">
              <p className="text-[10px] uppercase tracking-widest mb-6" style={{ color: FAINT }}>기존 지도 앱</p>
              <div className="space-y-3 mb-6">
                {['검색어를 알아야 검색', '결과 수십 개 → 또 고민', '중간지점 직접 계산', '광고 상위 노출'].map((t) => (
                  <div key={t} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5" style={{ color: '#c4d5cf' }}>✕</span>
                    <p className="text-xs line-through" style={{ color: FAINT }}>{t}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: SUB }}>검색어가 있는 사람을<br />위한 도구</p>
            </div>

            <div className="border border-[#2AB5A0]/40 rounded-2xl p-5 relative overflow-hidden"
              style={{ background: '#E8F8F5', boxShadow: '0 0 40px rgba(42,181,160,0.1) inset' }}>
              <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
                style={{ background: 'radial-gradient(circle at top right, rgba(60,219,192,0.3), transparent)' }} />
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-6" style={{ color: MINT }}>MINT</p>
              <div className="space-y-3 mb-6">
                {['조건만 고르면 끝', 'AI가 딱 1곳 추천', '중간지점 자동 계산', '실존 장소 검증'].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: MINT }}>✓</span>
                    <p className="text-xs" style={{ color: INK }}>{t}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: SUB }}>
                뭘 검색할지 모르는 사람을<br /><span className="font-bold" style={{ color: MINT }}>위한 서비스</span>
              </p>
            </div>
          </div>

          <p className="text-center text-xs" style={{ color: SUB }}>
            혼잡도 · 날씨 · 블로그 버즈 · 노포 가산점까지 <span className="font-bold" style={{ color: INK }}>모든 변수를 반영</span>합니다
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════
          페르소나 퀵 셀렉트
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-16 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <p className="section-label text-center mb-1" style={{ color: SUB }}>어떤 모임이든</p>
          <h2 className="font-display text-center mb-8" style={{ color: INK, fontSize: 'clamp(1.8rem, 7vw, 2.8rem)' }}>
            지금 잡혀 있는<br />
            <span style={{ color: MINT_BRIGHT }}>바로 그 약속</span>
          </h2>

          <div className="space-y-3">
            {[
              { badge: '친구 모임', color: '#0f8a7e', title: '"아무데나"의 늪에서 탈출', desc: '중간지점 자동 계산 · 시끌벅적 or 조용하게 · 2차까지 한 번에' },
              { badge: '연인 데이트', color: '#e05a7a', title: '데이트 코스 고민 끝', desc: '기념일 · 100일 · 소개팅 · 분위기 좋은 1차→2차 동선' },
              { badge: '직장 회식', color: '#3a6ea5', title: '예약 담당자의 구원', desc: '단체룸 · 회식 맛집 · 전원 퇴근길 중간지점' },
              { badge: '가족 모임', color: '#c8881f', title: '모두가 만족하는 그 곳', desc: '넓은 공간 · 주차 가능 · 부모님 취향까지 반영' },
            ].map(({ badge, color, title, desc }) => (
              <button key={badge} onClick={goToApp}
                className="w-full text-left border border-[#d4e8e2] rounded-2xl p-5 bg-white card-hover group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[10px] font-semibold border px-2.5 py-1 rounded-full tracking-wide"
                        style={{ color, borderColor: `${color}4d` }}>{badge}</span>
                    </div>
                    <p className="text-sm font-bold mb-1.5" style={{ color: INK }}>{title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: FAINT }}>{desc}</p>
                  </div>
                  <span className="text-lg ml-3 flex-shrink-0 mt-1 transition-colors" style={{ color: '#c4d5cf' }}>→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SHARE — 카톡 공유
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-16 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto text-center">
          <p className="section-label mb-3" style={{ color: MINT }}>SHARE</p>
          <h2 className="font-display mb-3" style={{ color: INK, fontSize: 'clamp(1.8rem, 7vw, 2.8rem)' }}>
            결과는 카톡 한 번으로
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: FAINT }}>
            추천 받자마자 버튼 하나로 단톡방에 공유.<br />'여기 어때?' 한 줄이면 약속 끝.
          </p>
          <div className="flex items-center justify-center gap-2 flex-nowrap">
            <span className="bg-white border border-[#2AB5A0]/30 text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap" style={{ color: MINT }}>🍃 조건 선택</span>
            <span className="font-bold flex-shrink-0" style={{ color: MINT }}>→</span>
            <span className="bg-white border border-[#2AB5A0]/30 text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap" style={{ color: MINT }}>✨ AI 추천</span>
            <span className="font-bold flex-shrink-0" style={{ color: MINT }}>→</span>
            <div className="flex items-center gap-1.5 bg-white border border-[#2AB5A0]/30 text-sm font-bold px-3 py-2 rounded-full whitespace-nowrap flex-shrink-0" style={{ color: MINT }}>
              <KakaoTalkBubble className="w-4 h-4" />
              카톡 공유
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-16 border-t border-[#2AB5A0]/10 fade-section">
        <div className="max-w-xl mx-auto">
          <p className="section-label text-center mb-2" style={{ color: SUB }}>FAQ</p>
          <h2 className="font-display text-center mb-10" style={{ color: INK, fontSize: 'clamp(1.8rem, 7vw, 2.8rem)' }}>
            자주 묻는 질문
          </h2>
          <div className="space-y-3">
            {[
              {
                q: '정말 무료인가요?',
                a: '네. 회원가입도 로그인도 없이 완전 무료입니다. 접속해서 조건만 고르면 바로 추천받을 수 있어요.',
              },
              {
                q: '추천 장소는 믿을 수 있나요?',
                a: '네이버에 등록된 실존 장소만 추천합니다. 여기에 실시간 혼잡도, 날씨, 블로그 버즈, 오래된 가게 가산점까지 반영해 AI가 최종 1곳을 고릅니다.',
              },
              {
                q: '친구들과 어떻게 같이 정하나요?',
                a: '"다같이 정할게요"를 선택해 링크를 만들고 단톡방에 공유하세요. 각자 출발지와 취향을 30초씩 입력하면, 전원의 중간지점과 취향을 종합한 장소가 자동으로 나옵니다.',
              },
              {
                q: '추천이 마음에 안 들면요?',
                a: '"다시 추천받기"에서 이유(비싸요/멀어요/분위기가 아니에요)를 고르면, 그 피드백을 반영해 다른 장소를 추천해드립니다.',
              },
              {
                q: '서울만 되나요?',
                a: '전국을 지원합니다. 전국 79만 곳의 인허가 데이터 기반으로, 어느 지역이든 실존 장소를 추천해드려요.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-[#d4e8e2] rounded-2xl p-5 bg-white">
                <p className="text-sm font-bold mb-3" style={{ color: INK }}>{q}</p>
                <p className="text-sm leading-relaxed" style={{ color: SUB }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <section className="relative px-5 py-28 border-t border-[#2AB5A0]/10 overflow-hidden">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-center leading-[1.05] mb-2" style={{ color: INK, fontSize: 'clamp(3rem, 12vw, 5rem)' }}>
            어디 가지?
          </h2>
          <h2 className="font-display text-center leading-[1.05] mb-8" style={{ fontSize: 'clamp(3rem, 12vw, 5rem)', color: MINT_BRIGHT }}>
            MINT 하지, 뭐.
          </h2>

          <p className="leading-relaxed mb-10" style={{ color: SUB }}>
            무료로 시작하세요. 회원가입도 없어요.
          </p>

          <button onClick={goToApp}
            className="w-full text-white font-display text-2xl py-6 rounded-2xl tracking-wide hover:opacity-90 active:scale-95 transition-all mb-3 cta-glow-mint"
            style={{ background: 'linear-gradient(90deg, #2AB5A0 0%, #3CDBC0 100%)' }}>
            지금 추천받기 →
          </button>
          {installButton}

          <div className="flex justify-center gap-4 flex-wrap mt-6">
            <div className="flex items-center gap-1 text-xs" style={{ color: FAINT }}>
              <svg className="w-3.5 h-3.5" style={{ color: MINT }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2.05V2c0-1.1-.9-2-2-2s-2 .9-2 2v.05C4.6 2.55 1 6.5 1 11.5 1 17.3 5.7 22 11.5 22S22 17.3 22 11.5c0-5-3.6-8.95-9-9.45zM11.5 20C6.81 20 3 16.19 3 11.5S6.81 3 11.5 3 20 6.81 20 11.5 16.19 20 11.5 20zm.5-10.31V7c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .28.11.53.29.71l2 2c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L12 9.69z"/>
              </svg>
              30초면 끝
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: FAINT }}>
              <svg className="w-3.5 h-3.5 text-[#CC785C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
              </svg>
              AI 추천
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: FAINT }}>
              <KakaoTalkBubble className="w-3.5 h-3.5" />
              카톡 공유
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: FAINT }}>
              <svg className="w-3.5 h-3.5" style={{ color: MINT }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              완전 무료
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#2AB5A0]/10 py-12 px-5 bg-white">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
          <span className="font-display text-2xl" style={{ color: MINT_BRIGHT }}>MINT</span>
          <p className="text-xs" style={{ color: FAINT }}>AI 만남 장소 큐레이션</p>
          <div className="w-px h-4 bg-[#d4e8e2]" />
          <p className="text-xs" style={{ color: '#b8ccc6' }}>© 2026 MINT. All rights reserved.</p>
        </div>
      </footer>

      {/* iOS 홈 화면 추가 가이드 모달 */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-black text-gray-800 mb-2">홈 화면에 추가하기</h3>
            <p className="text-sm text-gray-500 mb-5">Safari에서 아래 순서를 따라하면 앱처럼 사용할 수 있어요.</p>
            <div className="flex flex-col gap-3 mb-6">
              {[
                { n: 1, t: 'Safari 하단 공유 버튼 탭', d: '화면 하단 가운데 □↑ 아이콘' },
                { n: 2, t: '홈 화면에 추가 선택', d: '스크롤해서 "홈 화면에 추가" 탭' },
                { n: 3, t: '추가 탭', d: "오른쪽 상단 '추가'를 탭하면 완료!" },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#3CDBC0] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{n}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{t}</p>
                    <p className="text-xs text-gray-400">{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3.5 rounded-2xl bg-[#3CDBC0] text-white font-black text-sm active:scale-95 transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
