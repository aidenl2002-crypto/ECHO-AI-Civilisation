// Minimal Lucide-style icon set (inline SVG, no dependency).
import React from 'react';

const P: Record<string, React.ReactNode> = {
  city: (<><rect x="4" y="3" width="7" height="18" rx="1" /><rect x="13" y="8" width="7" height="13" rx="1" /><path d="M7 7h1M7 11h1M7 15h1M16 12h1M16 16h1" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 15.2c2.3.3 3.9 1.8 4.4 4.3" /></>),
  shop: (<><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v2a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0v-2z" /><path d="M6 13.5V20h12v-6.5" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /></>),
  gov: (<><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>),
  heart: (<><path d="M12 20s-7.5-4.6-9.3-9.2C1.6 7.7 3.7 4.5 7 4.5c2 0 3.6 1.1 5 3.1 1.4-2 3-3.1 5-3.1 3.3 0 5.4 3.2 4.3 6.3C19.5 15.4 12 20 12 20z" /></>),
  news: (<><rect x="4" y="4" width="13" height="16" rx="1.5" /><path d="M17 8h2.5v11.5h-11" /><path d="M7 9h7M7 13h7M7 17h4" /></>),
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></>),
  db: (<><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>),
  brain: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></>),
  skull: (<><circle cx="12" cy="10" r="7" /><path d="M9 20v-2M15 20v-2M10 10h.01M14 10h.01M12 13v2" /></>),
  zap: (<><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  pin: (<><path d="M9 4h6l1 7 2.5 3v2H5.5v-2L8 11l1-7z" /><path d="M12 16v5" /></>),
  x: (<><path d="M6 6l12 12M18 6L6 18" /></>),
  chevL: (<><path d="M14.5 5L8 12l6.5 7" /></>),
  chevR: (<><path d="M9.5 5L16 12l-6.5 7" /></>),
  chevD: (<><path d="M5 9.5L12 16l7-6.5" /></>),
  play: (<><path d="M7 4.5l12 7.5-12 7.5z" /></>),
  pause: (<><path d="M8 5v14M16 5v14" /></>),
  step: (<><path d="M6 5l8 7-8 7zM16 5v14" /></>),
  save: (<><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-7h8v7" /></>),
  cal: (<><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M4 10.5h16M8.5 3v5M15.5 3v5" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5l1.2 2.7 2.9-.6 1 2.8 2.9.7-.5 2.9 2 2.2-2 2.2.5 2.9-2.9.7-1 2.8-2.9-.6L12 21.5l-1.2-2.7-2.9.6-1-2.8-2.9-.7.5-2.9-2-2.2 2-2.2-.5-2.9 2.9-.7 1-2.8 2.9.6L12 2.5z" /></>),
  eye: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>),
  film: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7.5 5v14M16.5 5v14M3 10h4.5M3 14h4.5M16.5 10H21M16.5 14H21" /></>),
  msg: (<><path d="M4 5h16v11H9l-5 4V5z" /></>),
  radio: (<><circle cx="12" cy="12" r="1.6" /><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.8 18.2a9 9 0 0 1 0-12.4M18.2 5.8a9 9 0 0 1 0 12.4" /></>),
  book: (<><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5V4.5z" /><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c-4.5 4.5-4.5 12.5 0 17M12 3.5c4.5 4.5 4.5 12.5 0 17" /></>),
  coin: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5v9M9.2 9.5c0-1 1.2-1.8 2.8-1.8s2.8.8 2.8 1.8-1 1.6-2.8 2-2.8 1-2.8 2 1.2 1.8 2.8 1.8 2.8-.8 2.8-1.8" /></>),
  scale: (<><path d="M12 4v16M5 7l7-3 7 3M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7zM8 20h8" /></>),
  shield: (<><path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6L12 3z" /></>),
  flame: (<><path d="M12 21c-4 0-7-2.8-7-6.5 0-4 3.5-6 5-8.5.3 1.8 1.2 3 2.7 3.6-.3-2.6.8-5.3 3.3-6.6-.4 3 1.5 4.7 2.5 7 1.2 2.7.5 7-2 9.5" /></>),
  menu: (<><path d="M4 7h16M4 12h16M4 17h16" /></>),
  cmd: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9l-2.5 3L9 15M15 9l2.5 3L15 15" /></>),
};

export function Icon({ name, size = 16, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className}
      style={{ flexShrink: 0 }} aria-hidden>
      {P[name] ?? P.city}
    </svg>
  );
}
export default Icon;
