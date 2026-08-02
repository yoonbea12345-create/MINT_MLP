import { trackEvent } from '../utils/analytics';
import { getDeviceId } from '../utils/points';

export type TabKey = 'home' | 'meetings' | 'discover' | 'shop' | 'profile';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const SIDE_TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: '홈' },
  { key: 'meetings', icon: '📅', label: '내 모임' },
  { key: 'shop', icon: '🎁', label: '민트샵' },
  { key: 'profile', icon: '👤', label: '프로필' },
];

// 하단 탭바 — 가운데 '발굴'만 바 위로 튀어나온 FAB(핵심 액션 강조)
export default function BottomTabBar({ active, onChange }: Props) {
  function go(tab: TabKey) {
    onChange(tab);
    trackEvent('tab_click', { device_id: getDeviceId(), tab });
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-md grid grid-cols-5 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {SIDE_TABS.slice(0, 2).map((t) => (
          <TabButton key={t.key} tab={t} active={active === t.key} onClick={() => go(t.key)} />
        ))}

        {/* 가운데 발굴 FAB */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => go('discover')}
            aria-label="발굴"
            className={`absolute -top-6 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-full text-white shadow-lg shadow-[#3CDBC0]/40 active:scale-95 transition-transform ${active === 'discover' ? 'ring-4 ring-[#E8F8F5]' : ''}`}
            style={{ background: 'linear-gradient(135deg, #3CDBC0 0%, #2AB5A0 100%)' }}
          >
            <span className="text-xl leading-none">💎</span>
          </button>
          <span className={`mt-7 text-[11px] font-bold ${active === 'discover' ? 'text-[#2AB5A0]' : 'text-gray-400'}`}>발굴</span>
        </div>

        {SIDE_TABS.slice(2).map((t) => (
          <TabButton key={t.key} tab={t} active={active === t.key} onClick={() => go(t.key)} />
        ))}
      </div>
    </nav>
  );
}

function TabButton({ tab, active, onClick }: { tab: { key: TabKey; icon: string; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 py-1 active:scale-95 transition-transform ${active ? 'text-[#2AB5A0]' : 'text-gray-400'}`}
    >
      <span className="text-lg leading-none">{tab.icon}</span>
      <span className="text-[11px] font-bold">{tab.label}</span>
    </button>
  );
}
