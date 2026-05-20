import { Component, type ReactNode } from 'react';
import Home from './pages/Home';
import Landing from './pages/Landing';
import SharedResult from './pages/SharedResult';
import Admin from './pages/Admin';

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

function Router() {
  const path = window.location.pathname;
  if (path === '/admin') return <Admin />;
  if (path === '/shared' || window.location.search.includes('data=')) return <SharedResult />;
  if (path === '/app' || path === '/') return <Home />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  );
}
