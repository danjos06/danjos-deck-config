import type { DitherMode } from '../types';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/**
 * Converts a grayscale plane (0..255, `w*h`) into 1-bit output (1 = ON) using the selected dither.
 * `none` follows the legacy rule: ON when luminance > threshold. The input is not modified.
 */
export function ditherGray(gray: Float32Array, w: number, h: number, threshold: number, mode: DitherMode): Uint8Array {
  const out = new Uint8Array(w * h);
  if (mode === 'none') {
    for (let i = 0; i < out.length; i++) out[i] = gray[i] > threshold ? 1 : 0;
    return out;
  }
  if (mode === 'bayer') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = threshold + ((BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5) * 255;
        out[y * w + x] = gray[y * w + x] > t ? 1 : 0;
      }
    }
    return out;
  }
  const buf = Float32Array.from(gray);
  const spread = (x: number, y: number, err: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    buf[y * w + x] += err;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const old = buf[y * w + x];
      const on = old > threshold;
      out[y * w + x] = on ? 1 : 0;
      const err = old - (on ? 255 : 0);
      if (mode === 'floyd-steinberg') {
        spread(x + 1, y, (err * 7) / 16);
        spread(x - 1, y + 1, (err * 3) / 16);
        spread(x, y + 1, (err * 5) / 16);
        spread(x + 1, y + 1, err / 16);
      } else {
        // Atkinson: 1/8 to six neighbours (propagates 3/4 of the error)
        const e = err / 8;
        spread(x + 1, y, e);
        spread(x + 2, y, e);
        spread(x - 1, y + 1, e);
        spread(x, y + 1, e);
        spread(x + 1, y + 1, e);
        spread(x, y + 2, e);
      }
    }
  }
  return out;
}
