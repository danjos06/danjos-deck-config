import { PIN_LABELS } from '@/core/pinout/esp32s3';
import type { EncoderFn } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { actionSummary } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Icon } from '../ui';

export const ENCODER_FN_META: Record<EncoderFn, { label: string; icon: string }> = {
  ccw: { label: 'Anti-horário', icon: 'rotate_left' },
  sw: { label: 'Botão', icon: 'radio_button_checked' },
  cw: { label: 'Horário', icon: 'rotate_right' },
};
const ORDER: EncoderFn[] = ['ccw', 'sw', 'cw'];

/** True when the encoder has no CLK/DT GPIO (e.g. encoder 2 by default). */
export function useEncoderPins(enc: 0 | 1) {
  const pins = useDeckStore((s) => s.config.hardware.pins);
  const clk = enc === 0 ? pins.enc1Clk : pins.enc2Clk;
  const dt = enc === 0 ? pins.enc1Dt : pins.enc2Dt;
  const sw = enc === 0 ? pins.enc1Sw : pins.enc2Sw;
  return { disabled: clk === -1 || dt === -1, swDisabled: sw === -1 };
}

/** CCW / SW / CW function chips with action summaries (or the "disabled, configure pins" hint). */
export function EncoderFunctionList({ enc, className, row = false }: { enc: 0 | 1; className?: string; /** chips side by side */ row?: boolean }) {
  const pages = useDeckStore((s) => s.config.pages);
  const actions = useDeckStore((s) => s.config.encoders[enc]);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const openModal = useUiStore((s) => s.openModal);
  const { disabled, swDisabled } = useEncoderPins(enc);

  if (disabled) {
    return (
      <div className={cn('w-full rounded-lg border border-dashed border-white/10 bg-black/20 p-2 text-center', className)}>
        <p className="text-[11px] leading-snug text-fg-muted">Desativado: {PIN_LABELS[enc === 0 ? 'enc1Clk' : 'enc2Clk']} e DT sem GPIO.</p>
        <button
          type="button"
          onClick={() => openModal('pinout')}
          className="mt-1 inline-flex items-center gap-1 rounded text-[11px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <Icon name="memory" size={13} /> Configurar no Pinout
        </button>
      </div>
    );
  }

  return (
    <div className={cn(row ? 'grid w-full grid-cols-3 gap-1.5' : 'flex w-full flex-col gap-1.5', className)}>
      {ORDER.map((fn) => {
        const active = selection?.kind === 'encoder' && selection.enc === enc && selection.fn === fn;
        const off = fn === 'sw' && swDisabled;
        const summary = actionSummary(actions[fn], pages);
        return (
          <button
            key={fn}
            type="button"
            disabled={off}
            onClick={() => select({ kind: 'encoder', enc, fn })}
            title={off ? 'Botão do encoder sem GPIO (veja Pinout)' : `${ENCODER_FN_META[fn].label}: ${summary}`}
            aria-pressed={active}
            className={cn(
              'flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
              active ? 'border-accent/60 bg-accent/10 shadow-[0_0_14px_-4px_rgb(var(--accent)/0.5)]' : 'border-white/[0.06] bg-black/25 hover:border-white/15 hover:bg-black/40',
              off && 'cursor-not-allowed opacity-35',
            )}
          >
            <Icon name={ENCODER_FN_META[fn].icon} size={16} className={active ? 'text-accent' : 'text-fg-muted'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] uppercase tracking-wider text-fg-dim">{ENCODER_FN_META[fn].label}</span>
              <span className={cn('block truncate text-[11.5px] font-medium', active ? 'text-fg' : 'text-fg-muted')}>{summary}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
