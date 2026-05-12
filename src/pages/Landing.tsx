import { useEffect, useRef } from 'react';
import { trackEvent } from '../utils/analytics';

function goToApp() {
  trackEvent('cta_click');
  window.location.pathname = '/app';
}

function PhoneMockup({ src, alt, width = 'w-52' }: { src: string; alt: string; width?: string }) {
  return (
    <div className={`${width} mx-auto bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden`}>
      <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-2 mb-1" />
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}

function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('opacity-100', 'translate-y-0'); },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export default function Landing() {
  useEffect(() => { trackEvent('landing_view'); }, []);

  const s2 = useFadeUp();
  const s3 = useFadeUp();
  const s4 = useFadeUp();
  const s5 = useFadeUp();
  const s6 = useFadeUp();

  return (
    <div className="min-h-screen bg-[#F0FDF9] font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#F0FDF9]/90 backdrop-blur border-b border-teal-100 px-5 py-3 flex items-center justify-between max-w-lg mx-auto">
        <span className="text-xl font-black text-[#36CFA0] tracking-tight">MINT</span>
        <button
          onClick={goToApp}
          className="bg-[#36CFA0] text-white text-sm font-bold px-5 py-2 rounded-full transition-all active:scale-95 hover:bg-[#2AB58C]"
        >
          시작하기 →
        </button>
      </nav>

      <div className="max-w-lg mx-auto">

        {/* ── HERO ── */}
        <section className="text-center px-6 pt-12 pb-10">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-[#36CFA0] text-xs font-bold px-4 py-1.5 rounded-full mb-6">
            ✦ AI 장소 추천 서비스
          </div>
          <h1 className="text-4xl font-black text-gray-800 leading-tight tracking-tight mb-3">
            약속은 잡았는데<br />
            <span className="text-[#36CFA0]">어디 가지?</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mb-8">
            검색어가 없어도 괜찮아요.<br />
            <strong className="text-gray-700">30초 만에 딱 하나</strong>, AI가 골라줍니다.<br />
            <span className="text-sm">서울부터 제주까지, 전국 어디서든.</span>
          </p>
          <button
            onClick={goToApp}
            className="w-full max-w-xs bg-[#36CFA0] text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-teal-200 active:scale-95 transition-all hover:bg-[#2AB58C] mb-6"
          >
            ✨ 지금 바로 시작하기
          </button>
          <div className="flex justify-center gap-8 text-center mb-10">
            <div>
              <div className="text-2xl font-black text-[#36CFA0]">30초</div>
              <div className="text-xs text-gray-400 mt-0.5">추천까지 걸리는 시간</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#36CFA0]">딱 1곳</div>
              <div className="text-xs text-gray-400 mt-0.5">선택 피로 제로</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#36CFA0]">전국</div>
              <div className="text-xs text-gray-400 mt-0.5">서울 · 부산 · 제주</div>
            </div>
          </div>
          <PhoneMockup src="/image/step1.png" alt="출발지 입력 화면" />
        </section>

        {/* ── PROBLEM ── */}
        <section
          ref={s2}
          className="bg-white px-6 py-14 border-y border-gray-100 opacity-0 translate-y-5 transition-all duration-700"
        >
          <p className="text-xs font-bold tracking-widest text-[#36CFA0] mb-3">PROBLEM</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            매번 반복되는 이 대화,<br />익숙하지 않나요?
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            장소 하나 정하는 데 30분. 결국 아무도 안 정해서 맨날 같은 곳.
          </p>

          {/* 카카오톡 목업 */}
          <div className="rounded-2xl overflow-hidden shadow-md">
            <div className="bg-[#3B576E] px-4 py-3 flex items-center gap-2">
              <span className="text-white text-lg">‹</span>
              <span className="text-white text-sm font-bold flex-1 text-center">대학 동기 모임</span>
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
                <div className="bg-[#FEE500] rounded-2xl px-3 py-2 text-sm text-gray-800 shadow-sm">
                  ㅋㅋ 누가 정해줘...
                </div>
                <div className="text-xs text-gray-500 mb-1">오후 2:45</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-teal-50 border border-teal-100 rounded-2xl p-5 text-center">
            <div className="text-4xl font-black text-[#36CFA0]">평균 32분</div>
            <div className="text-sm text-gray-400 mt-1">한국인이 모임 장소 정하는 데 소요되는 시간</div>
          </div>
        </section>

        {/* ── SOLUTION ── */}
        <section
          ref={s3}
          className="px-6 py-14 opacity-0 translate-y-5 transition-all duration-700"
        >
          <p className="text-xs font-bold tracking-widest text-[#36CFA0] mb-3">SOLUTION</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            MINT가<br />이렇게 해결합니다
          </h2>
          <p className="text-sm text-gray-400 mb-10 leading-relaxed">
            한 명만 30초 투자하면 끝.<br />
            선택지 10개가 아니라, <strong className="text-gray-600">딱 1곳</strong>만 추천해요.
          </p>

          <div className="flex flex-col items-center gap-0">
            {/* STEP 1 */}
            <div className="text-center w-full">
              <span className="inline-block bg-[#36CFA0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 1</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">각자 출발지를 입력해요</h3>
              <p className="text-sm text-gray-400 mb-5">동네나 역 이름만 치면 중간 지점을 자동으로 계산합니다</p>
              <PhoneMockup src="/image/step1.png" alt="출발지 입력" />
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#36CFA0] to-transparent my-2" />

            {/* STEP 2 */}
            <div className="text-center w-full">
              <span className="inline-block bg-[#36CFA0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 2</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">목적 · 인원 · 바이브 선택</h3>
              <p className="text-sm text-gray-400 mb-5">밥? 술? 카페? 1차·2차 코스도 한 번에.<br />오늘 분위기에 맞는 조건을 골라요</p>
              <div className="flex gap-3 justify-center">
                <PhoneMockup src="/image/step3.png" alt="목적 선택" width="w-36" />
                <PhoneMockup src="/image/step4.png" alt="바이브 선택" width="w-36" />
              </div>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#36CFA0] to-transparent my-2" />

            {/* STEP 3 */}
            <div className="text-center w-full">
              <span className="inline-block bg-[#36CFA0] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">STEP 3</span>
              <h3 className="text-lg font-black text-gray-800 mb-1">AI가 딱 하나 골라줍니다</h3>
              <p className="text-sm text-gray-400 mb-5">네이버 검증 실존 장소 · 실시간 혼잡도 · 날씨까지 반영.<br />1차→2차 코스, 카카오톡으로 바로 공유!</p>
              <PhoneMockup src="/image/step5.png" alt="AI 추천 결과" />
            </div>
          </div>
        </section>

        {/* ── DIFF ── */}
        <section
          ref={s4}
          className="bg-white px-6 py-14 border-y border-gray-100 opacity-0 translate-y-5 transition-all duration-700"
        >
          <p className="text-xs font-bold tracking-widest text-[#36CFA0] mb-3">WHY MINT?</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            네이버 지도와<br />뭐가 다를까?
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            네이버 지도는 <strong className="text-gray-600">검색어가 있는 사람</strong>을 위한 서비스.<br />
            MINT는 <strong className="text-gray-600">검색어가 없는 사람</strong>을 위한 서비스입니다.
          </p>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🗺️</span>
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
            <div className="rounded-2xl border-2 border-[#36CFA0] bg-teal-50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🍃</span>
                <span className="font-black text-[#36CFA0]">MINT</span>
              </div>
              <ul className="flex flex-col gap-2">
                {['검색어 없이 조건만 선택하면 끝', 'AI가 딱 1곳만 추천 — 로컬 맛집 우선', '전국 어디서든 중간 지점 자동 계산', '혼잡도 · 날씨 · 그룹 규모까지 고려', '카카오톡 한 번이면 공유 완료'].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-800">
                    <span className="text-[#36CFA0] font-bold mt-0.5">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── SHARE ── */}
        <section
          ref={s5}
          className="px-6 py-14 opacity-0 translate-y-5 transition-all duration-700"
        >
          <p className="text-xs font-bold tracking-widest text-[#36CFA0] mb-3">SHARE</p>
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            추천 받자마자<br /><span className="text-[#36CFA0]">카카오톡으로 공유</span>
          </h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            결과 나오면 버튼 하나로 단톡방에 공유.<br />'여기 어때?' 한 줄이면 약속 끝.
          </p>
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {['🍃 조건 선택', '✨ AI 추천', '💬 카톡 공유'].map((tag, i) => (
              <div key={tag} className="flex items-center gap-2">
                <span className="bg-teal-50 border border-teal-200 text-[#36CFA0] text-sm font-bold px-4 py-2 rounded-full">{tag}</span>
                {i < 2 && <span className="text-[#36CFA0] font-bold">→</span>}
              </div>
            ))}
          </div>
          <PhoneMockup src="/image/step5.png" alt="카카오톡 공유" />
          <p className="text-sm text-gray-400 text-center mt-6 leading-relaxed">
            더 이상 '어디로 갈까' 단톡방 폭격 없이,<br />
            <strong className="text-gray-600">한 명이 정하고 모두가 편한</strong> 약속.
          </p>
        </section>

        {/* ── CTA ── */}
        <section
          ref={s6}
          className="px-6 py-16 text-center bg-gradient-to-b from-[#F0FDF9] to-[#E8FBF3] opacity-0 translate-y-5 transition-all duration-700"
        >
          <h2 className="text-2xl font-black text-gray-800 leading-tight mb-3">
            지금 바로<br />30초 만에 해결하세요
          </h2>
          <p className="text-sm text-gray-400 mb-8">무료로 시작하세요. 회원가입도 없어요.</p>
          <button
            onClick={goToApp}
            className="w-full max-w-xs bg-[#36CFA0] text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-teal-200 active:scale-95 transition-all hover:bg-[#2AB58C] mb-6"
          >
            ✨ MINT 시작하기
          </button>
          <div className="flex justify-center gap-5 flex-wrap">
            {['⚡ 30초면 끝', '🤖 AI 추천', '💬 카톡 공유', '🆓 완전 무료'].map((t) => (
              <span key={t} className="text-xs text-gray-400">{t}</span>
            ))}
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">© 2025 MINT. All rights reserved.</p>
      </footer>

    </div>
  );
}
