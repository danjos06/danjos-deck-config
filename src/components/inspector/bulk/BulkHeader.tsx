import { cn } from '@/lib/ui/cn';
import { useUiStore } from '@/store/uiStore';
import { Button } from '../../ui';

/** Title block + chips of the selected keys (click one to narrow the selection to it). */
export function BulkHeader({ indices }: { indices: number[] }) {
  const select = useUiStore((s) => s.select);
  return (
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-sm font-semibold text-fg">{indices.length} teclas selecionadas</h2>
      <div className="mt-1.5 flex flex-wrap items-center gap-1" role="group" aria-label="Teclas selecionadas">
        {indices.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => select({ kind: 'key', index: i })}
            aria-label={`Editar somente a tecla ${i + 1}`}
            title={`Editar somente a tecla ${i + 1}`}
            className={cn(
              'flex h-6 min-w-6 items-center justify-center rounded-md bg-accent/15 px-1.5 font-mono text-[11px] text-accent ring-1 ring-accent/30 transition-colors',
              'hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
            )}
          >
            {i + 1}
          </button>
        ))}
        <Button size="sm" variant="ghost" icon="deselect" onClick={() => select(null)}>
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}
