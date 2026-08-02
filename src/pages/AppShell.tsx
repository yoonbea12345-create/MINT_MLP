import { useState } from 'react';
import Home from './Home';
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
  // 플로우로 바로 복귀하는 경우는 둘뿐이다.
  // 입력 초안·그룹 세션은 일부러 보지 않는다 — 초안은 '혼자/다같이'를 누르는 순간 저장돼 6시간 남으므로,
  // 그걸 근거로 삼으면 한 번이라도 플로우에 들어간 사용자는 탭바를 영영 못 본다.
  // 초안·그룹 세션은 CTA로 재진입할 때 Home이 알아서 복원하니 잃는 것도 없다.
  const [inFlow, setInFlow] = useState<boolean>(() => {
    try {
      // 게스트 입력을 받은 호스트가 /app?grp=로 돌아오는 딥링크 — 곧장 들어가야 자동 추천이 이어진다
      if (new URLSearchParams(window.location.search).has('grp')) return true;
      // 보던 결과가 살아 있으면(24h TTL) 새로고침해도 그대로 — 결과가 탭바 뒤로 숨지 않게
      if (loadResultSnapshot()) return true;
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
