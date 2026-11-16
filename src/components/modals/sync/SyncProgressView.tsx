import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SyncProgress } from '@/core/protocol/sync';
import { cn } from '@/lib/ui/cn';
import { useUiStore, type SyncLogEntry } from '@/store/uiStore';
import { Icon } from '../../ui';

type Phase = SyncProgress['phase'];
const STEPS: { phase: Exclude<Phase, 'done'>; label: string; icon: string }[] = [
  { phase: 'clear', label: 'Limpar o dispositivo', icon: 'cleaning_services' },
  { phase: 'pins', label: 'Pinos e layout', icon: 'memory' },
  { phase: 'actions', label: 'Ações das teclas', icon: 'bolt' },
  { phase: 'bitmaps', label: 'Ícones das telas', icon: 'image' },
  { phase: 'save', label: 'Salvar na memória', icon: 'save' },
];
const ORDER: Phase[] = ['clear', 'pins', 'actions', 'bitmaps', 'save', 'done'];

export function StepList({ progress, status }: { progress: SyncProgress | null; status: 'syncing' | 'success' | 'error' }) {
  const cur = progress ? ORDER.indexOf(progress.phase) : -1;
  const pct = status === 'success' ? 1 : progress && progress.total > 0 ? progress.index / progress.total : 0;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="min-w-0 truncate text-fg-muted">{status === 'success' ? 'Sincronização concluída' : (progress?.label ?? 'Preparando…')}</span>
          <span className="font-mono text-fg">{Math.round(pct * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className={cn('h-full rounded-full', status === 'error' ? 'bg-danger' : status === 'success' ? 'bg-ok' : 'bg-accent')}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </div>
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => {
          const done = status === 'success' || cur > i;
          const active = status !== 'success' && cur === i;
          const failed = active && status === 'error';
          return (
            <li key={s.phase} className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors', active && !failed && 'bg-accent/10', failed && 'bg-danger/10')}>
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  done ? 'bg-ok/20 text-ok' : failed ? 'bg-danger/20 text-danger' : active ? 'bg-accent/20 text-accent' : 'bg-ink-700 text-fg-dim',
                )}
              >
                {done ? <Icon name="check" size={15} /> : failed ? <Icon name="close" size={15} /> : active ? <Icon name="progress_activity" size={15} className="animate-spin" /> : <Icon name={s.icon} size={14} />}
              </span>
              <span className={cn(done || active ? 'text-fg' : 'text-fg-dim')}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SuccessMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="text-ok">
      <motion.circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="3" initial={{ pathLength: 0, opacity: 0.4 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5 }} />
      <motion.path d="M22 37 L32 47 L51 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.35 }} />
    </svg>
  );
}

const LEVEL: Record<SyncLogEntry['level'], string> = { info: 'text-fg-muted', error: 'text-danger', tx: 'text-sky-300', rx: 'text-ok' };
const PREFIX: Record<SyncLogEntry['level'], string> = { info: '·', error: '!', tx: '>', rx: '<' };

export function SyncLog() {
  const log = useUiStore((s) => s.sync.log);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <div ref={ref} role="log" aria-label="Registro da sincronização" className="h-36 overflow-y-auto rounded-xl border border-white/[0.06] bg-ink-950 p-2.5 font-mono text-[11px] leading-relaxed">
      {log.length === 0 ? (
        <p className="text-fg-dim">O registro aparecerá aqui.</p>
      ) : (
        log.map((l, i) => (
          <p key={i} className={cn('break-all', LEVEL[l.level])}>
            <span className="mr-1.5 text-fg-dim">{new Date(l.at).toLocaleTimeString('pt-BR')}</span>
            {PREFIX[l.level]} {l.text}
          </p>
        ))
      )}
    </div>
  );
}
