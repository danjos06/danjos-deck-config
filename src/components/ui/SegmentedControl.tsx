import { useId } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';
import { focusRing } from './Button';
import { Icon } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
  title?: string;
}

interface Props<T extends string> {
  /** `null` = no option active (mixed value in bulk editing). */
  value: T | null;
  onChange: (v: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  iconOnly?: boolean;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label, size = 'md', className, iconOnly }: Props<T>) {
  const gid = useId();
  return (
    <LayoutGroup id={gid}>
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative inline-flex w-full min-w-0 gap-0.5 rounded-lg border border-white/[0.06] bg-ink-950 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? o.label : undefined}
            title={o.title ?? (iconOnly ? o.label : undefined)}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35',
              size === 'sm' ? 'h-7 px-1.5 text-[11px]' : 'h-8 px-2 text-xs',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              focusRing,
            )}
          >
            {active && (
              <motion.span
                layoutId="seg-pill"
                className="absolute inset-0 rounded-md bg-ink-600 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex min-w-0 items-center gap-1.5">
              {o.icon && <Icon name={o.icon} size={size === 'sm' ? 14 : 16} />}
              {!iconOnly && <span className="truncate">{o.label}</span>}
            </span>
          </button>
        );
      })}
    </div>
    </LayoutGroup>
  );
}
