import { memo, useMemo, useState } from 'react';
import { describeGpio, GPIO_TAG_LABELS, PIN_LABELS } from '@/core/pinout/esp32s3';
import type { PinIssue, PinSeverity } from '@/core/pinout/validate';
import type { GpioTag, PinId } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { BoardArt } from './BoardArt';
import { BOARD, type HeaderPin, J1, J3, pinY, SHORT_LABELS, VIEW } from './devkitc1';
import { worst } from './PinTable';

const CAUTION: GpioTag[] = ['strapping', 'psram', 'jtag', 'uart', 'flash'];

interface PinDiagramProps {
  pins: Record<PinId, number>;
  issues: PinIssue[];
  /** GPIO highlighted from the table (row hover). */
  highlight: number | null;
  onHover: (gpio: number | null) => void;
  /** Pad clicked / activated: focus that pin's table row. */
  onActivate: (gpio: number) => void;
}

interface PadInfo {
  side: 'l' | 'r';
  i: number;
  pin: HeaderPin;
}

/** ESP32-S3-DevKitC-1 drawing with live pads (assignment / validation colours), callouts and tooltips. */
export const PinDiagram = memo(function PinDiagram({ pins, issues, highlight, onHover, onActivate }: PinDiagramProps) {
  const [hover, setHover] = useState<PadInfo | null>(null);

  const assigned = useMemo(() => {
    const m = new Map<number, PinId[]>();
    (Object.keys(pins) as PinId[]).forEach((id) => {
      if (pins[id] >= 0) m.set(pins[id], [...(m.get(pins[id]) ?? []), id]);
    });
    return m;
  }, [pins]);

  const sevOf = (gpio: number): PinSeverity | null =>
    worst(issues.filter((i) => i.gpio === gpio || (i.pin in pins && pins[i.pin as PinId] === gpio)));

  const pads: PadInfo[] = [...J1.map((pin, i) => ({ side: 'l' as const, i, pin })), ...J3.map((pin, i) => ({ side: 'r' as const, i, pin }))];

  const renderPad = (p: PadInfo) => {
    const x = p.side === 'l' ? BOARD.leftX : BOARD.rightX;
    const y = pinY(p.i);
    const silkX = p.side === 'l' ? x + 15 : x - 15;
    const anchor = p.side === 'l' ? 'start' : 'end';
    const silk = (
      <text x={silkX} y={y + 3.5} textAnchor={anchor} fontSize={10} fontWeight={700} className="pointer-events-none fill-pcb-silk">
        {p.pin.silk}
      </text>
    );
    if (p.pin.kind !== 'gpio') {
      return (
        <g key={`${p.side}${p.i}`}>
          <rect x={x - BOARD.padR} y={y - BOARD.padR} width={BOARD.padR * 2} height={BOARD.padR * 2} rx={p.i === 0 ? 1 : BOARD.padR} className="fill-pcb-goldDeep" />
          <circle cx={x} cy={y} r={3.6} className="fill-pcb-board" />
          {silk}
        </g>
      );
    }
    const gpio = p.pin.gpio;
    const ids = assigned.get(gpio);
    const sev = sevOf(gpio);
    const tags = describeGpio(gpio).tags;
    const usb = tags.includes('usb');
    const caution = sev === 'warning' || tags.some((t) => CAUTION.includes(t));
    const lit = highlight === gpio || (hover?.pin.kind === 'gpio' && hover.pin.gpio === gpio);
    const fill = sev === 'error' ? 'fill-danger' : ids ? 'fill-accent' : 'fill-pcb-gold';
    const label = ids?.map((id) => SHORT_LABELS[id]).join(' + ');
    const lineEnd = p.side === 'l' ? -12 : BOARD.w + 12;
    return (
      <g
        key={`${p.side}${p.i}`}
        role="button"
        tabIndex={0}
        aria-label={`GPIO ${gpio}${label ? `: ${ids?.map((id) => PIN_LABELS[id]).join(', ')}` : ', livre'}`}
        className="cursor-pointer outline-none [&:focus-visible>circle.ring]:opacity-100"
        onPointerEnter={() => (setHover(p), onHover(gpio))}
        onPointerLeave={() => (setHover(null), onHover(null))}
        onFocus={() => (setHover(p), onHover(gpio))}
        onBlur={() => (setHover(null), onHover(null))}
        onClick={() => onActivate(gpio)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate(gpio);
          }
        }}
      >
        <circle cx={x} cy={y} r={BOARD.padR + 6} className="fill-transparent" />
        <circle cx={x} cy={y} r={BOARD.padR + 5} className={cn('ring fill-none stroke-fg transition-opacity', lit ? 'opacity-100' : 'opacity-0')} strokeWidth={2} />
        {caution && <circle cx={x} cy={y} r={BOARD.padR + 2.5} className="fill-none stroke-warn" strokeWidth={2.5} />}
        {usb && <circle cx={x} cy={y} r={BOARD.padR + 2.5} className="fill-none stroke-danger" strokeWidth={2} strokeDasharray="3 2.5" />}
        <circle cx={x} cy={y} r={BOARD.padR} className={cn(fill, 'transition-colors')} />
        <circle cx={x} cy={y} r={3.6} className="fill-pcb-board" />
        {silk}
        {label && (
          <g className="pointer-events-none">
            <path d={`M${p.side === 'l' ? x - BOARD.padR - 3 : x + BOARD.padR + 3} ${y} H${lineEnd}`} className={sev === 'error' ? 'stroke-danger' : 'stroke-accent'} strokeWidth={1.5} />
            <circle cx={lineEnd} cy={y} r={2.5} className={sev === 'error' ? 'fill-danger' : 'fill-accent'} />
            <text x={p.side === 'l' ? lineEnd - 7 : lineEnd + 7} y={y + 4} textAnchor={p.side === 'l' ? 'end' : 'start'} fontSize={12} fontWeight={700} className={sev === 'error' ? 'fill-danger' : 'fill-fg'}>
              {label}
            </text>
          </g>
        )}
        {usb && !label && (
          <text x={p.side === 'l' ? lineEnd : lineEnd} y={y + 4} textAnchor={p.side === 'l' ? 'end' : 'start'} fontSize={10} className="pointer-events-none fill-danger/80">
            USB {gpio === 19 ? 'D-' : 'D+'}
          </text>
        )}
      </g>
    );
  };

  const tip = hover?.pin.kind === 'gpio' ? hover : null;
  const tipGpio = tip && tip.pin.kind === 'gpio' ? tip.pin.gpio : -1;
  const tipInfo = tip ? describeGpio(tipGpio) : null;
  const tipIds = tip ? assigned.get(tipGpio) : undefined;

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-ink-950 p-3">
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="mx-auto block h-auto w-full max-w-[520px]" role="group" aria-label="Placa ESP32-S3-DevKitC-1: pinos e funções atribuídas" style={{ fontFamily: 'Inter, sans-serif' }}>
        <BoardArt />
        {pads.map(renderPad)}
      </svg>
      {tip && tipInfo && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-[220px] rounded-lg border border-white/10 bg-ink-800/95 p-2.5 text-[11px] leading-snug text-fg-muted shadow-pop backdrop-blur"
          style={{
            left: `${((tip.side === 'l' ? BOARD.leftX + 30 : BOARD.rightX - 250) - VIEW.x) / VIEW.w * 100}%`,
            top: `${(pinY(tip.i) / VIEW.h) * 100}%`,
          }}
        >
          <p className="font-mono text-[12px] font-semibold text-fg">GPIO {tipGpio}</p>
          {tipInfo.tags.length > 0 && <p className="mt-0.5 text-fg-dim">{tipInfo.tags.map((t) => GPIO_TAG_LABELS[t]).join(' · ')}</p>}
          <p className={cn('mt-1', tipIds ? 'text-accent' : 'text-fg-dim')}>{tipIds ? tipIds.map((id) => PIN_LABELS[id]).join(', ') : 'Livre'}</p>
          {tipInfo.note && <p className="mt-1">{tipInfo.note}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-fg-dim">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-accent" /> Em uso</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-pcb-gold" /> Livre</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full border-2 border-warn" /> Cuidado (strapping/JTAG/PSRAM/UART)</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full border-2 border-dashed border-danger" /> USB D-/D+</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-danger" /> Erro</span>
      </div>
    </div>
  );
});
