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

// ── 히어로: 앱 입력 조합 로테이션 (조건 → 결과의 마법을 미리 보여주기) ──
const COMBOS = [
  { chips: ['🍻 술', '시끌벅적', '성수'], result: '아키야마 성수본점' },
  { chips: ['🍜 밥', '검증된 곳', '선릉'], result: '농민백암순대 본점' },
  { chips: ['☕ 카페', '인스타감성', '연남'], result: '카페 레이어드 연남점' },
  { chips: ['💕 100일 데이트', '야경맛집', '성수'], result: '성수옥상' },
  { chips: ['🏢 회식', '단체 가능', '용산'], result: '몽탄' },
];

function PhoneMockup({ src, alt, width = 'w-56' }: { src: string; alt: string; width?: string }) {
  return (
    <div className={`${width} mx-auto bg-white rounded-3xl shadow-xl shadow-teal-100 border-2 border-gray-100 overflow-hidden`}>
      <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-2 mb-1" />
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
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

export default function Landing() {
  useEffect(() => { trackEvent('landing_view'); }, []);
  const { canInstall, triggerInstall, isIOS, showIOSGuide, setShowIOSGuide } = useInstallPrompt();
  const [comboIdx, setComboIdx] = useState(0);

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

  // 히어로 조합 로테이션
  useEffect(() => {
    const t = setInterval(() => setComboIdx((i) => (i + 1) % COMBOS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const combo = COMBOS[comboIdx];

  const installButton = canInstall && (
    <button
      onClick={triggerInstall}
      className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#3CDBC0] text-[#2AB5A0] font-black text-base py-4 rounded-2xl active:scale-95 transition-all hover:bg-teal-50"
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
    <div className="min-h-screen bg-[#F0FDF9]">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-[#F0FDF9]/90 backdrop-blur border-b border-teal-100">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          <span className="text-xl font-black text-[#3CDBC0] tracking-tight">MINT</span>
          <button
            onClick={goToApp}
            className="bg-[#3CDBC0] text-white text-sm font-bold px-5 py-2 rounded-full transition-all active:scale-95 hover:bg-[#2AB5A0]"
          >
            시작하기 →
          </button>
        </div>
      </nav>

      <div className="max-w-lg mx-auto">

        {/* ══════════════════════════════════════
            HERO — 조건 조합이 결과로 바뀌는 마법
        ══════════════════════════════════════ */}
        <section className="text-center px-6 pt-12 pb-12">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-[#2AB5A0] text-xs font-bold px-4 py-1.5 rounded-full mb-6">
            ✦ AI 만남 장소 큐레이션
          </div>
          <h1 className="text-4xl font-black text-gray-800 leading-tight mb-3">
            약속은 잡았는데<br />
            <span className="text-[#3CDBC0]">어디 가지?</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mb-7">
            검색하지 마세요. 고르기만 하세요.<br />
            <strong className="text-gray-700">30초 만에 딱 1곳</strong>, 이 모임에 맞는 장소가 나옵니다.
          </p>

          {/* 조건 → 결과 로테이션 데모 */}
          <div className="bg-white border border-teal-100 rounded-3xl p-4 shadow-sm mb-7 min-h-[104px] flex flex-col justify-center">
            <div key={comboIdx} className="animate-fade-in">
              <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2.5">
                {combo.chips.map((c) => (
                  <span key={c} className="bg-[#E8F8F5] text-[#2AB5A0] text-xs font-bold px-3 py-1.5 rounded-full">{c}</span>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-300">↓</span>
                <a
                  href={`https://map.kakao.com/link/search/${encodeURIComponent(combo.result)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent('landing_demo_place_click')}
                  className="flex items-center gap-1 font-black text-gray-800 underline decoration-[#3CDBC0] decoration-2 underline-offset-4 active:scale-95 transition-transform"
                >
                  <svg className="w-3.5 h-3.5 text-[#3CDBC0] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {combo.result}
                </a>
                <span className="bg-[#3CDBC0] text-white text-[10px] font-black px-2 py-0.5 rounded-full">적합도 90+</span>
              </div>
              <p className="text-[10px] text-gray-300 mt-1.5">장소를 누르면 카카오맵에서 확인할 수 있어요</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs mb-8 mx-auto">
            <button
              onClick={goToApp}
              className="w-full bg-gradient-to-r from-[#3CDBC0] to-[#2AB5A0] text-white font-black text-lg py-4 rounded-2xl cta-glow-mint active:scale-95 transition-all"
            >
              지금 바로 추천받기
            </button>
            {installButton}
          </div>

          <div className="flex justify-center gap-8 items-end text-center">
            <div>
              <div className="text-2xl font-black text-[#3CDBC0] whitespace-nowrap">30초</div>
              <div className="text-xs text-gray-400 mt-0.5">추천까지 걸리는 시간</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#3CDBC0] whitespace-nowrap">딱 1곳</div>
              <div className="text-xs text-gray-400 mt-0.5">선택 피로 제로</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#3CDBC0] whitespace-nowrap">79만 곳</div>
              <div className="text-xs text-gray-400 mt-0.5">전국 실존 장소 검증</div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            PROBLEM — 카카오톡 실랑이
        ══════════════════════════════════════ */}
        <section className="bg-white px-6 py-14 border-y border-gray-100 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">PROBLEM</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            매번 반복되는 이 대화,<br />익숙하지 않나요?
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
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

          <div className="mt-6 bg-teal-50 border border-teal-100 rounded-2xl p-5 text-center">
            <div className="text-4xl font-black text-[#3CDBC0]">평균 32분</div>
            <div className="text-sm text-gray-400 mt-1">한국인이 모임 장소 정하는 데 쓰는 시간</div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            RESULT PREVIEW — 결과부터 보여주기
        ══════════════════════════════════════ */}
        <section className="px-6 py-14 text-center fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">RESULT</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            조건만 골랐을 뿐인데,<br />이런 결과가 나와요
          </h2>
          <p className="text-sm text-gray-400 mb-8 leading-relaxed">
            네이버 검증 실존 장소 · 적합도 점수 · 실시간 혼잡도<br />1차→2차 도보 동선까지 한 화면에
          </p>

          <PhoneMockup src="/image/landing/result.png" alt="MINT 추천 결과 — 1차 이자카야, 2차 와인바 코스" width="w-64" />

          <div className="grid grid-cols-3 gap-2 mt-8">
            {[
              { e: '🎯', t: '적합도 점수', d: '조건과 얼마나 맞는지 한눈에' },
              { e: '🚦', t: '실시간 혼잡도', d: '지금 웨이팅인지 미리 확인' },
              { e: '🚶', t: '2차 코스 연결', d: '도보 시간까지 계산된 동선' },
            ].map(({ e, t, d }) => (
              <div key={t} className="bg-white border border-gray-100 rounded-2xl p-3">
                <div className="text-xl mb-1">{e}</div>
                <p className="text-xs font-bold text-gray-800 mb-0.5">{t}</p>
                <p className="text-[10px] text-gray-400 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS — 3스텝 (혼자 정하기)
        ══════════════════════════════════════ */}
        <section className="bg-white px-6 py-14 border-y border-gray-100 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">HOW IT WORKS</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            고르기만 하면<br />끝나는 3스텝
          </h2>
          <p className="text-sm text-gray-400 mb-10 leading-relaxed">
            검색어를 몰라도 돼요. 전부 선택지로 준비되어 있으니까요.
          </p>

          <div className="flex flex-col items-center gap-0">
            <div className="text-center w-full">
              <span className="inline-block bg-[#3CDBC0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 1</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">어떤 모임인지 골라요</h3>
              <p className="text-sm text-gray-400 mb-5">인원수, 1차·2차 목적(밥/술/카페)까지 터치 몇 번이면 끝</p>
              <PhoneMockup src="/image/landing/purpose.png" alt="모임 목적 선택" />
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#3CDBC0] to-transparent my-2" />

            <div className="text-center w-full">
              <span className="inline-block bg-[#3CDBC0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 2</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">누구와, 어디서 만나는지</h3>
              <p className="text-sm text-gray-400 mb-5">
                기념일·소개팅 같은 특별한 날도, 중간지점 계산도 알아서.<br />
                "여자친구와 100일 데이트"처럼 직접 써도 돼요
              </p>
              <div className="flex gap-3 justify-center">
                <PhoneMockup src="/image/landing/relation.png" alt="관계·특별한 날 선택" width="w-44" />
                <PhoneMockup src="/image/landing/region.png" alt="지역 선택" width="w-44" />
              </div>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#3CDBC0] to-transparent my-2" />

            <div className="text-center w-full">
              <span className="inline-block bg-[#3CDBC0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 3</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">원하는 분위기를 고르면</h3>
              <p className="text-sm text-gray-400 mb-5">시끌벅적? 아늑한? 인스타감성?<br />1차·2차 분위기를 따로 고를 수 있어요</p>
              <PhoneMockup src="/image/landing/vibe.png" alt="분위기 선택" />
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#3CDBC0] to-transparent my-2" />

            <div className="text-center w-full">
              <span className="inline-block bg-white border-2 border-[#3CDBC0] text-[#2AB5A0] text-xs font-black px-3 py-1 rounded-full mb-3">✨ RESULT</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">AI가 딱 하나 골라줍니다</h3>
              <p className="text-sm text-gray-400 mb-5">
                혼잡도 · 날씨 · 블로그 버즈까지 반영한 최종 1곳.<br />
                마음에 안 들면 이유를 골라 다시 추천받으세요
              </p>
              <PhoneMockup src="/image/landing/result.png" alt="AI 추천 결과" />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            GROUP MODE — 가로 스와이프 갤러리
        ══════════════════════════════════════ */}
        <section className="py-14 fade-section overflow-hidden">
          <div className="px-6">
            <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">GROUP MODE</p>
            <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
              다같이 정할 땐<br /><span className="text-[#3CDBC0]">링크 하나면 돼요</span>
            </h2>
            <p className="text-sm text-gray-400 mb-2 leading-relaxed">
              한 명이 총대 메던 시대는 끝.<br />
              각자 30초씩 입력하면<br />
              <strong className="text-gray-600">모두의 중간지점과 취향</strong>을 종합해 자동으로 나옵니다.
            </p>
            <p className="text-xs text-[#2AB5A0] font-bold mb-6">옆으로 넘겨보세요 →</p>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-6 pb-2">
            {[
              { n: '1', title: '링크 만들기', desc: '인원수·코스만 고르면 3초 완성', img: '/image/landing/group-create.png' },
              { n: '2', title: '단톡방에 공유', desc: '입력 현황이 실시간으로 보여요', img: '/image/landing/group-share.png' },
              { n: '3', title: '각자 이름·출발지', desc: '멤버는 회원가입 없이 링크만 열면 끝', img: '/image/landing/join-start.png' },
              { n: '4', title: '취향은 몰래', desc: '눈치 안 보고 각자 원하는 분위기 선택', img: '/image/landing/join-vibe.png' },
              { n: '5', title: '모이면 자동 추천', desc: '전원 제출 → 종합해서 딱 1곳', img: '/image/landing/join-done.png' },
            ].map(({ n, title, desc, img }) => (
              <div key={n} className="snap-center flex-shrink-0 w-60">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#3CDBC0] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{n}</span>
                  <span className="text-sm font-black text-gray-800">{title}</span>
                </div>
                <PhoneMockup src={img} alt={`그룹 모드 ${title}`} width="w-full" />
                <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="px-6 mt-6">
            <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600 leading-relaxed">
                "난 아무데나 괜찮아"가 진짜였는지,<br />
                <strong className="text-[#2AB5A0]">몰래 고른 취향이 결과에 전부 반영</strong>됩니다. 눈치 게임 없이, 공평하게.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            WHY MINT — 비교
        ══════════════════════════════════════ */}
        <section className="bg-white px-6 py-14 border-y border-gray-100 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">WHY MINT?</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            네이버 지도와<br />뭐가 다를까?
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            지도 앱은 <strong className="text-gray-600">검색어가 있는 사람</strong>을 위한 도구.<br />
            MINT는 <strong className="text-gray-600">뭘 검색할지 모르는 사람</strong>을 위한 서비스입니다.
          </p>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span className="font-black text-gray-400">기존 지도 앱</span>
              </div>
              <ul className="flex flex-col gap-2">
                {['검색어를 알아야 검색 가능', '결과 수십 개 → 또 고민', '중간 지점? 내가 계산해야 함', '광고성 상위 노출 — 진짜 맛집인지 모름'].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-gray-300 mt-0.5">✕</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-[#3CDBC0] bg-teal-50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-[#3CDBC0] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-black leading-none">M</span>
                </div>
                <span className="font-black text-[#2AB5A0]">MINT</span>
              </div>
              <ul className="flex flex-col gap-2">
                {[
                  '검색어 없이 조건만 선택하면 끝',
                  'AI가 딱 1곳만 추천 — 선택 피로 제로',
                  '중간지점 자동 계산, 혼자든 다같이든',
                  '전국 79만 실존 장소 · 혼잡도 · 날씨 · 버즈 반영',
                  '카카오톡 한 번이면 공유 완료',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-800">
                    <span className="text-[#2AB5A0] font-bold mt-0.5">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            USE CASES — 이모지 타일 2×2
        ══════════════════════════════════════ */}
        <section className="px-6 py-14 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3 text-center">FOR EVERY 모임</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-8 text-center">
            지금 잡혀 있는<br />바로 그 약속부터
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { e: '🍻', t: '친구 모임', d: '"아무데나"의 늪 탈출, 2차까지 한 번에' },
              { e: '💕', t: '연인 데이트', d: '기념일 · 100일 · 분위기 좋은 코스' },
              { e: '🏢', t: '직장 회식', d: '단체룸 · 전원 퇴근길 중간지점' },
              { e: '👨‍👩‍👧', t: '가족 모임', d: '넓은 공간 · 주차 · 부모님 취향까지' },
            ].map(({ e, t, d }) => (
              <button key={t} onClick={goToApp}
                className="vibe-card bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm hover:border-[#3CDBC0] hover:shadow-md">
                <div className="text-3xl mb-2">{e}</div>
                <p className="text-sm font-black text-gray-800 mb-1">{t}</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">{d}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            SHARE — 카톡 공유 플로우
        ══════════════════════════════════════ */}
        <section className="bg-white px-6 py-14 border-y border-gray-100 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3">SHARE</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            추천 받자마자<br />
            <span className="text-[#3CDBC0]">카카오톡으로 공유</span>
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            결과 나오면 버튼 하나로 단톡방에 공유.<br />'여기 어때?' 한 줄이면 약속 끝.
          </p>
          <div className="flex items-center justify-center gap-2 flex-nowrap">
            <span className="bg-teal-50 border border-teal-200 text-[#2AB5A0] text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap">🍃 조건 선택</span>
            <span className="text-[#3CDBC0] font-bold flex-shrink-0">→</span>
            <span className="bg-teal-50 border border-teal-200 text-[#2AB5A0] text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap">✨ AI 추천</span>
            <span className="text-[#3CDBC0] font-bold flex-shrink-0">→</span>
            <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-[#2AB5A0] text-sm font-bold px-3 py-2 rounded-full whitespace-nowrap flex-shrink-0">
              <KakaoTalkBubble className="w-4 h-4" />
              카톡 공유
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FAQ
        ══════════════════════════════════════ */}
        <section className="px-6 py-14 fade-section">
          <p className="text-xs font-bold tracking-widest text-[#3CDBC0] mb-3 text-center">FAQ</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-8 text-center">
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
              <div key={q} className="bg-white border border-gray-100 rounded-2xl p-5">
                <p className="text-sm font-black text-gray-800 mb-2">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════ */}
        <section className="px-6 py-16 text-center bg-gradient-to-b from-[#F0FDF9] to-[#E8FBF3] fade-section">
          <h2 className="text-3xl font-black text-gray-800 leading-tight mb-1">어디 가지?</h2>
          <h2 className="text-3xl font-black text-[#3CDBC0] leading-tight mb-4">MINT 하지, 뭐.</h2>
          <p className="text-sm text-gray-400 mb-8">무료로 시작하세요. 회원가입도 없어요.</p>
          <div className="flex flex-col gap-3 w-full max-w-xs mb-6 mx-auto">
            <button
              onClick={goToApp}
              className="w-full bg-gradient-to-r from-[#3CDBC0] to-[#2AB5A0] text-white font-black text-lg py-4 rounded-2xl cta-glow-mint active:scale-95 transition-all"
            >
              지금 바로 추천받기
            </button>
            {installButton}
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-[#3CDBC0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2.05V2c0-1.1-.9-2-2-2s-2 .9-2 2v.05C4.6 2.55 1 6.5 1 11.5 1 17.3 5.7 22 11.5 22S22 17.3 22 11.5c0-5-3.6-8.95-9-9.45zM11.5 20C6.81 20 3 16.19 3 11.5S6.81 3 11.5 3 20 6.81 20 11.5 16.19 20 11.5 20zm.5-10.31V7c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .28.11.53.29.71l2 2c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L12 9.69z"/>
              </svg>
              30초면 끝
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-[#CC785C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
              </svg>
              AI 추천
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <KakaoTalkBubble className="w-3.5 h-3.5" />
              카톡 공유
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-[#3CDBC0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              완전 무료
            </div>
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">© 2026 MINT. All rights reserved.</p>
      </footer>

      {/* iOS 홈 화면 추가 가이드 모달 */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
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
