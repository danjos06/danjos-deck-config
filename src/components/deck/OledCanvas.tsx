import { memo, useEffect, useRef } from 'react';
import { OLED_H, OLED_W } from '@/core/bitmap/pack';
import { bitmapB64ToImageData } from '@/lib/ui/oled';
import { cn } from '@/lib/ui/cn';

interface OledCanvasProps {
  /** base64 of the 1024-byte bitmap. */
  bitmap: string;
  className?: string;
  /** Draws a faint pixel grid overlay (used in previews). */
  grid?: boolean;
  /** Pale-blue-white "on" colour. */
  glow?: boolean;
}

/** Draws a 128x64 1-bit bitmap crisp-scaled. Redraws only when `bitmap` changes. */
export const OledCanvas = memo(function OledCanvas({ bitmap, className, grid, glow = true }: OledCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(bitmapB64ToImageData(bitmap), 0, 0);
  }, [bitmap]);

  return (
    <div className={cn('relative aspect-[2/1] w-full overflow-hidden bg-black', className)}>
      <canvas
        ref={ref}
        width={OLED_W}
        height={OLED_H}
        className="pixelated absolute inset-0 h-full w-full"
        style={glow ? { filter: 'drop-shadow(0 0 1.5px rgba(150,215,255,0.45))' } : undefined}
      />
      {grid && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.55) 1px, transparent 1px)',
            backgroundSize: `${100 / OLED_W}% ${100 / OLED_H}%`,
          }}
        />
      )}
    </div>
  );
});
