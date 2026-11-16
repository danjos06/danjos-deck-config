# Danjos Deck v2 — Architecture & Module Contracts

Source of truth for hardware/protocol facts: `docs/CONTRACT.md` (legacy audit). This file defines the NEW app.
Every subagent MUST read both files before writing code.

## 0. Non-negotiable compatibility rules

1. Bitmap = 128x64, 1024 bytes, row-major, MSB-first: byte `y*16 + (x>>3)`, bit `7-(x&7)`, `1` = pixel ON.
2. Wire protocol (HTTP `POST /command` text/plain one line, `POST /upload` multipart field `file` named `b_<b>_<p>.bin`, Serial 115200 line protocol) must stay byte-compatible with the legacy firmware (CONTRACT §6). New firmware may ADD features, never break old ones.
3. Slots: `b` 0..5 screen buttons (per page), 6/7/8 = enc1 CW/CCW/SW, 9/10/11 = enc2 CW/CCW/SW (always page 0, global).
4. Action type codes: 0 none, 1 keyboard, 2 consumer, 3 mouse, 4 macro, 5 folder, 6 back. Modifier bitmask 1 LCtrl, 2 LShift, 4 LAlt, 8 LGui, 16 RCtrl, 32 RShift, 64 RAlt, 128 RGui. Mouse key 1 L, 2 R, 3 M, 4 move(v1,v2), 5 scroll(v1). Macro step type 4 = delay.
5. Limits: **max 8 pages** (incl. folder pages), **max 10 macro steps**. Enforced in the store and UI.
6. Pin ids for `P <id> <val>`: 0..5 btn, 6 prev, 7 next, 8 enc1Clk, 9 enc1Dt, 10 enc1Sw, 11 enc2Clk, 12 enc2Dt, 13 enc2Sw, 14 sda, 15 scl. **Extension (new firmware only, ignored by legacy):** 16 muxAddress, 17 oledAddress, 18..23 mux channel of screen 0..5. Pins are sent ONE PER LINE (fixes legacy bug). Disabled = `-1`.
7. Never ship hard-coded Wi-Fi credentials or IPs. Defaults are empty strings.

## 1. Stack

- Vite 6 + React 18 + TypeScript (strict) + Tailwind CSS v3.4 (+ postcss, autoprefixer)
- framer-motion 11, zustand 5 (with `persist` middleware, localStorage key `danjos_deck_v2`)
- lucide-react (UI chrome icons), `material-symbols` npm package (self-hosted Material Symbols Rounded font for the canvas renderer + icon name list; no CDN dependency — the configurator may be used on a LAN without internet)
- prism-react-renderer (C++ syntax highlighting)
- vitest (unit tests for `src/core/**`)
- No backend. `npm run dev`, `npm run build` (= `tsc -b && vite build`), `npm run test`.
- App lives at the workspace root (`package.json` at `danjos-deck-new/`). `projeto antigo/` and `docs/` are excluded from tsconfig/vite.

## 2. Folder layout

```
src/
  core/                       # PURE TS, no React. Unit tested.
    types.ts                  # domain model (section 3)
    constants.ts              # limits, defaults, KEY_MAP, CONSUMER_MAP, key catalog for pickers
    defaults.ts               # createDefaultConfig(), createEmptyKey(), createPage()
    bitmap/
      pack.ts                 # packRGBA(ImageData-like, threshold, invert, dither) -> Uint8Array(1024); unpack; base64 helpers
      dither.ts               # none | floyd-steinberg | atkinson | bayer4
      render.ts               # renderKeyBitmap(appearance): Promise<Uint8Array> (canvas; icon+label+image)
      cpp.ts                  # toCppArray(name, bytes) -> PROGMEM C++ source
      icons.ts                # MATERIAL_ICON_NAMES: string[] + searchIcons(q, limit)
    pinout/
      esp32s3.ts              # GPIO capability table
      validate.ts             # validatePins(pinConfig) -> PinIssue[]
    protocol/
      encode.ts               # buildCommandPlan(config) -> SyncStep[]  (pure; order from CONTRACT §6.3, bugs fixed)
      transport.ts            # interface Transport
      wifi.ts                 # WifiTransport (fetch, timeouts, retries, probe())
      serial.ts               # SerialTransport (Web Serial, line reader, waitFor OK/READY)
      sync.ts                 # runSync(plan, transport, onProgress, signal)
    firmware/
      template.ts             # the improved .ino template
      generate.ts             # generateFirmware(config): string
  store/
    deckStore.ts              # zustand store: config + actions; selection/UI state in uiStore.ts
    uiStore.ts
  components/                 # React UI (section 6)
  App.tsx, main.tsx, index.css
```

## 3. Domain model (`src/core/types.ts`) — exact shape

