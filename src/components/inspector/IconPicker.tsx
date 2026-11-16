import { memo, useDeferredValue, useMemo, useState } from 'react';
import { MATERIAL_ICON_NAMES, searchIcons } from '@/core/bitmap/icons';
import { useElementSize } from '@/hooks/useElementSize';
import { cn } from '@/lib/ui/cn';
import { Icon, Input } from '../ui';

const CELL = 42;
const VIEW_H = 236;
const OVERSCAN = 2;

const Cell = memo(function Cell({ name, selected, onPick }: { name: string; selected: boolean; onPick: (n: string) => void }) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name.replace(/_/g, ' ')}
      aria-pressed={selected}
      onClick={() => onPick(name)}
      style={{ width: CELL, height: CELL }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        selected ? 'bg-accent text-black' : 'text-fg-muted hover:bg-white/[0.08] hover:text-fg',
      )}
    >
      <Icon name={name} size={24} />
    </button>
  );
});

interface IconPickerProps {
  value: string;
  onPick: (name: string) => void;
}

/** Searchable, windowed grid over all Material Symbols names. */
export function IconPicker({ value, onPick }: IconPickerProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);

  const results = useMemo(() => searchIcons(deferred, MATERIAL_ICON_NAMES.length), [deferred]);
  const cols = Math.max(1, Math.floor((size.width || 300) / CELL));
  const rows = Math.ceil(results.length / cols);
  const first = Math.max(0, Math.floor(scrollTop / CELL) - OVERSCAN);
  const last = Math.min(rows, Math.ceil((scrollTop + VIEW_H) / CELL) + OVERSCAN);
  const visible = results.slice(first * cols, last * cols);

  return (
    <div className="min-w-0">
      <div className="relative mb-2">
        <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-dim" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setScrollTop(0);
          }}
          placeholder="Buscar ícone (ex.: volume, home, mic…)"
          aria-label="Buscar ícone"
          className="pl-8"
        />
      </div>
      <div
        ref={ref}
        role="listbox"
        aria-label="Ícones"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ height: VIEW_H }}
        className="relative overflow-y-auto overflow-x-hidden rounded-xl border border-white/[0.06] bg-ink-950"
      >
        {results.length === 0 ? (
          <p className="p-6 text-center text-xs text-fg-dim">Nenhum ícone encontrado para “{deferred}”.</p>
        ) : (
          <div style={{ height: rows * CELL, position: 'relative' }}>
            <div style={{ position: 'absolute', top: first * CELL, left: 0, right: 0, display: 'flex', flexWrap: 'wrap' }}>
              {visible.map((n) => (
                <Cell key={n} name={n} selected={n === value} onPick={onPick} />
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-fg-dim">
        <span className="truncate font-mono">{value}</span>
        <span className="shrink-0">{results.length.toLocaleString('pt-BR')} ícones</span>
      </p>
    </div>
  );
}
