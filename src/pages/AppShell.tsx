import { useState } from 'react';
import Home, { INPUT_DRAFT_KEY, GROUP_SESSION_KEY } from './Home';
import { loadResultSnapshot } from '../utils/history';
import BottomTabBar, { type TabKey } from '../components/BottomTabBar';
import HomeTab from './tabs/HomeTab';
import MyMeetings from './tabs/MyMeetings';
import Discover from './tabs/Discover';
import MintShop from './tabs/MintShop';
import Profile from './tabs/Profile';

// /app 셸 — 탭 내비게이션과 추천 플로우(Home)를 분리한다.
// 탭 상태는 URL에 싣지 않는다(기존 path 라우터를 건드리지 않기 위해).
export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  // 결과·입력초안·그룹세션이 남아 있으면 새로고침해도 플로우로 복귀 — 탭바 뒤로 결과가 숨는 회귀 방지
  const [inFlow, setInFlow] = useState<boolean>(() => {
    try {
      if (loadResultSnapshot()) return true;
      if (localStorage.getItem(INPUT_DRAFT_KEY) || sessionStorage.getItem(INPUT_DRAFT_KEY)) return true;
      if (localStorage.getItem(GROUP_SESSION_KEY)) return true;
    } catch { /* ignore */ }
    return false;
  });

  if (inFlow) return <Home onExitFlow={() => setInFlow(false)} />;

  return (
    <div className="bg-[#F5FBF8]" style={{ minHeight: 'var(--mint-app-height, 100dvh)' }}>
      <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {activeTab === 'home' && <HomeTab onStartFlow={() => setInFlow(true)} />}
        {activeTab === 'meetings' && <MyMeetings />}
        {activeTab === 'discover' && <Discover />}
        {activeTab === 'shop' && <MintShop />}
        {activeTab === 'profile' && <Profile />}
      </div>
      <BottomTabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
