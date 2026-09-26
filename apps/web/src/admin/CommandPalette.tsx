// CommandPalette: Ctrl+K natural-language command bar with autocomplete.
import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from './adminApi';

const HINTS = [
  'give 1000 to ', 'remove 500 from ', 'kill ', 'revive ', 'heal ', 'teleport <id> to 500 500',
  'spawn 5 ', 'mass extinction', 'miracle', 'money drop 1000', 'nuke economy', 'boom', 'recession',
  'random chaos', 'blessing', 'pause ai', 'resume ai', 'step 10', 'speed 5', 'make <name> mayor',
  'tax 15', 'election', 'arrest ', 'event GodIntervention ', 'rumour ', 'force think ', 'clone ', 'immortal ',
];

export default function CommandPalette({ open, onClose, push }: { open: boolean; onClose: () => void; push: (t: string) => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => ref.current?.focus(), 30); }, [open ]);
  if (!open) return null;
  const run = async () => {
    try {
      const r = await adminApi.command(text);
      setResult(`${r.ok ? 'OK' : 'REJECTED'}: ${r.summary} ${r.warnings?.join('; ') ?? ''} [${(r.actions ?? []).map((a) => a.type).join(', ')}]`);
      push(`CMD "${text}" -> ${r.summary}`);
    } catch (e) { setResult(`FAIL: ${e instanceof Error ? e.message : e}`); }
  };
  const hints = HINTS.filter((h) => h.includes(text.toLowerCase().split(' ')[0]) || !text).slice(0, 8);
  return (
    <div className="adm-palette-back" onClick={onClose}>
      <div className="adm-palette" onClick={(e) => e.stopPropagation()}>
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run(); if (e.key === 'Escape') onClose(); }}
          placeholder="Type a god command… (natural language -> approved actions, no shell)" />
        <div className="adm-hints">{hints.map((h) => <button key={h} onClick={() => setText(h)}>{h}</button>)}</div>
        {result && <div className="adm-result">{result}</div>}
        <div className="adm-note">Parser is dry-run: it validates into approved AdminCommandBus actions. Execute via panels.</div>
      </div>
    </div>
  );
}
