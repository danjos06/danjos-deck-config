import type { PinId } from '@/core/types';

/**
 * ESP32-S3-DevKitC-1 (clone, WROOM-1 module, black PCB) header map, antenna at the top, read top to
 * bottom. Verified against the silkscreen in assets-src/esp32s3-devkitc1.png.
 */
export type HeaderPin =
  | { kind: 'gpio'; gpio: number; silk: string }
  | { kind: 'power'; silk: string }
  | { kind: 'gnd'; silk: string }
  | { kind: 'rst'; silk: string };

const g = (gpio: number, silk = String(gpio)): HeaderPin => ({ kind: 'gpio', gpio, silk });
const P3V3: HeaderPin = { kind: 'power', silk: '3V3' };
const P5V: HeaderPin = { kind: 'power', silk: '5V' };
const GND: HeaderPin = { kind: 'gnd', silk: 'GND' };

/** J1, left header. */
export const J1: readonly HeaderPin[] = [
  P3V3, P3V3, { kind: 'rst', silk: 'RST' },
  g(4), g(5), g(6), g(7), g(15), g(16), g(17), g(18), g(8), g(3), g(46), g(9), g(10), g(11), g(12), g(13), g(14),
  P5V, GND,
];

/** J3, right header. */
export const J3: readonly HeaderPin[] = [
  GND, g(43, 'TX'), g(44, 'RX'),
  g(1), g(2), g(42), g(41), g(40), g(39), g(38), g(37), g(36), g(35), g(0), g(45), g(48), g(47), g(21), g(20), g(19),
  GND, GND,
];

/** Short callout labels for the pin functions. */
export const SHORT_LABELS: Readonly<Record<PinId, string>> = {
  btn0: 'BTN 1', btn1: 'BTN 2', btn2: 'BTN 3', btn3: 'BTN 4', btn4: 'BTN 5', btn5: 'BTN 6',
  prev: 'PREV', next: 'NEXT',
  enc1Clk: 'ENC1 CLK', enc1Dt: 'ENC1 DT', enc1Sw: 'ENC1 SW',
  enc2Clk: 'ENC2 CLK', enc2Dt: 'ENC2 DT', enc2Sw: 'ENC2 SW',
  sda: 'SDA', scl: 'SCL',
};

/** Board drawing geometry (SVG units ~ 0.1 mm). */
export const BOARD = {
  w: 260,
  top: 40,
  pitch: 25.4,
  firstPinY: 118,
  leftX: 18,
  rightX: 242,
  padR: 8.5,
  get bottom() {
    return this.firstPinY + 21 * this.pitch + 58;
  },
} as const;

/** Callout margin on each side and the full viewBox. */
export const VIEW = { margin: 150, x: -150, y: 0, w: 260 + 300, h: 760 } as const;

export const pinY = (i: number) => BOARD.firstPinY + i * BOARD.pitch;
