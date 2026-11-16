import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';
import { Icon } from './Icon';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  mono?: boolean;
}

/** Native select with custom chrome (keeps full a11y + mobile pickers). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, mono, children, ...rest }, ref) {
  return (
    <div className="relative min-w-0">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full min-w-0 appearance-none truncate rounded-lg border border-white/[0.08] bg-ink-950 pl-3 pr-8 text-sm text-fg transition-colors hover:border-white/15 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-40',
          mono && 'font-mono text-[13px]',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon name="expand_more" size={18} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-dim" />
    </div>
  );
});
