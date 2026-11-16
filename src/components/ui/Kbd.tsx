import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-white/10 border-b-2 bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] leading-none text-fg',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
