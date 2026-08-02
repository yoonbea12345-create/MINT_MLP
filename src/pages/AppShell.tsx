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
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [showTabBar, setShowTabBar] = useState(true);

  return (
    <div className="bg-[#F5FBF8]" style={{ minHeight: 'var(--mint-app-height, 100dvh)' }}>
      {activeTab === 'home' ? (
        <Home onChromeChange={setShowTabBar} />
      ) : (
        <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {activeTab === 'meetings' && <MyMeetings />}
          {activeTab === 'discover' && <Discover />}
          {activeTab === 'shop' && <MintShop />}
          {activeTab === 'profile' && <Profile />}
        </div>
      )}
      {(activeTab !== 'home' || showTabBar) && (
        <BottomTabBar active={activeTab} onChange={setActiveTab} />
      )}
    </div>
  );
}
