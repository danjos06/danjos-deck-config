import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-fg-muted',
  accent: 'bg-accent/15 text-accent',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-sky-400/15 text-sky-300',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = 'neutral', children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', tones[tone], className)}
    >
      {children}
    </span>
  );
}
