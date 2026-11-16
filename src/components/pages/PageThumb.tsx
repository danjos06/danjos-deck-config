import { memo, useEffect, useRef } from 'react';
import { OLED_H, OLED_W } from '@/core/bitmap/pack';
import { bitmapB64ToImageData } from '@/lib/ui/oled';
import type { Page } from '@/core/types';

const GAP = 6;
const W = OLED_W * 3 + GAP * 2;
const H = OLED_H * 2 + GAP;

/** Mini preview of the 6 key bitmaps of a page (3x2). */
export const PageThumb = memo(function PageThumb({ page }: { page: Page }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sig = page.keys.map((k) => k.bitmap).join('|');

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0b0d';
    ctx.fillRect(0, 0, W, H);
    const tmp = document.createElement('canvas');
    tmp.width = OLED_W;
    tmp.height = OLED_H;
    const t = tmp.getContext('2d');
    if (!t) return;
    page.keys.forEach((k, i) => {
      t.putImageData(bitmapB64ToImageData(k.bitmap), 0, 0);
      ctx.drawImage(tmp, (i % 3) * (OLED_W + GAP), Math.floor(i / 3) * (OLED_H + GAP));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return <canvas ref={ref} width={W} height={H} aria-hidden="true" className="h-auto w-14 shrink-0 rounded-[4px] ring-1 ring-white/10" />;
});
