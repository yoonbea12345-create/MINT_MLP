// 공용 아이콘 — BottomTabBar와 같은 시각 언어(viewBox 24, stroke currentColor, round cap/join).
// 탭바는 되돌린 이력이 있는 민감 파일이라 손대지 않고, active 토글 없는 단순 버전만 여기 둔다.

export interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function svgProps(className?: string, strokeWidth?: number) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: strokeWidth ?? 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

/* ── 헤더용 4종 ── */

export function IconCalendar({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" />
      <path d="M8 3.2v3.6M16 3.2v3.6" />
      <path d="M3.5 10h17" />
    </svg>
  );
}

export function IconCompass({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.4 8.6 13.5 13.7 8.4 15.6 10.3 10.5Z" />
    </svg>
  );
}

export function IconGift({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1.1" />
      <path d="M12 8.5V21" />
      <path d="M19 12.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.5" />
      <path d="M8.2 8.5a2.6 2.6 0 1 1 0-5.2c2.7 0 3.8 5.2 3.8 5.2" />
      <path d="M15.8 8.5a2.6 2.6 0 1 0 0-5.2c-2.7 0-3.8 5.2-3.8 5.2" />
    </svg>
  );
}

export function IconUserCircle({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <circle cx="12" cy="8.1" r="3.6" />
      <path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0" />
    </svg>
  );
}

/* ── 기능 아이콘 10종 ── */

export function IconMapPin({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M12 21C12 21 6 15.8 6 10.6a6 6 0 1 1 12 0C18 15.8 12 21 12 21Z" />
      <circle cx="12" cy="10.6" r="2.1" />
    </svg>
  );
}

export function IconUtensils({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M8 3v5.5M10.2 3v5.5" />
      <path d="M9.1 8.5V21" />
      <path d="M15.8 3c-1.6 0-2.5 2.2-2.5 5s1 4.3 2.5 4.3V21" />
    </svg>
  );
}

export function IconCup({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M6 9h11l-1 8.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 9Z" />
      <path d="M17 10.5c2 .2 3 1.6 3 3s-1 2.8-3 3" />
      <path d="M9.5 6.5c0-1 1-1 1-2" />
    </svg>
  );
}

export function IconTag({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M11 3.5H20V12.5L12.5 20a1.5 1.5 0 0 1-2.1 0L3.5 13a1.5 1.5 0 0 1 0-2.1Z" />
      <circle cx="15" cy="7.5" r="1.4" />
    </svg>
  );
}

export function IconClock({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.5V12l3.4 2.2" />
    </svg>
  );
}

export function IconUsers({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <circle cx="9" cy="8" r="2.6" />
      <path d="M3.8 20a5.4 5.4 0 0 1 10.4 0" />
      <circle cx="16.5" cy="9" r="2" />
      <path d="M13.5 20a5 5 0 0 1 8.6-3.3" />
    </svg>
  );
}

export function IconSparkle({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M12 3 13.2 9 19 10.3 13.2 11.6 12 17.6 10.8 11.6 5 10.3 10.8 9Z" />
    </svg>
  );
}

export function IconCheck({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function IconBell({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M6 10.5a6 6 0 0 1 12 0v3.2l1.4 2.3H4.6L6 13.7Z" />
      <path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  );
}

// 펼침 상태는 rotate-180 클래스로 처리한다(위 방향 아이콘을 따로 두지 않음).
export function IconChevronDown({ className, strokeWidth }: IconProps) {
  return (
    <svg {...svgProps(className, strokeWidth)}>
      <path d="M6 9 12 15 18 9" />
    </svg>
  );
}
