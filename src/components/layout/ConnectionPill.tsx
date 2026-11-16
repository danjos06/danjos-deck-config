import { cn } from '@/lib/ui/cn';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';

interface Look {
  text: string;
  dot: string;
  ring: string;
  pulse: boolean;
}

export function ConnectionPill() {
  const sync = useUiStore((s) => s.sync);
  const openModal = useUiStore((s) => s.openModal);
  const ip = useDeckStore((s) => s.config.network.deviceIp);

  let look: Look;
  if (sync.status === 'syncing') look = { text: 'Sincronizando…', dot: 'bg-accent', ring: 'border-accent/40 text-accent', pulse: true };
  else if (sync.status === 'testing') look = { text: 'Testando…', dot: 'bg-sky-300', ring: 'border-sky-300/30 text-sky-200', pulse: true };
  else if (sync.status === 'success') look = { text: 'Sincronizado', dot: 'bg-ok', ring: 'border-ok/30 text-ok', pulse: false };
  else if (sync.status === 'error') look = { text: 'Falha na conexão', dot: 'bg-danger', ring: 'border-danger/30 text-danger', pulse: false };
  else if (sync.lastProbe?.ok) {
    const fw = sync.lastProbe.firmware === 'v2' ? 'fw v2' : sync.lastProbe.firmware === 'legacy' ? 'fw antigo' : '';
    look = { text: `${ip || 'Dispositivo'} · ${sync.lastProbe.latencyMs} ms ${fw}`.trim(), dot: 'bg-ok', ring: 'border-ok/25 text-fg', pulse: false };
  } else if (ip) look = { text: sync.transport === 'serial' ? 'USB Serial' : ip, dot: 'bg-fg-dim', ring: 'border-white/10 text-fg-muted', pulse: false };
  else look = { text: 'Sem dispositivo', dot: 'bg-fg-dim', ring: 'border-white/10 text-fg-muted', pulse: false };

  return (
    <button
      type="button"
      onClick={() => openModal('sync')}
      aria-label={`Estado da conexão: ${look.text}. Abrir sincronização`}
      className={cn(
        'hidden h-8 min-w-0 max-w-[260px] items-center gap-2 rounded-full border bg-ink-900/80 px-3 text-xs font-medium transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 sm:inline-flex',
        look.ring,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {look.pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', look.dot)} />}
        <span className={cn('relative h-2 w-2 rounded-full', look.dot, look.pulse && 'animate-pulseDot')} />
      </span>
      <span className="truncate font-mono text-[11px]">{look.text}</span>
    </button>
  );
}
