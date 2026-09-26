// NEWS / SOCIAL / HISTORY — Echo Times, EchoNet, timeline.
import React, { useEffect, useMemo, useState } from 'react';
import { api, type EchoPost, type Newspaper, type SimEvent } from '../api';
import { useEcho } from '../store';
import { Avatar, Empty, Panel, Segmented } from '../primitives';
import { Icon } from '../icons';

/* ================= ECHO TIMES ================= */
export function NewsView() {
  const e = useEcho();
  const [day, setDay] = useState(e.state?.clock.day ?? 1);
  const [followToday, setFollowToday] = useState(true);
  const [paper, setPaper] = useState<Newspaper | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (followToday && e.state?.clock.day) setDay(e.state.clock.day); }, [followToday, e.state?.clock.day]);
  useEffect(() => {
    let live = true;
    const load = () => api.newspaper(day).then((x) => { if (live) { setPaper(x); setLoading(false); } }).catch(() => { if (live) { setPaper(null); setLoading(false); } });
    setLoading(true);
    load();
    const timer = setInterval(load, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [day]);
  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">The Echo Times</span><h1>What happened today?</h1><p className="view-summary">A daily edition assembled from the stories unfolding across the city.</p></div>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'center' }}>
        <button onClick={() => { setFollowToday(false); setDay((d) => Math.max(1, d - 1)); }}>◀</button>
        <span className="chip mono">DAY {day}</span>
        <button onClick={() => { setFollowToday(false); setDay((d) => d + 1); }}>▶</button>
        <button className="ghost" onClick={() => { setFollowToday(true); setDay(e.state?.clock.day ?? 1); }}>today</button>
      </div>
      {loading && <div className="dim" style={{ textAlign: 'center' }}>Printing…</div>}
      {!loading && !paper && <Empty icon="news" text={`No edition for day ${day} yet — the presses only roll when the city has stories.`} />}
      {paper && (
        <div className="paper">
          <h1>The Echo Times</h1>
          <div className="dateline">{paper.title ?? 'The city, in its own words'} · Day {paper.day} · {e.state?.cityName ?? 'Echo City'}</div>
          {(paper.articles ?? []).map((a, i) => (
            <article key={i} style={i === 0 ? { fontSize: '1.15em' } : undefined}>
              {i === 0 && <div className="view-kicker">Lead story</div>}
              <h3>{a.headline}</h3><p>{a.body}</p>
            </article>
          ))}
          {(paper.articles ?? []).length === 0 && <p style={{ fontFamily: 'Georgia,serif' }}>A quiet day. Citizens worked, loved, and slept.</p>}
          <div className="dateline">Est. Year 1 · Printed on 100% recycled rumours</div>
        </div>
      )}
    </div>
  );
}

/* ================= ECHONET ================= */
function isRumour(t: string): boolean { return /rumour|rumor|heard that|they say|allegedly|secret/i.test(t); }
function isAd(t: string): boolean { return /sale|discount|buy now|shop at|grand opening|% off/i.test(t); }

