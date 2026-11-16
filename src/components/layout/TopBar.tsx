import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Logo } from '../brand/Logo';
import { Button } from '../ui';
import { ConnectionPill } from './ConnectionPill';
import { SyncButton } from './SyncButton';

export function TopBar() {
  const name = useDeckStore((s) => s.config.name);
  const rename = useDeckStore((s) => s.renameDeck);
  const openModal = useUiStore((s) => s.openModal);

  return (
    <header className="surface-matte relative z-10 shrink-0 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo variant="mark" size={28} title="Danjos Deck" className="sm:hidden" />
        <Logo variant="full" size={30} title="Danjos Deck" className="hidden sm:block" />
      </div>
      <span className="hidden h-5 w-px bg-white/10 sm:block" />
      <input
        value={name}
        maxLength={40}
        onChange={(e) => rename(e.target.value)}
        onBlur={(e) => !e.target.value.trim() && rename('Meu Danjos Deck')}
        aria-label="Nome do deck"
        placeholder="Nome do deck"
        className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm text-fg-muted transition-colors hover:border-white/10 focus:border-accent/50 focus:bg-ink-950 focus:text-fg focus:outline-none sm:max-w-[260px] sm:flex-none"
      />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ConnectionPill />
        <Button icon="memory" onClick={() => openModal('pinout')} aria-label="Pinout e hardware" title="Pinout e hardware">
          <span className="hidden lg:inline">Pinout</span>
        </Button>
        <Button icon="code" onClick={() => openModal('export')} aria-label="Exportar (Ctrl+E)" title="Exportar (Ctrl+E)">
          <span className="hidden lg:inline">Exportar</span>
        </Button>
        <SyncButton />
      </div>
      </div>
    </header>
  );
}
