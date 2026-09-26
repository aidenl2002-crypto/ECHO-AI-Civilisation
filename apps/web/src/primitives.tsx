// Reusable ECHO OS primitives.
import React, { useId, useMemo, useState } from 'react';
import { Icon } from './icons';

/* ---------- layout ---------- */
export function Panel({ title, icon, right, children, raised, style }: {
  title?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode; raised?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className={raised ? 'panel raised' : 'panel'} style={style}>
      {title && <h3 className="p-title">{icon && <Icon name={icon} size={14} />}{title}<span style={{ flex: 1 }} />{right}</h3>}
      {children}
    </div>
  );
}

export function MetricCard({ label, value, delta, icon, color, sub, onClick }: {
  label: string; value: string; delta?: string; icon?: string; color?: string; sub?: string; onClick?: () => void;
}) {
  return (
    <div className="metric" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="k">{icon && <Icon name={icon} size={12} />}<span>{label}</span></div>
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      {(delta || sub) && <div className="d">{delta} {sub}</div>}
    </div>
  );
}

export function Bar({ label, value, color = '#258b80', max = 100 }: { label: string; value: number; color?: string; max?: number }) {
  const v = Math.max(0, Math.min(max, value));
  return (
    <div className="bar-row"><span className="dim">{label}</span>
      <div className="bar"><div style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
      <span className="mono">{Math.round(v)}</span>
    </div>
  );
}

export function Ring({ value, size = 54, color = '#258b80', label }: { value: number; size?: number; color?: string; label?: string }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e9e0" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none"
          strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="54%" textAnchor="middle" fill="#27332f" fontSize={13} fontWeight={700}>{Math.round(v)}</text>
      </svg>
      {label && <div className="faint" style={{ fontSize: 10 }}>{label}</div>}
    </div>
  );
}

/* ---------- deterministic avatar ---------- */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const AV_HUES = [170, 25, 150, 35, 335, 200, 15, 260, 120, 45];
export function Avatar({ seed, name, size = 34 }: { seed: string; name: string; size?: number }) {
  const h = hashSeed(seed);
  const hue = AV_HUES[h % AV_HUES.length];
  const hue2 = (hue + 45) % 360;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="avatar" title={name} style={{
      width: size, height: size, fontSize: size * 0.36,
      background: `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${hue2} 65% 30%))`,
      border: '1px solid rgba(255,255,255,.18)',
    }}>{initials}</span>
  );
}

/* ---------- sparklines & charts ---------- */
export function Sparkline({ data, width = 120, height = 32, color = '#258b80', fill = true }: {
  data: number[]; width?: number; height?: number; color?: string; fill?: boolean;
}) {
  const id = useId();
  const pts = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
    return data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 3 - ((v - min) / rng) * (height - 8)}`).join(' ');
  }, [data, width, height]);
  if (data.length < 2) return <span className="faint">—</span>;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity={.35} /><stop offset="1" stopColor={color} stopOpacity={0} />
      </linearGradient></defs>
      {fill && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={width} cy={Number(pts.split(' ').pop()?.split(',')[1] ?? height / 2)} r={2.4} fill={color} />
    </svg>
  );
}

export function Chart({ data, labels, height = 150, color = '#258b80', markers, yLabel, onRange }: {
  data: number[]; labels?: string[]; height?: number; color?: string;
  markers?: Array<{ i: number; label: string; color?: string }>; yLabel?: string; onRange?: (a: number, b: number) => void;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const W = 560, H = height, P = 26;
  const min = Math.min(...data, 0), max = Math.max(...data, 1);
  const rng = max - min || 1;
  const X = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - P * 2);
  const Y = (v: number) => H - P - ((v - min) / rng) * (H - P * 2);
  const pts = data.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width * W - P) / (W - P * 2) * (data.length - 1));
          setHov(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onMouseLeave={() => { setHov(null); onRange?.(0, data.length - 1); }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={H * f} y2={H * f} stroke="#e4e9e2" strokeWidth={1} />
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {markers?.map((m, k) => (
          <g key={k}>
            <line x1={X(m.i)} x2={X(m.i)} y1={8} y2={H - 8} stroke={m.color ?? '#ba873f'} strokeWidth={1.2} strokeDasharray="3 2" />
            <circle cx={X(m.i)} cy={Y(data[m.i] ?? 0)} r={3.4} fill={m.color ?? '#ba873f'} />
          </g>
        ))}
        {hov != null && data[hov] != null && (
          <g>
            <line x1={X(hov)} x2={X(hov)} y1={8} y2={H - 8} stroke="#27332f" strokeWidth={1} opacity={.5} />
            <circle cx={X(hov)} cy={Y(data[hov])} r={4} fill="#fff" stroke={color} strokeWidth={2} />
          </g>
        )}
        <text x={4} y={12} fill="#89948d" fontSize={9}>{max.toFixed(0)}</text>
        <text x={4} y={H - 6} fill="#89948d" fontSize={9}>{min.toFixed(0)}</text>
        {yLabel && <text x={4} y={H / 2} fill="#89948d" fontSize={9} transform={`rotate(-90 8 ${H / 2})`}>{yLabel}</text>}
      </svg>
      {hov != null && (
        <div className="hud-pill mono" style={{ position: 'absolute', top: 2, right: 4, fontSize: 11 }}>
          {labels?.[hov] ?? `#${hov}`}: <b>{Number(data[hov]).toFixed(1)}</b>
          {markers?.filter((m) => m.i === hov).map((m) => <span key={m.label} style={{ color: m.color ?? '#ba873f' }}> ◆ {m.label}</span>)}
        </div>
      )}
    </div>
  );
}

