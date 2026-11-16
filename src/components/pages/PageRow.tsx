import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import type { Page } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { Badge, Icon, IconButton } from '../ui';
import { PageThumb } from './PageThumb';

interface PageRowProps {
  page: Page;
  depth: number;
  active: boolean;
  /** Root page: not draggable, not deletable. */
  root?: boolean;
  canDuplicate: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function RowBody({ page, depth, active, root, canDuplicate, onSelect, onRename, onDuplicate, onDelete, grip }: PageRowProps & { grip?: (e: React.PointerEvent) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(page.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== page.name) onRename(v);
    setEditing(false);
  };

  return (
    <div
      style={{ marginLeft: Math.min(depth, 3) * 14 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-xl border p-2 transition-colors',
        active ? 'border-accent/50 bg-accent/[0.07]' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]',
      )}
    >
      {grip ? (
        <button
          type="button"
          aria-label={`Reordenar ${page.name}`}
          onPointerDown={grip}
          className="-ml-1 flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-fg-dim hover:text-fg active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 rounded"
        >
          <Icon name="drag_indicator" size={16} />
        </button>
      ) : (
        <span className="-ml-1 flex h-8 w-4 shrink-0 items-center justify-center text-fg-dim" title="A página raiz não pode ser movida">
          <Icon name="home" size={14} />
        </span>
      )}
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <PageThumb page={page} />
          <input
            ref={inputRef}
            value={draft}
            maxLength={32}
            aria-label="Nome da página"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setDraft(page.name);
                setEditing(false);
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-accent/60 bg-ink-950 px-2 text-sm text-fg outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <PageThumb page={page} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[13px] font-medium', active ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>{page.name}</span>
            <span className="mt-0.5 flex items-center gap-1">
              {page.isFolder && (
                <Badge tone="info">
                  <Icon name="folder" size={10} fill /> Pasta
                </Badge>
              )}
              {root && <Badge>Raiz</Badge>}
            </span>
          </span>
        </button>
      )}

      {editing ? null : confirming ? (
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-ink-800 p-1 shadow-pop" role="group" aria-label="Confirmar exclusão">
          <button type="button" onClick={onDelete} className="rounded-md bg-danger/20 px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60">
            Excluir
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 text-[11px] text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
            Não
          </button>
        </div>
      ) : (
        <div className={cn('absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center rounded-lg bg-ink-800 shadow-pop transition-opacity focus-within:opacity-100 group-hover:opacity-100', 'opacity-0 [@media(hover:none)]:opacity-100')}>
          <IconButton size="sm" icon="edit" label="Renomear" onClick={() => { setDraft(page.name); setEditing(true); }} />
          <IconButton size="sm" icon="content_copy" label={canDuplicate ? 'Duplicar' : 'Limite de 8 páginas atingido'} disabled={!canDuplicate} onClick={onDuplicate} />
          {!root && <IconButton size="sm" icon="delete" label="Excluir" tone="danger" onClick={() => setConfirming(true)} />}
        </div>
      )}
    </div>
  );
}

export function RootRow(props: PageRowProps) {
  return <RowBody {...props} root />;
}

export function DraggableRow(props: PageRowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={props.page.id}
      dragListener={false}
      dragControls={controls}
      className="relative list-none"
      whileDrag={{ scale: 1.02, zIndex: 20, boxShadow: '0 12px 28px rgba(0,0,0,0.6)' }}
      transition={{ duration: 0.15 }}
    >
      <RowBody {...props} grip={(e) => controls.start(e)} />
    </Reorder.Item>
  );
}
