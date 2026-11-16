import { useEffect, useMemo, useState } from 'react';
import { KEY_CATALOG, KEY_GROUP_LABELS, MODIFIER_BITS, browserKeyToKeyName, eventModifiers, keyLabel, type KeyGroup } from '@/core/constants';
import { cn } from '@/lib/ui/cn';
import { shortcutParts } from '@/lib/ui/format';
import { Button, Icon, Input, Kbd } from '../../ui';

interface KeystrokeEditorProps {
  keyName: string;
  modifiers: number;
  onChange: (key: string, modifiers: number) => void;
}

const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

function Recorder({ onRecord }: { onRecord: (key: string, mods: number) => void }) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    let maxMods = 0;
    let done = false;
    const finish = (key: string, mods: number) => {
      done = true;
      setRecording(false);
      onRecord(key, mods);
    };
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (MODIFIER_CODES.has(e.code)) {
        maxMods |= eventModifiers(e);
        return;
      }
      const name = browserKeyToKeyName(e);
      if (name) finish(name, eventModifiers(e));
    };
    const up = (e: KeyboardEvent) => {
      if (done) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (MODIFIER_CODES.has(e.code) && maxMods) finish('', maxMods);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [recording, onRecord]);

  return (
    <Button
      variant={recording ? 'primary' : 'secondary'}
      icon={recording ? 'radio_button_checked' : 'keyboard'}
      onClick={() => setRecording((r) => !r)}
      onBlur={() => setRecording(false)}
      className={cn('w-full', recording && 'animate-pulse')}
      aria-live="polite"
    >
      {recording ? 'Pressione o atalho… (clique p/ cancelar)' : 'Gravar atalho'}
    </Button>
  );
}

function KeyPicker({ value, onPick }: { value: string; onPick: (k: string) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = new Map<KeyGroup, typeof KEY_CATALOG[number][]>();
    for (const k of KEY_CATALOG) {
      if (needle && !k.label.toLowerCase().includes(needle) && !k.name.toLowerCase().includes(needle)) continue;
      out.set(k.group, [...(out.get(k.group) ?? []), k]);
    }
    return [...out.entries()];
  }, [q]);

  return (
    <div className="min-w-0">
      <div className="relative mb-2">
        <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-dim" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tecla (ex.: F5, enter, seta)" aria-label="Buscar tecla" className="pl-8" />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-ink-950 p-2">
        {groups.length === 0 && <p className="p-3 text-center text-xs text-fg-dim">Nenhuma tecla encontrada.</p>}
        {groups.map(([g, keys]) => (
          <div key={g} className="mb-2 last:mb-0">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-fg-dim">{KEY_GROUP_LABELS[g]}</p>
            <div className="flex flex-wrap gap-1">
              {keys.map((k) => (
                <button
                  key={k.name}
                  type="button"
                  aria-pressed={value === k.name}
                  onClick={() => onPick(k.name)}
                  className={cn(
                    'min-w-[2rem] rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                    value === k.name ? 'bg-accent text-black' : 'bg-ink-700 text-fg-muted hover:bg-ink-600 hover:text-fg',
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Key recorder + catalog picker + modifier chips + human summary. */
export function KeystrokeEditor({ keyName, modifiers, onChange }: KeystrokeEditorProps) {
  const parts = shortcutParts(keyName, modifiers);
  return (
    <div className="space-y-3">
      <div className="flex min-h-[3.25rem] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-ink-950 px-3 py-2.5" aria-live="polite">
        {parts.length === 0 ? (
          <span className="text-xs text-fg-dim">Nenhuma tecla definida</span>
        ) : (
          parts.map((p, i) => (
            <span key={`${p}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-fg-dim">+</span>}
              <Kbd className="px-2 py-1 text-xs">{p}</Kbd>
            </span>
          ))
        )}
      </div>
      <Recorder onRecord={onChange} />
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">Modificadores</p>
        <div className="grid grid-cols-4 gap-1.5">
          {MODIFIER_BITS.map((m) => {
            const on = (modifiers & m.bit) !== 0;
            return (
              <button
                key={m.bit}
                type="button"
                aria-pressed={on}
                title={m.label}
                onClick={() => onChange(keyName, on ? modifiers & ~m.bit : modifiers | m.bit)}
                className={cn(
                  'truncate rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                  on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/[0.07] bg-ink-950 text-fg-muted hover:text-fg',
                )}
              >
                {m.short}
              </button>
            );
          })}
        </div>
      </div>
      <KeyPicker value={keyName} onPick={(k) => onChange(k, modifiers)} />
      {keyName && (
        <button type="button" onClick={() => onChange('', modifiers)} className="text-[11px] text-fg-dim underline-offset-2 hover:text-fg hover:underline">
          Limpar tecla ({keyLabel(keyName)}) e manter só modificadores
        </button>
      )}
    </div>
  );
}
