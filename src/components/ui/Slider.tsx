import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/ui/cn';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Bulk editing with differing values: faded handle and a "—" readout. */
  mixed?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange, mixed, disabled, className }: SliderProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('min-w-0', disabled && 'opacity-40', className)}>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="truncate text-xs text-fg-muted">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 rounded bg-ink-950 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg">
          {mixed ? '—' : Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}
          {!mixed && unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={cn('ui-range', mixed && 'opacity-50')}
        aria-valuetext={mixed ? 'Vários valores' : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
