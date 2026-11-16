import { useUiStore } from '@/store/uiStore';
import { Button, Icon, Kbd } from '../ui';

function Ring({ pct }: { pct: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="-rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.2s' }} />
    </svg>
  );
}

export function SyncButton() {
  const sync = useUiStore((s) => s.sync);
  const openModal = useUiStore((s) => s.openModal);
  const syncing = sync.status === 'syncing';
  const pct = sync.progress && sync.progress.total > 0 ? sync.progress.index / sync.progress.total : 0;

  return (
    <Button variant="primary" onClick={() => openModal('sync')} aria-label="Sincronizar (Ctrl+S)" title="Sincronizar (Ctrl+S)">
      {syncing ? <Ring pct={pct} /> : sync.status === 'success' ? <Icon name="check" size={17} /> : <Icon name="sync" size={17} />}
      <span className="hidden md:inline">{syncing ? `${Math.round(pct * 100)}%` : 'Sincronizar'}</span>
      <Kbd className="hidden border-black/20 bg-black/15 text-black/70 xl:inline-flex">Ctrl S</Kbd>
    </Button>
  );
}
