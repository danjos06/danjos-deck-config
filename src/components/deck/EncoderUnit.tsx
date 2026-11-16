import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { EncoderFn } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { useUiStore } from '@/store/uiStore';
import { EncoderFunctionList, useEncoderPins } from './EncoderFunctionList';

const TICKS = Array.from({ length: 48 }, (_, i) => i);

function Knob({ angle, disabled, onWheelDir }: { angle: ReturnType<typeof useSpring>; disabled: boolean; onWheelDir: (d: 1 | -1) => void }) {
  const drag = useRef<{ lastA: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const raw = useMotionValue(0);
  const [grab, setGrab] = useState(false);

  const pointerAngle = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 0;
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Knob do encoder (gire com a roda do mouse ou arrastando)"
      onWheel={(e) => {
        if (disabled) return;
        const dir = e.deltaY > 0 ? 1 : -1;
        raw.set(raw.get() + dir * 22);
        angle.set(raw.get());
        onWheelDir(dir);
      }}
      onPointerDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { lastA: pointerAngle(e) };
        setGrab(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const a = pointerAngle(e);
        let d = a - drag.current.lastA;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        drag.current.lastA = a;
        raw.set(raw.get() + d);
        angle.set(raw.get());
        if (Math.abs(d) > 0.5) onWheelDir(d > 0 ? 1 : -1);
      }}
      onPointerUp={() => {
        drag.current = null;
        setGrab(false);
      }}
      className={cn('relative aspect-square w-[118px] touch-none select-none rounded-full', disabled ? 'cursor-not-allowed' : grab ? 'cursor-grabbing' : 'cursor-grab')}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#050506] to-[#1d1f24] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.9),0_0_0_3px_#0a0b0d,0_0_0_4px_rgba(255,255,255,0.07)]" />
      <motion.div style={{ rotate: angle }} className="absolute inset-[7px] rounded-full bg-[conic-gradient(from_0deg,#2d3037,#4b5059,#23262b,#454a52,#2a2d33,#50555e,#23262b,#454a52,#2d3037)] shadow-[0_2px_0_rgba(255,255,255,0.12)_inset,0_-3px_6px_rgba(0,0,0,0.5)_inset]">
        {TICKS.map((i) => (
          <span key={i} aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${i * 7.5}deg)` }}>
            <span className="block h-[7px] w-px bg-black/45" />
          </span>
        ))}
        <span aria-hidden="true" className="absolute left-1/2 top-[9px] h-3.5 w-1 -translate-x-1/2 rounded-full bg-accent shadow-led" />
        <span aria-hidden="true" className="absolute inset-[26%] rounded-full bg-gradient-to-b from-[#1a1c20] to-[#33363d] shadow-[0_2px_4px_rgba(0,0,0,0.6)_inset]" />
      </motion.div>
    </div>
  );
}

interface EncoderUnitProps {
  enc: 0 | 1;
}

export function EncoderUnit({ enc }: EncoderUnitProps) {
  const select = useUiStore((s) => s.select);
  const angle = useSpring(0, { stiffness: 220, damping: 22 });
  const { disabled } = useEncoderPins(enc);
  const pick = (fn: EncoderFn) => select({ kind: 'encoder', enc, fn });

  return (
    <div className={cn('flex w-full min-w-0 flex-col items-center gap-3', disabled && 'opacity-90')}>
      <div className={cn('flex flex-col items-center gap-1', disabled && 'opacity-35 saturate-0')}>
        <Knob angle={angle} disabled={disabled} onWheelDir={(d) => pick(d > 0 ? 'cw' : 'ccw')} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-dim">Encoder {enc + 1}</p>
      <EncoderFunctionList enc={enc} />
    </div>
  );
}
