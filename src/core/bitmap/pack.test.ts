import { describe, expect, it } from 'vitest';
import { toCppArray } from './cpp';
import { searchIcons, MATERIAL_ICON_NAMES } from './icons';
import {
  BITMAP_BYTES,
  base64ToBitmap,
  bitmapToBase64,
  emptyBitmap,
  getPixel,
  packPixels,
} from './pack';

function rgbaWith(pixels: [number, number, number?][], fill = 0): Uint8ClampedArray {
  const a = new Uint8ClampedArray(128 * 64 * 4);
  for (let i = 0; i < 128 * 64; i++) {
    a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = fill;
    a[i * 4 + 3] = 255;
  }
  for (const [x, y, v = 255] of pixels) {
    const o = (y * 128 + x) * 4;
    a[o] = a[o + 1] = a[o + 2] = v;
  }
  return a;
}

const base = { threshold: 128, invert: false, dither: 'none' as const };

describe('packPixels', () => {
  it('uses MSB-first row-major layout', () => {
    const out = packPixels(rgbaWith([[0, 0], [7, 0], [8, 0], [0, 1], [127, 63]]), base);
    expect(out.length).toBe(BITMAP_BYTES);
    expect(out[0]).toBe(0x81); // (0,0)=0x80 and (7,0)=0x01
    expect(out[1]).toBe(0x80); // (8,0)
    expect(out[16]).toBe(0x80); // (0,1)
    expect(out[63 * 16 + 15]).toBe(0x01); // (127,63)
  });

  it('single pixels map to documented bits', () => {
    expect(packPixels(rgbaWith([[0, 0]]), base)[0]).toBe(0x80);
    expect(packPixels(rgbaWith([[7, 0]]), base)[0]).toBe(0x01);
    expect(packPixels(rgbaWith([[8, 0]]), base)[1]).toBe(0x80);
  });

  it('applies the legacy rule lum > threshold (strict)', () => {
    const px = rgbaWith([[0, 0, 128], [1, 0, 129]]);
    const out = packPixels(px, base);
    expect(getPixel(out, 0, 0)).toBe(false);
    expect(getPixel(out, 1, 0)).toBe(true);
    const low = packPixels(px, { ...base, threshold: 100 });
    expect(getPixel(low, 0, 0)).toBe(true);
  });

  it('inverts every bit', () => {
    const out = packPixels(rgbaWith([[0, 0]]), { ...base, invert: true });
    expect(getPixel(out, 0, 0)).toBe(false);
    expect(getPixel(out, 1, 0)).toBe(true);
    expect(out.filter((b) => b === 0xff).length).toBe(BITMAP_BYTES - 1);
  });

  it('composites alpha over black', () => {
    const a = rgbaWith([]);
    a[3] = 0; // pixel (0,0): white but fully transparent
    a[0] = a[1] = a[2] = 255;
    expect(getPixel(packPixels(a, base), 0, 0)).toBe(false);
  });

  it('dithers mid-gray into a mix of on/off pixels', () => {
    for (const dither of ['floyd-steinberg', 'atkinson', 'bayer'] as const) {
      const out = packPixels(rgbaWith([], 128), { ...base, threshold: 127, dither });
      let on = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) if (getPixel(out, x, y)) on++;
      expect(on).toBeGreaterThan(8192 * 0.2);
      expect(on).toBeLessThan(8192 * 0.8);
    }
  });
});

describe('base64', () => {
  it('roundtrips', () => {
    const b = emptyBitmap();
    for (let i = 0; i < b.length; i++) b[i] = (i * 7) & 0xff;
    expect(base64ToBitmap(bitmapToBase64(b))).toEqual(b);
  });
  it('returns zeroed 1024 on invalid input', () => {
    expect(base64ToBitmap('%%%')).toEqual(emptyBitmap());
    expect(base64ToBitmap(btoa('short'))).toEqual(emptyBitmap());
    expect(base64ToBitmap('')).toHaveLength(1024);
  });
});

describe('toCppArray', () => {
  it('formats 16 bytes per line', () => {
    const b = emptyBitmap();
    b[0] = 0xab;
    const src = toCppArray('my-icon', b);
    expect(src.startsWith('const uint8_t my_icon[1024] PROGMEM = {\n  0xAB, 0x00,')).toBe(true);
    expect(src.trimEnd().endsWith('};')).toBe(true);
    const lines = src.split('\n').filter((l) => l.startsWith('  0x'));
    expect(lines).toHaveLength(64);
    expect(lines[0].split(',').filter((s) => s.trim()).length).toBe(16);
  });
});

describe('searchIcons', () => {
  it('has the full Material Symbols list', () => {
    expect(MATERIAL_ICON_NAMES.length).toBeGreaterThan(3000);
    expect(MATERIAL_ICON_NAMES).toContain('play_arrow');
  });
  it('ranks exact/prefix > word-start > substring', () => {
    const r = searchIcons('play', 500);
    expect(r[0].startsWith('play')).toBe(true);
    expect(searchIcons('play_arrow')[0]).toBe('play_arrow');
    const iPrefix = r.indexOf('play_arrow');
    const iWord = r.findIndex((n) => !n.startsWith('play') && n.includes('_play'));
    const iSub = r.findIndex((n) => !n.startsWith('play') && !n.includes('_play'));
    expect(iPrefix).toBeGreaterThan(-1);
    expect(iWord).toBeGreaterThan(iPrefix);
    if (iSub >= 0) expect(iSub).toBeGreaterThan(iWord);
  });
  it('treats underscore and space alike and respects limit', () => {
    expect(searchIcons('skip next')).toContain('skip_next');
    expect(searchIcons('skip_next')[0]).toBe('skip_next');
    expect(searchIcons('a', 5)).toHaveLength(5);
    expect(searchIcons('zzzzzzzz')).toEqual([]);
  });
});
