import { useEffect, useRef, useState } from 'react';
import { useRafThrottle } from '@/hooks/useRafThrottle';
import { Slider } from '../ui';

interface LiveSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  mixed?: boolean;
  onCommit: (v: number) => void;
}

/** Slider with local state; commits at most once per animation frame so dragging stays smooth. */
export function LiveSlider({ label, value, min, max, step, unit, mixed, onCommit }: LiveSliderProps) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const commit = useRafThrottle(onCommit);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  return (
    <div
      onPointerDown={() => {
        dragging.current = true;
        const up = () => {
          dragging.current = false;
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
        };
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      }}
    >
      <Slider
        label={label}
        value={local}
        min={min}
        max={max}
        step={step}
        unit={unit}
        mixed={mixed}
        onChange={(v) => {
          setLocal(v);
          commit(v);
        }}
      />
    </div>
  );
}
