import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import AppSplash from './components/AppSplash';

// 페이지별 코드 스플리팅 — 랜딩만 보는 방문자가 Home/Admin 번들까지 받지 않도록
const loadHome = () => import('./pages/Home');
const Home = lazy(loadHome);
const Landing = lazy(() => import('./pages/Landing'));
const SharedResult = lazy(() => import('./pages/SharedResult'));
const Admin = lazy(() => import('./pages/Admin'));
const MemberInput = lazy(() => import('./pages/MemberInput'));
const Pilot = lazy(() => import('./pages/Pilot'));
const PilotAdmin = lazy(() => import('./pages/PilotAdmin'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>😓</p>
          <p style={{ fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>페이지를 불러오지 못했어요</p>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>{(this.state.error as Error).message}</p>
          <button onClick={() => window.location.reload()} style={{ background: '#36CFA0', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 24px', fontWeight: 'bold', cursor: 'pointer' }}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoading() {
  return (
    <div className="min-h-screen bg-[#F5FBF8] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#3CDBC0] border-t-transparent rounded-full animate-spin-slow" />
    </div>
  );
}

const APP_SPLASH_SESSION_KEY = 'mint_app_splash_seen_v1';

function AppHome() {
  const isGroupReturn = new URLSearchParams(window.location.search).has('grp');
  const [showSplash, setShowSplash] = useState(() => {
    if (isGroupReturn) return false;
    try {
      return sessionStorage.getItem(APP_SPLASH_SESSION_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!showSplash) return;

    // 오프닝이 재생되는 동안 실제 앱 번들을 미리 받아 전환을 매끄럽게 한다.
    void loadHome();
    try {
      sessionStorage.setItem(APP_SPLASH_SESSION_KEY, '1');
    } catch { /* 저장소 접근이 막힌 웹뷰에서는 현재 진입에만 표시 */ }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitTimer = window.setTimeout(() => setExiting(true), reducedMotion ? 350 : 1800);
    const finishTimer = window.setTimeout(() => setShowSplash(false), reducedMotion ? 550 : 2250);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [showSplash]);

  if (showSplash) return <AppSplash exiting={exiting} />;
  return <Home />;
}

function Router() {
  const path = window.location.pathname;
  if (path === '/admin') return <Admin />;
  if (path === '/pilot-admin') return <PilotAdmin />;
  if (path === '/pilot') return <Pilot />;
  if (path === '/join') return <MemberInput />;
  if (path === '/shared' || window.location.search.includes('data=')) return <SharedResult />;
  if (path === '/app') return <AppHome />;
  return <Landing />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <Router />
      </Suspense>
    </ErrorBoundary>
  );
}