export function SocialView() {
  const e = useEcho();
  const [posts, setPosts] = useState<EchoPost[]>([]);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'latest' | 'conversations' | 'top' | 'rumours'>('latest');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const load = () => api.echonet().then(setPosts).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  const post = async () => {
    if (!text.trim()) return;
    try { await api.postEcho(null, text); setText(''); load(); e.push('broadcast sent ✓', 'ok'); }
    catch { e.push('post failed — backend offline', 'err'); }
  };
  const trending = useMemo(() => {
    const words = new Map<string, number>();
    for (const p of posts) for (const w of p.text.toLowerCase().replace(/[^a-z0-9# ]/g, '').split(/\s+/)) {
      if (w.length > 4) words.set(w, (words.get(w) ?? 0) + 1);
    }
    return [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [posts]);
  const shown = useMemo(() => {
    const replies = posts.filter((p) => p.replyToId);
    let s = posts.filter((p) => !p.replyToId);
    if (tab === 'top') s.sort((a, b) => b.likes - a.likes);
    if (tab === 'conversations') s = s.filter((p) => replies.some((reply) => reply.replyToId === p.id));
    if (tab === 'rumours') s = s.filter((p) => isRumour(p.text) || replies.some((reply) => reply.replyToId === p.id && isRumour(reply.text)));
    return s.slice(0, 60);
  }, [posts, tab]);
  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, EchoPost[]>();
    for (const reply of posts) if (reply.replyToId) grouped.set(reply.replyToId, [...(grouped.get(reply.replyToId) ?? []), reply]);
    return grouped;
  }, [posts]);

  const like = async (p: EchoPost) => {
    setLiked((l) => new Set(l).add(p.id));
    setPosts((ps) => ps.map((x) => x.id === p.id ? { ...x, likes: x.likes + 1 } : x));
    await api.likePost(p.id);
  };

  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">The conversation</span><h1>EchoNet</h1><p className="view-summary">Notes, rumours and small announcements from the people of Echo City.</p><div className="view-statline"><span>{posts.length} posts</span><span>{new Set(posts.map((p) => p.citizenId)).size} voices</span></div></div>
      <div className="social-layout">
        <div style={{ minWidth: 0 }}>
          <Panel title="Broadcast" icon="radio">
            <div className="row"><input value={text} onChange={(x) => setText(x.target.value)} placeholder="Broadcast to the city…" style={{ flex: 1 }}
              onKeyDown={(x) => { if (x.key === 'Enter') post(); }} /><button onClick={post}>Post</button></div>
          </Panel>
          <div className="row" style={{ margin: '10px 0' }}>
            <Segmented value={tab} onChange={setTab} options={[{ v: 'latest', label: 'Latest' }, { v: 'conversations', label: 'Conversations' }, { v: 'top', label: 'Top' }, { v: 'rumours', label: 'Rumours' }]} />
          </div>
          {shown.map((p) => isAd(p.text) ? (
            <div key={p.id} className="ad"><span className="chip">AD</span> <b>{p.citizenName}</b><div>{p.text}</div></div>
          ) : (
            <div key={p.id} className={isRumour(p.text) ? 'post rumour' : 'post'}>
              <div className="ph">
                <Avatar seed={p.citizenId} name={p.citizenName} size={28} />
                <div><b>{p.citizenName}</b> <span className="faint mono" style={{ fontSize: 10 }}>D{p.day} · {p.id.slice(0, 6)}</span></div>
                {isRumour(p.text) && <span className="chip" style={{ borderColor: '#ad7b8a', color: '#ad7b8a' }}>RUMOUR</span>}
              </div>
              <div className="pt">{p.text}</div>
              {(repliesByParent.get(p.id) ?? []).map((reply) => <div key={reply.id} className="post-reply">
                <Avatar seed={reply.citizenId} name={reply.citizenName} size={24} />
                <div><b>{reply.citizenName}</b><span className="faint mono"> · D{reply.day}</span><div>{reply.text}</div></div>
              </div>)}
              <div className="pa">
                <button onClick={() => like(p)} style={liked.has(p.id) ? { color: '#dc7a5f' } : undefined}>
                  <Icon name="heart" size={12} /> {p.likes}
                </button>
                <button onClick={() => { e.setSelCitizen(p.citizenId); e.setView('people'); }}><Icon name="users" size={12} /> profile</button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <Empty icon="msg" text={tab === 'conversations' ? 'No conversations yet. Citizens will talk as they meet around town.' : 'Silence on the wire. Be the first voice.'} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <Panel title="Trending" icon="flame">
            {trending.map(([w, n]) => <div key={w} className="row" style={{ fontSize: 12 }}><b>#{w}</b><span style={{ flex: 1 }} /><span className="mono faint">{n}</span></div>)}
            {trending.length === 0 && <div className="faint">Nothing trending yet.</div>}
          </Panel>
          <Panel title="Pulse" icon="radio" raised>
            <div className="kv"><span>voices</span><b>{new Set(posts.map((p) => p.citizenId)).size}</b>
              <span>likes given</span><b>{posts.reduce((a, p) => a + p.likes, 0)}</b>
              <span>rumours</span><b>{posts.filter((p) => isRumour(p.text)).length}</b></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ================= HISTORY ================= */
type Zoom = 'day' | 'month' | 'year';
export function HistoryView() {
  const e = useEcho();
  const [zoom, setZoom] = useState<Zoom>('day');
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const evs = useMemo(() => {
    let s = [...e.events].reverse();
    if (filter) s = s.filter((x) => x.type === filter);
    if (q) s = s.filter((x) => x.text.toLowerCase().includes(q.toLowerCase()));
    return s;
  }, [e.events, filter, q]);
  const types = [...new Set(e.events.map((x) => x.type))];
  const bucket = (d: number): string => zoom === 'day' ? `Day ${d}` : zoom === 'month' ? `Month ${Math.ceil(d / 30)} (days ${(Math.ceil(d / 30) - 1) * 30 + 1}–${Math.ceil(d / 30) * 30})` : `Year ${Math.ceil(d / 360)}`;
  const groups = useMemo(() => {
    const m = new Map<string, SimEvent[]>();
    for (const ev of evs) { const b = bucket(ev.day); m.set(b, [...(m.get(b) ?? []), ev]); }
    return [...m.entries()];
  }, [evs, zoom]);

  return (
    <div className="view">
      <div className="view-h"><span className="view-kicker">The city archive</span><h1>History in the making.</h1><p className="view-summary">Trace the moments that shaped this place, one day at a time.</p><div className="view-statline"><span>{e.events.length} recorded moments</span></div></div>
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <Segmented<Zoom> value={zoom} onChange={setZoom} options={[{ v: 'day', label: 'Day' }, { v: 'month', label: 'Month' }, { v: 'year', label: 'Year' }]} />
        <select value={filter} onChange={(x) => setFilter(x.target.value)}>
          <option value="">all types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search the past…" style={{ maxWidth: 220 }} />
      </div>
      {groups.map(([g, list]) => (
        <div key={g} style={{ marginBottom: 14 }}>
          <div className="sec-h">{g} · {list.length} events</div>
          <div className="tl-rail">
            {list.slice(0, zoom === 'day' ? 60 : 25).map((ev) => (
              <div key={ev.id} className="tl-node">
                <span className="chip mono">D{ev.day} {String(ev.hour).padStart(2, '0')}:00 · {ev.type}</span>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>{ev.text}</div>
              </div>
            ))}
            {list.length > (zoom === 'day' ? 60 : 25) && <div className="faint">…and {list.length - (zoom === 'day' ? 60 : 25)} more in this {zoom}.</div>}
          </div>
        </div>
      ))}
      {groups.length === 0 && <Empty icon="clock" text="No history matches. The past is unwritten." />}
    </div>
  );
}
