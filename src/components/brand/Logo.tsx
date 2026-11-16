import { useMemo } from 'react';
import { cn } from '@/lib/ui/cn';
import { LOCKUP, MARK, markPaths } from './logoGeometry';

interface LogoProps {
  variant?: 'full' | 'mark';
  /** Rendered height in px (width follows the aspect ratio). */
  size?: number;
  className?: string;
  /** Accessible name; omit for decorative use. */
  title?: string;
}

/**
 * Official DANJOS DECK logo as inline SVG: stroke-only interlocked 3x3 tile mark (accent token) and the
 * two-line Montserrat ExtraBold wordmark (DANJOS white, DECK grey, like the printed plate).
 */
export function Logo({ variant = 'full', size = 28, className, title }: LogoProps) {
  const paths = useMemo(markPaths, []);
  const w = variant === 'full' ? LOCKUP.width : MARK.width;
  const h = MARK.height;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      height={size}
      width={(size * w) / h}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <g fill="none" strokeWidth={MARK.stroke} strokeLinejoin="round" className="stroke-accent">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {variant === 'full' && (
        <g style={{ fontFamily: 'Montserrat, Inter, sans-serif', fontWeight: 800 }}>
          <text
            x={LOCKUP.textX}
            y={LOCKUP.danjos.baseline}
            fontSize={LOCKUP.danjos.size}
            textLength={LOCKUP.danjos.length}
            lengthAdjust="spacingAndGlyphs"
            className="fill-fg"
          >
            DANJOS
          </text>
          <text
            x={LOCKUP.deck.centerX}
            y={LOCKUP.deck.baseline}
            fontSize={LOCKUP.deck.size}
            textAnchor="middle"
            textLength={LOCKUP.deck.length}
            lengthAdjust="spacingAndGlyphs"
            className="fill-brand-deck"
          >
            DECK
          </text>
        </g>
      )}
    </svg>
  );
}
