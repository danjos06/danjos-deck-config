import type { DitherMode } from '../types';
import { ditherGray } from './dither';

export const OLED_W = 128;
export const OLED_H = 64;
export const BITMAP_BYTES = 1024;

/** Returns a zeroed 1024-byte bitmap. */
export function emptyBitmap(): Uint8Array {
  return new Uint8Array(BITMAP_BYTES);
}

/**
 * Packs a 128x64 RGBA buffer into a 1024-byte 1-bit bitmap (row-major, MSB-first).
 * Luminance = 0.299R + 0.587G + 0.114B with alpha composited over black.
 * Pixel is ON when luminance > threshold (legacy rule); `invert` flips every bit afterwards.
 */
export function packPixels(
  rgba: Uint8ClampedArray | Uint8Array,
  opts: { threshold: number; invert: boolean; dither: DitherMode },
): Uint8Array {
  const n = OLED_W * OLED_H;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (o + 3 >= rgba.length) break;
    const a = rgba[o + 3] / 255;
    gray[i] = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) * a;
  }
  const bits = ditherGray(gray, OLED_W, OLED_H, opts.threshold, opts.dither);
  const out = emptyBitmap();
  for (let y = 0; y < OLED_H; y++) {
    for (let x = 0; x < OLED_W; x++) {
      const on = (bits[y * OLED_W + x] === 1) !== opts.invert;
      if (on) out[y * 16 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return out;
}

/** Reads one pixel (true = ON). Out-of-range coordinates return false. */
export function getPixel(bmp: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || x >= OLED_W || y < 0 || y >= OLED_H) return false;
  return ((bmp[y * 16 + (x >> 3)] >> (7 - (x & 7))) & 1) === 1;
}

/** Expands a bitmap to RGBA (ON pixels use `on`, OFF pixels are opaque black). */
export function bitmapToRGBA(
  bmp: Uint8Array,
  on: readonly [number, number, number] = [232, 246, 255],
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(OLED_W * OLED_H * 4));
  for (let y = 0; y < OLED_H; y++) {
    for (let x = 0; x < OLED_W; x++) {
      const o = (y * OLED_W + x) * 4;
      const lit = getPixel(bmp, x, y);
      out[o] = lit ? on[0] : 0;
      out[o + 1] = lit ? on[1] : 0;
      out[o + 2] = lit ? on[2] : 0;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Encodes bytes as base64. */
export function bitmapToBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x2000) s += String.fromCharCode(...b.subarray(i, i + 0x2000));
  return btoa(s);
}

/** Decodes base64 into a 1024-byte bitmap, or null when invalid / wrong length. */
export function tryBase64ToBitmap(s: string): Uint8Array | null {
  if (!s) return null;
  try {
    const bin = atob(s);
    if (bin.length !== BITMAP_BYTES) return null;
    const out = new Uint8Array(BITMAP_BYTES);
    for (let i = 0; i < BITMAP_BYTES; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Decodes base64 into a bitmap; returns a zeroed 1024 on invalid input. */
export function base64ToBitmap(s: string): Uint8Array {
  return tryBase64ToBitmap(s) ?? emptyBitmap();
}
