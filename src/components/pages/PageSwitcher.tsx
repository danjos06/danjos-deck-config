import { useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Button, Drawer, Icon } from '../ui';
import { PagesRail } from './PagesRail';

/** Compact page switcher for < 1024px: chips + a sheet with the full pages manager. */
export function PageSwitcher() {
  const pages = useDeckStore((s) => s.config.pages);
  const currentId = useUiStore((s) => s.currentPageId);
  const setPage = useUiStore((s) => s.setCurrentPage);
  const [open, setOpen] = useState(false);
  const idxOf = (id: string) => pages.findIndex((p) => p.id === id);

  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-white/[0.06] bg-ink-900/60 px-3 py-2">
      <Button size="sm" icon="layers" onClick={() => setOpen(true)} aria-label="Gerenciar páginas">
        Páginas
      </Button>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5" role="tablist" aria-label="Página atual">
        {pages.map((p) => {
          const active = p.id === currentId;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPage(p.id, idxOf(p.id) > idxOf(currentId) ? 1 : -1)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                active ? 'border-accent/50 bg-accent/10 text-fg' : 'border-white/[0.07] text-fg-muted hover:text-fg',
              )}
            >
              {p.isFolder && <Icon name="folder" size={13} fill />}
              <span className="max-w-[140px] truncate">{p.name}</span>
            </button>
          );
        })}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Páginas" subtitle="Organize páginas e pastas" side="left" className="[--w:340px]">
        <PagesRail className="h-full" />
      </Drawer>
    </div>
  );
}
