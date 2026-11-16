import { useCallback, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import { MAX_PAGES } from '@/core/constants';
import type { Page } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Button, toast } from '../ui';
import { DraggableRow, RootRow } from './PageRow';

function depthOf(page: Page, pages: Page[]): number {
  let d = 0;
  let cur: Page | undefined = page;
  while (cur?.parentId && d < 6) {
    cur = pages.find((p) => p.id === cur?.parentId);
    d++;
  }
  return d;
}

/** Pages / folders list with reorder, add, duplicate, rename and delete. */
export function PagesRail({ className }: { className?: string }) {
  const pages = useDeckStore((s) => s.config.pages);
  const addPage = useDeckStore((s) => s.addPage);
  const duplicatePage = useDeckStore((s) => s.duplicatePage);
  const renamePage = useDeckStore((s) => s.renamePage);
  const deletePage = useDeckStore((s) => s.deletePage);
  const movePage = useDeckStore((s) => s.movePage);
  const currentId = useUiStore((s) => s.currentPageId);
  const setPage = useUiStore((s) => s.setCurrentPage);

  const atLimit = pages.length >= MAX_PAGES;
  const rest = useMemo(() => pages.slice(1), [pages]);
  const ids = useMemo(() => rest.map((p) => p.id), [rest]);
  const idxOf = useCallback((id: string) => pages.findIndex((p) => p.id === id), [pages]);

  const goTo = (id: string) => setPage(id, idxOf(id) > idxOf(currentId) ? 1 : -1);

  const onReorder = (next: string[]) => {
    const i = next.findIndex((id, k) => id !== ids[k]);
    if (i < 0) return;
    const movedUp = ids.indexOf(next[i]) > i;
    const id = movedUp ? next[i] : ids[i];
    movePage(id, next.indexOf(id) + 1);
  };

  const add = (folder: boolean) => {
    const id = addPage(folder, folder ? currentId : undefined);
    if (id) {
      setPage(id, 1);
      toast.success(folder ? 'Pasta criada.' : 'Página criada.');
    }
  };

  const onDelete = (page: Page) => {
    const wasCurrent = page.id === currentId;
    if (deletePage(page.id)) {
      toast.info(`“${page.name}” excluída.`);
      if (wasCurrent) setPage(pages[0].id, -1);
    }
  };

  const onDuplicate = (id: string) => {
    const nid = duplicatePage(id);
    if (nid) {
      setPage(nid, 1);
      void useDeckStore.getState().ensureBitmaps();
      toast.success('Página duplicada.');
    }
  };

  const rowProps = (p: Page) => ({
    page: p,
    depth: depthOf(p, pages),
    active: p.id === currentId,
    canDuplicate: !atLimit,
    onSelect: () => goTo(p.id),
    onRename: (n: string) => renamePage(p.id, n),
    onDuplicate: () => onDuplicate(p.id),
    onDelete: () => onDelete(p),
  });

  return (
    <nav aria-label="Páginas" className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Páginas</h2>
        <span className={cn('rounded-md bg-ink-950 px-1.5 py-0.5 font-mono text-[11px]', atLimit ? 'text-warn' : 'text-fg-muted')} aria-label={`${pages.length} de ${MAX_PAGES} páginas`}>
          {pages.length}/{MAX_PAGES}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        <RootRow {...rowProps(pages[0])} />
        <Reorder.Group axis="y" values={ids} onReorder={onReorder} className="mt-1 flex flex-col gap-1">
          {rest.map((p) => (
            <DraggableRow key={p.id} {...rowProps(p)} />
          ))}
        </Reorder.Group>
        {rest.length === 0 && (
          <p className="mx-1 mt-3 rounded-lg border border-dashed border-white/10 p-3 text-center text-xs leading-relaxed text-fg-dim">
            Crie páginas para ter mais teclas ou pastas para agrupar atalhos.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-3">
        <Button size="sm" icon="add" disabled={atLimit} onClick={() => add(false)} title={atLimit ? 'Limite de 8 páginas atingido' : undefined}>
          Página
        </Button>
        <Button size="sm" icon="create_new_folder" disabled={atLimit} onClick={() => add(true)} title={atLimit ? 'Limite de 8 páginas atingido' : undefined}>
          Pasta
        </Button>
      </div>
    </nav>
  );
}
