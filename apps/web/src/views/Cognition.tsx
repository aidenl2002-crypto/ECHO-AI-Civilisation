// AI BRAIN — ECHO COGNITION NETWORK: status/workers/queue/thoughts/latency/models,
// live feed, worker nodes, heatmap. Reads existing /api/brain/* + /api/ai/*.
import React, { useEffect, useState } from 'react';
import { api, type BrainStatus, type FeedItem, type HeatItem } from '../api';
import { useEcho } from '../store';
import { Avatar, DisabledBtn, Empty, MetricCard, Panel } from '../primitives';

interface StatusResp { brain: BrainStatus; provider: Record<string, unknown>; online: boolean; intensity: number; dbBytes: number }

export default function CognitionView() {
  const e = useEcho();
  const [st, setSt] = useState<StatusResp | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [heat, setHeat] = useState<HeatItem[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [showHeat, setShowHeat] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [s, f, h, m] = await Promise.all([api.brainStatus(), api.brainFeed(40), api.brainHeat(), api.aiModels()]);
        if (!live) return;
        setSt(s); if (f) setFeed(f.live); if (showHeat && h) setHeat(h); if (m) setModels(m.models ?? []);
      } catch { /* offline — panels render fallback */ }
    };
    load();
    const t = setInterval(load, 3500);
    return () => { live = false; clearInterval(t); };
  }, [showHeat]);

  const b = st?.brain;
  const workers = Array.from({ length: Math.max(1, b?.concurrency ?? 3) }, (_, i) => ({
    id: i, busy: i < (b?.activeRuns ?? 0),
  }));
  const lat = feed.slice(-20).map((f) => f.latencyMs).filter((n) => typeof n === 'number');
  const p50 = lat.length ? lat.sort((a, b2) => a - b2)[Math.floor(lat.length / 2)] : 0;
  const names = new Map(e.citizens.map((c) => [c.id, c.name]));

  return (
    <div className="view">
      <div className="view-h">
        <span className="view-kicker">Behind the scenes</span>
        <h1>The city's thinking.</h1>
        <p className="view-summary">See how citizens decide what to do, and how the cognition service is performing.</p>
        <div className="view-statline"><span>{st ? (st.online ? '● Cognition online' : '○ Cognition offline') : 'Checking connection…'}</span><span>{st?.online ? 'OpenCode gateway' : 'Simulation fallback active'}</span></div>
      </div>
      {!st && <div className="ev-card" style={{ borderLeftColor: '#c89a51' }}>Cognition data is unavailable right now. The city continues to run on its simulation rules.</div>}

      <div className="grid4" style={{ marginBottom: 10 }}>
        <MetricCard label="Queue" value={String(b?.queue ?? feed.length)} icon="db" color="#ad7b8a" sub={`load ${b?.loadLevel ?? '?'}`} />
        <MetricCard label="Workers" value={`${b?.activeRuns ?? 0}/${b?.concurrency ?? '?'}`} icon="brain" color="#258b80" />
        <MetricCard label="Recent decisions" value={String(feed.length)} icon="msg" color="#87a794" sub={`${p50}ms p50`} />
        <MetricCard label="Latency p50/p95" value={`${b?.latencyP50 ?? '—'}/${b?.latencyP95 ?? '—'}ms`} icon="clock" color="#c89a51"
          sub={b ? `ok ${(b.successRate * 100).toFixed(1)}%${b.circuitOpen ? ' · CIRCUIT OPEN' : ''}` : undefined} />
      </div>

      <div className="cognition-layout">
        <div style={{ minWidth: 0 }}>
          <Panel title="Recent decisions" icon="radio">
            {feed.map((f) => (
              <div key={f.id} className="feed-item">
                <div className="row">
                  <Avatar seed={f.citizenId} name={names.get(f.citizenId) ?? f.citizenId} size={22} />
                  <b>{names.get(f.citizenId) ?? f.citizenId.slice(0, 8)}</b>
                  <span className="chip">{f.type}</span><span>→</span><b style={{ color: '#258b80' }}>{f.decision}</b>
                  <span style={{ flex: 1 }} /><span className="mono faint">{f.latencyMs}ms · {f.result}</span>
                </div>
                <div className="faint" style={{ fontSize: 11 }}>in: {f.inputSummary}</div>
                <div style={{ fontSize: 12 }}>why: {f.reason}</div>
              </div>
            ))}
            {feed.length === 0 && <Empty icon="brain" text="No thoughts yet — the city dreams quietly." />}
          </Panel>
          <Panel title="Models" icon="gear" raised>
            <div className="faint" style={{ fontSize: 12 }}>Serving: <b className="mono">{String(st?.provider?.model ?? '—')}</b></div>
            <div className="row wrap" style={{ marginTop: 6 }}>
              {models.slice(0, 10).map((m) => <span key={m} className="chip mono">{m}</span>)}
              {models.length === 0 && <span className="faint">model list offline</span>}
            </div>
            <div className="kv" style={{ marginTop: 8 }}>
              <span>parse failures</span><b className="mono">{b?.parseFail ?? '—'}</b>
              <span>timeouts</span><b className="mono">{b?.timeouts ?? '—'}</b>
              <span>retries</span><b className="mono">{b?.retries ?? '—'}</b>
              <span>stale dropped</span><b className="mono">{b?.staleDropped ?? '—'}</b>
              <span>fallback used</span><b className="mono">{b?.fallbackUsed ?? '—'}</b>
              <span>intensity</span><b className="mono">{st?.intensity ?? '—'}</b>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <DisabledBtn label="Retire model" />
              <DisabledBtn label="A/B shadow run" />
            </div>
          </Panel>
        </div>
        <div style={{ minWidth: 0 }}>
          <Panel title="Worker nodes" icon="zap">
            <div className="node-grid">
              {workers.map((w) => (
                <div key={w.id} className="worker">
                  <div><span className="dot" style={{ background: w.busy ? '#258b80' : '#bfc9be' }} />Worker {w.id + 1}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{w.busy ? 'Thinking' : 'Available'}</div>
                </div>
              ))}
            </div>
            <div className="kv" style={{ marginTop: 8 }}>
              <span>by category</span><b className="mono">{b?.byCategory ? Object.entries(b.byCategory).map(([k, v]) => `${k}:${v}`).join(' ') : '—'}</b>
            </div>
          </Panel>
          <Panel title="Attention heatmap" icon="flame" raised
            right={<label className="faint" style={{ fontSize: 11 }}><input type="checkbox" checked={showHeat} onChange={(x) => setShowHeat(x.target.checked)} /> live</label>}>
            <HeatGrid heat={heat} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HeatGrid({ heat }: { heat: HeatItem[] }) {
  const max = Math.max(0.01, ...heat.map((h) => h.attention));
  const cls = ['C0', 'C1', 'C2', 'C3', 'C4'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {heat.slice(0, 120).map((h) => {
        const lvl = Math.min(4, Math.floor((h.attention / max) * 5));
        const col = ['#d9e2d5', '#87a794', '#258b80', '#dc7a5f', '#ad7b8a'][lvl];
        return <span key={h.id} title={`${h.name} · attention ${h.attention.toFixed(2)} · ${h.class} · ${h.lod}`}
          style={{ width: 14, height: 14, borderRadius: 3, background: col, opacity: 0.35 + (h.attention / max) * 0.65, cursor: 'pointer' }}>{''}</span>;
      })}
      {heat.length === 0 && <span className="faint">heatmap offline — {cls.join(' ')} scale standby</span>}
    </div>
  );
}
