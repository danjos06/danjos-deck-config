import type { CONSUMER_MAP } from './constants';

/** 'KEY_RETURN' etc. from KEY_MAP / modifier names, or a single printable ASCII char. '' = modifiers only. */
export type KeyName = string;
/** Name of a consumer (media) usage from CONSUMER_MAP. */
export type ConsumerName = keyof typeof CONSUMER_MAP;

export type MouseAction =
  | { kind: 'left' | 'right' | 'middle' }
  | { kind: 'move'; x: number; y: number } // clamped to -127..127 on encode
  | { kind: 'scroll'; amount: number }; // clamped to -127..127 on encode

export type MacroStep =
  | { id: string; type: 'keyboard'; key: KeyName; modifiers: number; delayMs: number }
  | { id: string; type: 'consumer'; code: ConsumerName; delayMs: number }
  | { id: string; type: 'mouse'; mouse: MouseAction; delayMs: number }
  | { id: string; type: 'delay'; delayMs: number }; // 0..65535

export type Action =
  | { type: 'none' }
  | { type: 'keyboard'; key: KeyName; modifiers: number } // key '' allowed => modifiers only
  | { type: 'consumer'; code: ConsumerName }
  | { type: 'mouse'; mouse: MouseAction }
  | { type: 'macro'; steps: MacroStep[] } // <= 10
  | { type: 'text'; text: string } // compiled into firmware only
  | { type: 'cpp'; code: string } // compiled into firmware only
  | { type: 'folder'; targetPageId: string }
  | { type: 'back' }; // go to parent page (new fw) / page 0 (legacy fw)

export type IconLayout = 'icon-only' | 'icon-text-below' | 'icon-text-side' | 'text-only';
export type DitherMode = 'none' | 'floyd-steinberg' | 'atkinson' | 'bayer';
export type FitMode = 'contain' | 'cover' | 'stretch';

export interface ImageSource {
  /** Original upload (PNG/JPG/SVG/WebP), downscaled to max 512px longest side before storing. */
  dataUrl: string;
  fit: FitMode;
  /** 0.25..4, 1 = fit. */
  zoom: number;
  /** px in OLED space, -128..128. */
  offsetX: number;
  /** px in OLED space, -64..64. */
  offsetY: number;
}

export interface KeyAppearance {
  mode: 'icon' | 'image' | 'blank';
  layout: IconLayout;
  /** `x`/`y` are pixel offsets relative to the layout anchor (legacy iconXOffset/iconYOffset). size 8..56. */
  icon: { name: string; size: number; x: number; y: number; fill: boolean; weight: number };
  /** `x`/`y` are pixel offsets relative to the layout anchor. size 6..28. */
  label: { text: string; size: number; x: number; y: number; bold: boolean };
  image: ImageSource | null;
  border: boolean;
  /** 0..255, default 128 (legacy rule: luminance > threshold => ON). */
  threshold: number;
  invert: boolean;
  dither: DitherMode;
}

export interface KeyConfig {
  id: string;
  /** Human label in the UI (not drawn unless label.text). */
  name: string;
  appearance: KeyAppearance;
  /**
   * base64 of the 1024-byte rendered bitmap (cache). '' = not rendered yet;
   * the deck store's `ensureBitmaps()` renders missing ones.
   */
  bitmap: string;
  action: Action;
}

export interface Page {
  id: string;
  name: string;
  /** Folder pages are skipped by prev/next; reached via 'folder' action. */
  isFolder: boolean;
  parentId: string | null;
  /** Exactly 6, index = row*3 + col. */
  keys: KeyConfig[];
}

/** macro/text/cpp/keyboard/consumer/mouse/none only (no folder/back). */
export interface EncoderConfig {
  cw: Action;
  ccw: Action;
  sw: Action;
}

export type PinId =
  | 'btn0' | 'btn1' | 'btn2' | 'btn3' | 'btn4' | 'btn5'
  | 'prev' | 'next'
  | 'enc1Clk' | 'enc1Dt' | 'enc1Sw' | 'enc2Clk' | 'enc2Dt' | 'enc2Sw'
  | 'sda' | 'scl';

export interface HardwareConfig {
  /** -1 = disabled. */
  pins: Record<PinId, number>;
  /** Default 0x70 (0x70..0x77). */
  muxAddress: number;
  /** Default 0x3C (0x3C | 0x3D). */
  oledAddress: number;
  /** Length 6, channel 0..7 for screen i; default [0,1,2,3,4,5]. */
  muxChannels: number[];
}

export interface NetworkConfig {
  /** ESP32 IP for Wi-Fi sync. */
  deviceIp: string;
  /** Optional, for screen-off-when-PC-offline ping. */
  pcIp: string;
  /** Compiled into firmware only. */
  wifiSsid: string;
  /** Compiled into firmware only. */
  wifiPassword: string;
  /** New fw mDNS name, default 'danjos-deck'. */
  hostname: string;
}

export interface DeckConfig {
  version: 2;
  name: string;
  /** 1..8; pages[0] is root. */
  pages: Page[];
  encoders: [EncoderConfig, EncoderConfig];
  hardware: HardwareConfig;
  network: NetworkConfig;
}

export type EncoderFn = 'cw' | 'ccw' | 'sw';
export type GpioTag = 'strapping' | 'usb' | 'flash' | 'psram' | 'jtag' | 'uart' | 'adc' | 'touch';
