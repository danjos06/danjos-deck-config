import { useMemo } from 'react';
import { PIN_IDS } from '@/core/constants';
import { createDefaultHardware } from '@/core/defaults';
import { describeGpio, PIN_LABELS } from '@/core/pinout/esp32s3';
import type { PinIssue, PinSeverity } from '@/core/pinout/validate';
import type { HardwareConfig, PinId } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { useDeckStore } from '@/store/deckStore';
import { Badge, Icon, Switch, Tooltip, type BadgeTone } from '../../ui';

export const SEVERITY_TONE: Record<PinSeverity, BadgeTone> = { error: 'danger', warning: 'warn', info: 'info' };
export const SEVERITY_ICON: Record<PinSeverity, string> = { error: 'error', warning: 'warning', info: 'info' };
const RANK: Record<PinSeverity, number> = { error: 3, warning: 2, info: 1 };

const FALLBACK = [10, 11, 12, 13, 14, 21, 47, 48, 38, 39, 40, 41, 42];

/** Picks a sensible GPIO when a pin is re-enabled. */
function suggest(id: PinId, pins: Record<PinId, number>): number {
  const used = new Set(Object.values(pins));
  const def = createDefaultHardware().pins[id];
  if (def >= 0 && !used.has(def)) return def;
  return FALLBACK.find((g) => !used.has(g)) ?? 10;
}

export function worst(issues: PinIssue[]): PinSeverity | null {
  return issues.reduce<PinSeverity | null>((w, i) => (w === null || RANK[i.severity] > RANK[w] ? i.severity : w), null);
}

interface PinTableProps {
  hardware: HardwareConfig;
  issues: PinIssue[];
  /** GPIO highlighted on the board (pad hover): its rows are tinted. */
  highlight?: number | null;
  /** Row hover -> highlight the pad on the board drawing. */
  onRowHover?: (gpio: number | null) => void;
}

/** DOM id of a pin's row (used by the board drawing to scroll/focus it). */
export const pinRowId = (id: PinId) => `pin-row-${id}`;

export function PinTable({ hardware, issues, highlight = null, onRowHover }: PinTableProps) {
  const setPin = useDeckStore((s) => s.setPin);
  const byPin = useMemo(() => {
    const m = new Map<string, PinIssue[]>();
    issues.forEach((i) => m.set(i.pin, [...(m.get(i.pin) ?? []), i]));
    return m;
  }, [issues]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Pinos configuráveis</caption>
        <thead>
          <tr className="bg-ink-950 text-left text-[10px] uppercase tracking-wider text-fg-dim">
            <th className="px-3 py-2 font-semibold">Função</th>
            <th className="w-[84px] px-2 py-2 font-semibold">GPIO</th>
            <th className="w-[54px] px-2 py-2 text-center font-semibold">Ativo</th>
            <th className="w-[84px] px-2 py-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {PIN_IDS.map((id) => {
            const g = hardware.pins[id];
            const on = g >= 0;
            const rowIssues = byPin.get(id) ?? [];
            const sev = worst(rowIssues);
            const tags = on ? describeGpio(g).tags : [];
            return (
              <tr
                key={id}
                id={pinRowId(id)}
                onPointerEnter={() => onRowHover?.(on ? g : null)}
                onPointerLeave={() => onRowHover?.(null)}
                className={cn(
                  'scroll-mt-16 border-t border-white/[0.05] transition-colors',
                  sev === 'error' && 'bg-danger/[0.05]',
                  on && highlight === g && 'bg-accent/[0.08]',
                )}
              >
                <td className="truncate px-3 py-1.5 text-[13px] text-fg">
                  {PIN_LABELS[id]}
                  {tags.length > 0 && <span className="ml-1.5 font-mono text-[10px] text-fg-dim">{tags.join(' ')}</span>}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={48}
                    disabled={!on}
                    value={on ? g : ''}
                    placeholder="—"
                    aria-label={`GPIO de ${PIN_LABELS[id]}`}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      if (Number.isFinite(n)) setPin(id, n);
                    }}
                    className={cn(
                      'h-7 w-full rounded-md border bg-ink-950 px-2 font-mono text-[12px] text-fg focus:border-accent/60 focus:outline-none disabled:opacity-40',
                      sev === 'error' ? 'border-danger/60' : sev === 'warning' ? 'border-warn/50' : 'border-white/[0.08]',
                    )}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <Switch hideLabel label={`${PIN_LABELS[id]} ativo`} checked={on} onChange={(v) => setPin(id, v ? suggest(id, hardware.pins) : -1)} />
                </td>
                <td className="px-2 py-1.5">
                  {sev ? (
                    <Tooltip label={rowIssues.map((i) => i.message).join(' ')}>
                      <span tabIndex={0} className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
                        <Badge tone={SEVERITY_TONE[sev]}>
                          <Icon name={SEVERITY_ICON[sev]} size={11} fill /> {rowIssues.length}
                        </Badge>
                      </span>
                    </Tooltip>
                  ) : (
                    <Badge tone={on ? 'ok' : 'neutral'}>{on ? 'OK' : 'Off'}</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
