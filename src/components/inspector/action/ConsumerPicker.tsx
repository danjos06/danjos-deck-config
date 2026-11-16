import type { CONSUMER_MAP } from '@/core/constants';
import { CONSUMER_INFO } from '@/core/constants';
import { cn } from '@/lib/ui/cn';
import { Icon } from '../../ui';

type ConsumerName = keyof typeof CONSUMER_MAP;
const NAMES = Object.keys(CONSUMER_INFO) as ConsumerName[];

export function ConsumerPicker({ value, onPick }: { value: ConsumerName; onPick: (c: ConsumerName) => void }) {
  return (
    <div role="listbox" aria-label="Controles de mídia" className="grid grid-cols-2 gap-1.5">
      {NAMES.map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onPick(n)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
              on ? 'border-accent/60 bg-accent/10 text-fg' : 'border-white/[0.07] bg-ink-950 text-fg-muted hover:text-fg',
            )}
          >
            <Icon name={CONSUMER_INFO[n].icon} size={18} className={on ? 'text-accent' : ''} />
            <span className="truncate">{CONSUMER_INFO[n].label}</span>
          </button>
        );
      })}
    </div>
  );
}