```ts
export type KeyName = string;            // 'KEY_RETURN' etc. from KEY_MAP, or a single printable ASCII char
export type ConsumerName = keyof typeof CONSUMER_MAP;

export type MouseAction =
  | { kind: 'left' | 'right' | 'middle' }
  | { kind: 'move'; x: number; y: number }      // int16 clamp -127..127
  | { kind: 'scroll'; amount: number };          // -127..127

export type MacroStep =
  | { id: string; type: 'keyboard'; key: KeyName; modifiers: number; delayMs: number }
  | { id: string; type: 'consumer'; code: ConsumerName; delayMs: number }
  | { id: string; type: 'mouse'; mouse: MouseAction; delayMs: number }
  | { id: string; type: 'delay'; delayMs: number };   // 0..65535

export type Action =
  | { type: 'none' }
  | { type: 'keyboard'; key: KeyName; modifiers: number }   // key '' allowed => modifiers only
  | { type: 'consumer'; code: ConsumerName }
  | { type: 'mouse'; mouse: MouseAction }
  | { type: 'macro'; steps: MacroStep[] }                   // <= 10
  | { type: 'text'; text: string }                          // compiled into firmware only
  | { type: 'cpp'; code: string }                           // compiled into firmware only
  | { type: 'folder'; targetPageId: string }
  | { type: 'back' };                                       // go to parent page (new fw) / page 0 (legacy fw)

export type IconLayout = 'icon-only' | 'icon-text-below' | 'icon-text-side' | 'text-only';
export type DitherMode = 'none' | 'floyd-steinberg' | 'atkinson' | 'bayer';
export type FitMode = 'contain' | 'cover' | 'stretch';

export interface ImageSource {
  dataUrl: string;            // original upload (PNG/JPG/SVG/WebP), downscaled to max 512px longest side before storing
  fit: FitMode;
  zoom: number;               // 0.25..4, 1 = fit
  offsetX: number;            // px in OLED space, -128..128
  offsetY: number;            // -64..64
}

export interface KeyAppearance {
  mode: 'icon' | 'image' | 'blank';
  layout: IconLayout;
  icon: { name: string; size: number; x: number; y: number; fill: boolean; weight: number }; // size 8..56
  label: { text: string; size: number; x: number; y: number; bold: boolean };              // size 6..28
  image: ImageSource | null;
  border: boolean;
  threshold: number;          // 0..255, default 128 (legacy rule: luminance > threshold => ON)
  invert: boolean;
  dither: DitherMode;
}

export interface KeyConfig {
  id: string;
  name: string;               // human label in the UI (not drawn unless label.text)
  appearance: KeyAppearance;
  bitmap: string;             // base64 of the 1024-byte rendered bitmap (cache, always in sync with appearance)
  action: Action;
}

export interface Page {
  id: string;
  name: string;
  isFolder: boolean;          // folder pages are skipped by prev/next; reached via 'folder' action
  parentId: string | null;
  keys: KeyConfig[];          // exactly 6, index = row*3 + col
}

export interface EncoderConfig { cw: Action; ccw: Action; sw: Action; }   // macro/text/cpp/keyboard/consumer/mouse/none only (no folder/back)

export type PinId =
  | 'btn0' | 'btn1' | 'btn2' | 'btn3' | 'btn4' | 'btn5'
  | 'prev' | 'next'
  | 'enc1Clk' | 'enc1Dt' | 'enc1Sw' | 'enc2Clk' | 'enc2Dt' | 'enc2Sw'
  | 'sda' | 'scl';

export interface HardwareConfig {
  pins: Record<PinId, number>;     // -1 = disabled
  muxAddress: number;              // default 0x70 (0x70..0x77)
  oledAddress: number;             // default 0x3C (0x3C | 0x3D)
  muxChannels: number[];           // length 6, channel 0..7 for screen i; default [0,1,2,3,4,5]
}

export interface NetworkConfig {
  deviceIp: string;                // ESP32 IP for Wi-Fi sync
  pcIp: string;                    // optional, for screen-off-when-PC-offline ping
  wifiSsid: string;                // compiled into firmware only
  wifiPassword: string;            // compiled into firmware only
  hostname: string;                // new fw mDNS name, default 'danjos-deck'
}

export interface DeckConfig {
  version: 2;
  name: string;
  pages: Page[];                   // 1..8; pages[0] is root
  encoders: [EncoderConfig, EncoderConfig];
  hardware: HardwareConfig;
  network: NetworkConfig;
}
```

Defaults: pins `btn0..5 = 1..6, prev 7, next 15, enc1 16/17/18, enc2 -1/-1/-1 (disabled, GPIO19/20 are USB D-/D+), sda 8, scl 9`.

