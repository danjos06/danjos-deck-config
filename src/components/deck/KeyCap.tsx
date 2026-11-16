import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';
import { OledCanvas } from './OledCanvas';

interface KeyCapProps {
  index: number;
  bitmap: string;
  name: string;
  summary: string;
  selected: boolean;
  onSelect: (index: number, mods: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
  onSwap: (from: number, to: number) => void;
}

/** One physical key: bezel + OLED. Click selects (Ctrl/Cmd toggles, Shift selects a range); drag onto another key swaps. */
export const KeyCap = memo(function KeyCap({ index, bitmap, name, summary, selected, onSelect, onSwap }: KeyCapProps) {
  const [flash, setFlash] = useState(0);
  const [over, setOver] = useState(false);

  return (
    <div
      className="flex min-w-0 flex-col items-center gap-1.5"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', `deck-key:${index}`);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const m = /^deck-key:(\d)$/.exec(e.dataTransfer.getData('text/plain'));
        if (m) onSwap(Number(m[1]), index);
      }}
    >
      <motion.button
        type="button"
        aria-label={`Tecla ${index + 1}: ${name || 'sem nome'}. ${summary}`}
        aria-pressed={selected}
        onClick={(e) => {
          onSelect(index, e);
          setFlash((n) => n + 1);
        }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
        className={cn(
          'group relative w-full select-none rounded-[18px] p-[9px] outline-none transition-shadow duration-200',
          'bg-gradient-to-b from-[#2a2d34] via-[#1b1d22] to-[#111215]',
          'shadow-[0_1px_0_rgba(255,255,255,0.09)_inset,0_-2px_0_rgba(0,0,0,0.5)_inset,0_10px_18px_-8px_rgba(0,0,0,0.9)]',
          'focus-visible:ring-2 focus-visible:ring-accent/70',
          selected ? 'ring-2 ring-accent shadow-glow' : 'hover:ring-1 hover:ring-white/20',
          over && 'ring-2 ring-sky-300',
        )}
      >
        <div className="relative overflow-hidden rounded-[10px] ring-1 ring-black shadow-[0_0_0_2px_#07080a]">
          <OledCanvas bitmap={bitmap} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
        </div>
        <span className="pointer-events-none absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-950 font-mono text-[10px] text-fg-muted ring-1 ring-white/10">
          {index + 1}
        </span>
        {flash > 0 && (
          <motion.span
            key={flash}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[18px] ring-2 ring-accent"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
      </motion.button>
      <span className={cn('max-w-full truncate px-1 text-center text-[11px] font-medium leading-none', selected ? 'text-accent' : 'text-fg-dim')}>{summary}</span>
    </div>
  );
});