/* ---------- overlays ---------- */
export function Drawer({ title, onClose, children, width = 330 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div className="drawer" style={{ width }}>
      <div className="rhead"><span>{title}</span><span style={{ flex: 1 }} />
        <button className="ghost" onClick={onClose} aria-label="close"><Icon name="x" size={15} /></button>
      </div>
      <div className="rbody">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, danger }: {
  title: string; onClose: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={danger ? 'modal danger-m' : 'modal'} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 10 }}>
          <b style={{ fontFamily: 'Space Grotesk', fontSize: 15 }}>{title}</b><span style={{ flex: 1 }} />
          <button className="ghost" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EventCard({ day, hour, type, text, onClick, color }: {
  day: number; hour?: number; type: string; text: string; onClick?: () => void; color?: string;
}) {
  return (
    <div className="ev-card" onClick={onClick} style={color ? { borderLeftColor: color } : undefined}>
      <div className="meta">DAY {day}{hour != null ? ` · ${hour}:00` : ''} · {type}</div>
      <div>{text}</div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: Array<{ v: T; label: string; disabled?: boolean; title?: string }>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="seg">{options.map((o) => (
      <button key={o.v} className={value === o.v ? 'active' : ''} disabled={o.disabled} title={o.title} onClick={() => onChange(o.v)}>{o.label}</button>
    ))}</div>
  );
}

export function Skeleton({ big }: { big?: boolean }) {
  return (
    <div>
      <div className="skel" style={{ width: '55%', marginBottom: 8 }} />
      <div className={big ? 'skel skel-big' : 'skel'} />
      <div className="dim" style={{ marginTop: 8, fontSize: 11, letterSpacing: 1.5 }}>RESTORING CIVILISATION…</div>
    </div>
  );
}

export function Empty({ icon = 'search', text }: { icon?: string; text: string }) {
  return <div className="dim" style={{ padding: 18, textAlign: 'center' }}><Icon name={icon} size={22} /><div style={{ marginTop: 6 }}>{text}</div></div>;
}

export function DisabledBtn({ label, title = 'SYSTEM NOT IMPLEMENTED' }: { label: string; title?: string }) {
  return <button disabled title={title}>{label}</button>;
}

/* ---------- error boundary ---------- */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: String(e?.message ?? e) }; }
  componentDidCatch() { /* contained */ }
  render() {
    if (this.state.err) return <div className="panel"><h3 className="p-title">Something broke</h3><p className="dim">{this.state.err}</p><button onClick={() => this.setState({ err: null })}>Retry</button></div>;
    return this.props.children;
  }
}