## 4. Core contracts (function signatures that UI depends on)

```ts
// bitmap/pack.ts
export const OLED_W = 128, OLED_H = 64, BITMAP_BYTES = 1024;
export function packPixels(rgba: Uint8ClampedArray, opts: { threshold: number; invert: boolean; dither: DitherMode }): Uint8Array;
export function getPixel(bmp: Uint8Array, x: number, y: number): boolean;
export function bitmapToBase64(b: Uint8Array): string;
export function base64ToBitmap(s: string): Uint8Array;   // returns zeroed 1024 on invalid input
export function emptyBitmap(): Uint8Array;
// bitmap/render.ts  (browser-only: uses OffscreenCanvas or HTMLCanvasElement fallback; awaits document.fonts.load)
export function renderKeyBitmap(a: KeyAppearance): Promise<Uint8Array>;
export function renderPreviewRGBA(a: KeyAppearance): Promise<ImageData>; // pre-threshold grayscale for "source" preview
export async function loadImageFile(file: File): Promise<string>;      // -> downscaled dataUrl (SVG rasterised at 512px)
// bitmap/cpp.ts
export function toCppArray(symbol: string, b: Uint8Array): string;     // "const uint8_t sym[1024] PROGMEM = { 0x00, ... };" 16 bytes/line
// bitmap/icons.ts
export const MATERIAL_ICON_NAMES: readonly string[];
export function searchIcons(query: string, limit?: number): string[];
// pinout/validate.ts
export type PinSeverity = 'error' | 'warning' | 'info';
export interface PinIssue { pin: PinId | 'muxAddress' | 'oledAddress' | `muxChannel${number}`; severity: PinSeverity; message: string; gpio?: number; }
export function validateHardware(h: HardwareConfig): PinIssue[];
export function describeGpio(gpio: number): { exists: boolean; tags: GpioTag[]; note?: string };
// protocol/encode.ts
export type SyncStep =
  | { kind: 'command'; line: string; label: string }
  | { kind: 'bitmap'; button: number; page: number; data: Uint8Array; label: string };
export function buildCommandPlan(cfg: DeckConfig): SyncStep[];
export function encodeAction(a: Action, ctx: { pages: Page[]; currentPageIndex: number }): { act: [number, number, number, number, number]; seq: number[][] }; // [type,mod,key,v1,v2], seq rows [type,mod,key,v1,v2,delay]
export function keyNameToCode(k: KeyName): number;
// protocol/transport.ts
export interface Transport {
  readonly kind: 'wifi' | 'serial';
  sendCommand(line: string, signal?: AbortSignal): Promise<void>;
  sendBitmap(button: number, page: number, data: Uint8Array, signal?: AbortSignal): Promise<void>;
  close?(): Promise<void>;
}
// protocol/wifi.ts
export interface ProbeResult { ok: boolean; latencyMs: number; firmware: 'legacy' | 'v2' | 'unknown'; info?: Record<string, unknown>; error?: string; }
export function probeDevice(ip: string, timeoutMs?: number): Promise<ProbeResult>;  // GET /info (v2) then fallback GET / containing 'Danjos Deck'
export class WifiTransport implements Transport { constructor(ip: string, opts?: { timeoutMs?: number; retries?: number }); }
export function normalizeIp(input: string): string | null;   // accepts '192.168.0.10', 'http://...', 'host.local'
// protocol/serial.ts
export function isSerialSupported(): boolean;
export class SerialTransport implements Transport { static request(baud?: number): Promise<SerialTransport>; onLog?: (dir: 'tx'|'rx', line: string) => void; }
// protocol/sync.ts
export interface SyncProgress { index: number; total: number; label: string; phase: 'clear' | 'pins' | 'actions' | 'bitmaps' | 'save' | 'done'; }
export function runSync(cfg: DeckConfig, t: Transport, onProgress: (p: SyncProgress) => void, signal?: AbortSignal): Promise<void>;
// On any failure after CLEAR, runSync makes a best-effort `SAVE` so the device leaves the syncing state, then rethrows.
// firmware/generate.ts
export function generateFirmware(cfg: DeckConfig): string;
export const FIRMWARE_FILENAME = 'danjos_deck_firmware.ino';
```

### Sync plan order (fixes legacy bugs)
`CLEAR` → `PAGES n` → `FOLDER p 1` per folder → `P id val` ×16 (+ extension ids 16..23) one per line → `PCIP ip` **only if non-empty** → for each page p, key b: `SEQ…` rows then `ACT b p …`, then bitmap → encoder slots 6..11 on page 0 → `SAVE`.
Back action encodes `key = index of parent page` (legacy ignores, v2 honours). text/cpp encode as type 0 (compiled into firmware). Modifier-only keys (e.g. user picked "Right Ctrl" as the key) are converted into the modifier bitmask with key 0.

