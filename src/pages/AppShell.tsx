import { useState } from 'react';
import Home from './Home';
import BottomTabBar, { type TabKey } from '../components/BottomTabBar';
import MyMeetings from './tabs/MyMeetings';
import Discover from './tabs/Discover';
import MintShop from './tabs/MintShop';
import Profile from './tabs/Profile';

// /app 셸 — 홈 탭의 콘텐츠는 항상 추천 플로우(Home)다.
// 탭바를 보여도 되는지는 Home이 onChromeChange로 보고한다(셸은 localStorage를 보지 않는다).
// 탭 상태는 URL에 싣지 않는다(기존 path 라우터를 건드리지 않기 위해).
export default function AppShell() {
  // 카카오 로그인 복귀(/app?tab=profile)에서만 프로필 탭으로 연다.
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'profile' ? 'profile' : 'home'
  );
  const [showTabBar, setShowTabBar] = useState(true);

  return (
    <div className="bg-[#F5FBF8]" style={{ minHeight: 'var(--mint-app-height, 100dvh)' }}>
      {/* 탭 전환 crossfade — key로 재마운트해 150ms opacity 페이드인만 준다.
          가로 슬라이드는 넣지 않는다(과함). 기존 index.css의 fadeIn을 재사용하되
          .animate-fade-in이 animation 단축 속성(0.45s)이라 유틸리티 클래스로는
          지속시간을 못 덮는다 — 인라인으로 150ms만 지정한다.
          opacity 애니메이션은 fixed 자식의 containing block을 바꾸지 않으므로
          Home의 하단 고정 바·토스트는 그대로 동작한다. */}
      <div key={activeTab} className="animate-fade-in" style={{ animationDuration: '150ms' }}>
        {activeTab === 'home' ? (
          <Home onChromeChange={setShowTabBar} />
        ) : (
          <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            {activeTab === 'meetings' && <MyMeetings onGoHome={() => setActiveTab('home')} />}
            {activeTab === 'discover' && <Discover />}
            {activeTab === 'shop' && <MintShop />}
            {activeTab === 'profile' && <Profile />}
          </div>
        )}
      </div>
      {(activeTab !== 'home' || showTabBar) && (
        <BottomTabBar active={activeTab} onChange={setActiveTab} />
      )}
    </div>
  );
}
