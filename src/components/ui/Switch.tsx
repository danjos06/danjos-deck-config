import { cn } from '@/lib/ui/cn';
import { focusRing } from './Button';

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hideLabel?: boolean;
  /** Indeterminate state (bulk editing with differing values). Clicking turns it on. */
  mixed?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, hideLabel, mixed, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(mixed ? true : !checked)}
      className={cn('group inline-flex min-w-0 items-center gap-2 rounded-md text-xs text-fg-muted disabled:opacity-40', focusRing, className)}
    >
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          mixed ? 'border-white/20 bg-ink-500' : checked ? 'border-accent/60 bg-accent' : 'border-white/10 bg-ink-600',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150',
            mixed ? 'translate-x-2 opacity-60' : checked && 'translate-x-4',
          )}
        />
      </span>
      {!hideLabel && <span className="truncate group-hover:text-fg">{label}{mixed && <span className="ml-1 text-fg-dim">(Misto)</span>}</span>}
    </button>
  );
}