## 5. Firmware generator requirements (`src/core/firmware`)

Generate ONE complete, compilable Arduino-ESP32 (core 3.x, ESP32-S3, USB-OTG/TinyUSB mode) `.ino` derived from the legacy template (CONTRACT §§1-7), keeping every legacy command/route/file format, plus:
- Baked pins/addresses/mux channel map; `P` ids 16..23 supported at runtime.
- Non-blocking input: per-button `millis()` debounce (25 ms) instead of `delay(200)`; quadrature encoder decoded with a state table in the loop (no missed detents, no blocking delay).
- Wi-Fi: credentials from config (C-string escaped), non-blocking reconnect, optional `ESPmDNS` hostname, `ArduinoOTA`. If SSID empty, Wi-Fi code compiled but skipped at runtime.
- HTTP: legacy `/`, `/command`, `/upload` unchanged (+ reply 400 on empty body instead of hanging; reject upload filenames not matching `b_<0-5>_<0-7>.bin` or `config.json`); NEW `GET /info` → JSON `{"name":"Danjos Deck","fw":"2.0.0","pages":N,"page":cur,"ip":"..."}`.
- Bitmaps: compiled PROGMEM defaults for every page/key (`toCppArray`), used when `/b_b_p.bin` is absent or not 1024 bytes. Compiled default action table + macros used when `/config.txt` is absent (i.e. a freshly flashed board works without any sync).
- `back` → parent page (key field) with fallback to 0; nav skips folder pages.
- text actions → `Keyboard.print` with full C escaping (\\, ", \n, \t, non-ASCII stripped); cpp verbatim. Keyed by (b,p) at flash time — documented in a header comment.
- Forward declarations for all functions (PlatformIO-safe).
- Header comment: generation date, board settings (USB Mode: USB-OTG (TinyUSB), USB CDC On Boot: Enabled, Partition: default with LittleFS/SPIFFS), required libraries.

## 6. UI/UX (`src/components`)

Visual: dark studio aesthetic (Elgato / VIA / Teenage Engineering). Near-black graphite background (#0b0c0e), elevated panels (#131418 / #1a1c21), hairline borders (white/6%), one accent (signal orange #ff6a1a) + OLED cyan-white for screens (#e8f6ff on #000). Mono font for technical values (JetBrains Mono via @fontsource), Inter for UI. Subtle noise/gradient, no gaudy glows. Framer Motion everywhere, `prefers-reduced-motion` respected.

Layout (CSS grid, no horizontal scroll from 768px to 3440px ultrawide; max content width 1800px centered, panels resize fluidly):
- **Top bar**: logo, deck name, connection status pill (IP + animated dot), Sync button (progress ring), Export button.
- **Left rail**: Pages/Layers list (reorder, add/duplicate/rename/delete, folder badge, max 8 counter).
- **Center stage**: the interactive physical deck: a hardware-looking enclosure with enc1 (left) — 3×2 OLED keys — enc2 (right), prev/next nav buttons below. OLED keys render the real 1024-byte bitmap pixel-perfect (canvas, `image-rendering: pixelated`, slight OLED glow). Click = press animation (scale .96 + glow) + select. Encoders rotate visually on wheel/drag, click selects CW/CCW/SW. Page transitions slide/fade in direction of navigation (AnimatePresence, keyed by page id).
- **Right inspector** (drawer on < 1280px): tabs Appearance | Action for the selected key/encoder function.
  - Appearance: mode (Icon / Image / Blank), icon picker (virtualized search grid over MATERIAL_ICON_NAMES, renders font glyphs), label, layout, size/offset sliders, border, threshold, invert, dither, image upload (drag & drop, PNG/JPG/SVG/WebP), fit/zoom/offset, side-by-side "source" vs "OLED 1-bit" preview at 4× with pixel grid toggle, "Copy C array" button.
  - Action: type segmented control; keyboard key capture ("press a key" recorder + searchable list) + modifier toggles; media list; mouse; macro builder (reorderable steps, max 10, Reorder from framer-motion); text; C++ (code area); folder target / back.
- **Modals/sheets** (animated): Hardware/Pinout (ESP32-S3 pin map visual + table, inline validation badges, strapping/USB/flash warnings, MUX address + channel per screen), Export (.ino with syntax highlight, copy, download; also JSON config import/export backup), Sync (IP input, Test connection with latency + firmware type, transport toggle Wi-Fi / USB Serial, step-by-step animated progress, log, cancel, HTTPS mixed-content warning).
- Toasts for success/errors. Keyboard shortcuts: ←/→ change page, Del clears key, Ctrl+S sync, Ctrl+E export.
- Language: Portuguese (pt-BR) UI strings.
