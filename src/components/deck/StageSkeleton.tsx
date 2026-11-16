import { Logo } from '../brand/Logo';

/** Loader shown while the 3D chunk / models load: a shimmering device silhouette. */
export function StageSkeleton({ label = 'Carregando modelo 3D…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
      <div className="relative aspect-[1.55] w-[min(46%,440px)]">
        <div className="absolute inset-x-[9%] inset-y-[4%] rounded-[22px] bg-[linear-gradient(110deg,theme(colors.ink.800)_35%,theme(colors.ink.700)_50%,theme(colors.ink.800)_65%)] bg-[length:200%_100%] shadow-pop animate-shimmer [transform:perspective(900px)_rotateX(28deg)]" />
        <div className="absolute left-0 top-[32%] h-[38%] w-[9%] rounded-l-[40%] bg-ink-800 animate-breathe" />
        <div className="absolute right-0 top-[32%] h-[38%] w-[9%] rounded-r-[40%] bg-ink-800 animate-breathe" />
        <div className="absolute inset-x-[16%] top-[14%] grid h-[52%] grid-cols-3 gap-[4%] [transform:perspective(900px)_rotateX(28deg)]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="rounded-lg bg-ink-700/70 ring-1 ring-white/[0.04]" />
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs font-medium text-fg-dim">
        <Logo variant="mark" size={16} className="animate-breathe" /> {label}
      </p>
    </div>
  );
}
