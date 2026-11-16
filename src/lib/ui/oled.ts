import { OLED_H, OLED_W, base64ToBitmap, bitmapToRGBA } from '@/core/bitmap/pack';

export const OLED_ON: readonly [number, number, number] = [226, 244, 255];

/** Decodes a base64 bitmap into an ImageData (128x64) ready for putImageData. */
export function bitmapB64ToImageData(b64: string): ImageData {
  const img = new ImageData(OLED_W, OLED_H);
  img.data.set(bitmapToRGBA(base64ToBitmap(b64), OLED_ON));
  return img;
}
