import { cn } from '@/lib/ui/cn';
import { EncoderFunctionList, useEncoderPins } from '../deck/EncoderFunctionList';
import { Icon } from '../ui';
import { useFocusStore } from './focusStore';

/**
 * HTML legend for one encoder (CW / CCW / SW + action summaries), docked beside or below the canvas in
 * its own grid cell (above it in z-order) so it never overlaps the model. Hovering/focusing it only makes
 * the matching knob glow; it never moves the camera.
 */
export function EncoderLegend({ enc, className, row = false }: { enc: 0 | 1; className?: string; row?: boolean }) {
  const setHover = useFocusStore((s) => s.setHoverKnob);
  const { disabled } = useEncoderPins(enc);
  const enter = () => setHover(enc);
  const leave = () => setHover(null);
  return (
    <section
      aria-label={`Encoder ${enc + 1} (${enc === 0 ? 'lateral esquerda' : 'lateral direita'})`}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      className={cn(
        'surface-matte relative z-10 min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900/75 p-2.5 shadow-panel backdrop-blur-sm transition-colors hover:border-white/[0.12]',
        className,
      )}
    >
      <header className={cn(row ? 'mb-1.5 flex min-w-0 items-center gap-1.5' : 'mb-2 flex min-w-0 items-center gap-1.5', enc === 1 && 'flex-row-reverse text-right')}>
        <Icon name={enc === 0 ? 'west' : 'east'} size={14} className="text-fg-dim" />
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">Encoder {enc + 1}</span>
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', disabled ? 'bg-fg-dim/50' : 'bg-accent shadow-led')} />
      </header>
      <EncoderFunctionList enc={enc} row={row} />
    </section>
  );
}
