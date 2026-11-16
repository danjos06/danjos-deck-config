import { useId } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';
import { focusRing } from './Button';
import { Icon } from './Icon';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  items: readonly TabItem<T>[];
  label: string;
  className?: string;
}

/** Underline tabs (role=tablist). Arrow keys move between tabs. */
export function Tabs<T extends string>({ value, onChange, items, label, className }: Props<T>) {
  const gid = useId();
  const onKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length].value);
    else if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length].value);
  };
  return (
    <LayoutGroup id={gid}>
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn('flex gap-1 border-b border-white/[0.06]', className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative flex h-10 items-center gap-1.5 rounded-t-md px-3 text-sm font-medium transition-colors',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              focusRing,
            )}
          >
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
            {active && <motion.span layoutId="tab-underline" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
    </LayoutGroup>
  );
}
