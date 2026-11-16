import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}

export function Section({ title, children, aside }: SectionProps) {
  return (
    <section className="border-b border-white/[0.06] px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">{title}</h3>
        {aside}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
