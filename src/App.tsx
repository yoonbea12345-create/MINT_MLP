import Home from './pages/Home';
import SharedResult from './pages/SharedResult';
import Admin from './pages/Admin';

export default function App() {
  const path = window.location.pathname;

  if (path === '/admin') return <Admin />;
  if (path === '/shared' || window.location.search.includes('data=')) return <SharedResult />;
  return <Home />;
}
