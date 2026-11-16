# Danjos Deck - Legacy Technical Contract

Source of truth extracted from `projeto antigo/` (Next.js 16 configurator + `danjos_deck_firmware (4).ino`).
Goal: a full rewrite must remain 100% hardware/protocol compatible with the firmware described here.

Conventions: "ino" = `danjos_deck_firmware (4).ino` (the committed firmware, 511 lines). "template" = `lib/firmwareTemplate.ts` output. The template is NEWER than the ino (see section 7). Line numbers refer to the original files.

---

## 1. Firmware libraries

Target: ESP32-S3 (native USB HID). Arduino-ESP32 core (the `USB.h`, `USBHID*.h`, `ping/ping_sock.h` headers are Arduino-ESP32 core 2.x/3.x built-ins). No library versions are mentioned anywhere in the repo (no platformio.ini, no library.properties). README only says "Arduino IDE or PlatformIO".

| Include | Purpose |
|---|---|
| `<Arduino.h>` | core |
| `"USB.h"` | ESP32-S3 native USB stack (`USB.begin()`) |
| `"USBHIDKeyboard.h"` | USB HID keyboard (`USBHIDKeyboard Keyboard;`) |
| `"USBHIDConsumerControl.h"` | USB HID consumer/media keys (`USBHIDConsumerControl Consumer;`) |
| `"USBHIDMouse.h"` | USB HID mouse (`USBHIDMouse Mouse;`) |
| `<Wire.h>` | I2C bus (OLEDs + mux) |
| `<Adafruit_GFX.h>` | graphics base class (`drawBitmap`, text) |
| `<Adafruit_SSD1306.h>` | OLED driver (SSD1306) |
| `<LittleFS.h>` | persistence (config.txt, pins.txt, b_*.bin) |
| `<WiFi.h>` | Wi-Fi STA |
| `<WebServer.h>` | synchronous HTTP server on port 80 (`WebServer server(80);`) |
| `<ArduinoOTA.h>` | OTA updates (default hostname, no password, no `setHostname`) |
| `"ping/ping_sock.h"` | ESP-IDF ping (`esp_ping_new_session` etc.) used to ping the PC |

NOT used anywhere: BLE HID, WebSocket, mDNS (`ESPmDNS`), ArduinoJson, Preferences, SPIFFS, any encoder library (encoders are bit-banged), any TCA9548A library (raw Wire writes), PROGMEM.

Global objects:
```cpp
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
USBHIDKeyboard Keyboard;
USBHIDConsumerControl Consumer;
USBHIDMouse Mouse;
WebServer server(80);
```
Startup order in `setup()`: `Serial.begin(115200)` -> `LittleFS.begin(true)` (format on fail; prints `FS Error` on failure) -> `loadPins()` -> `Wire.begin(PIN_SDA, PIN_SCL)` -> pinMode INPUT_PULLUP -> init 6 displays -> `Keyboard.begin(); Consumer.begin(); Mouse.begin(); USB.begin();` -> Wi-Fi/HTTP/OTA (only if SSID non-empty) -> `loadConfig(); updateDisplays();`.

Note: `Serial` is used for the sync protocol. On ESP32-S3 this requires "USB CDC On Boot: Enabled" (or HWCDC) in the Arduino tools menu; the repo documents nothing about board settings. Wire clock is never set (default 100 kHz).

---

## 2. Hardware

- **OLED**: SSD1306, **128 x 64** px, monochrome, I2C address **0x3C** (`display.begin(SSD1306_SWITCHCAPVCC, 0x3C)`), `OLED_RESET -1`. README: "0.96" I2C SSD1306".
- **6 OLEDs**, all at the same address 0x3C, behind one **TCA9548A** I2C multiplexer at address **0x70** (`#define TCAADDR 0x70`, A0-A2 grounded). The mux RESET pin is not driven by firmware.
- A single `Adafruit_SSD1306 display` object is shared: select the mux channel, then draw/flush.
- Mux channel select (verbatim, identical in ino and template):
```cpp
void tcaselect(uint8_t i) {
  if (i > 7) return;
  Wire.beginTransmission(TCAADDR);
  Wire.write(1 << i);
  Wire.endTransmission();
}
```
- **Channel -> screen mapping**: channel `i` (0..5) == button index `i` (0..5) == file `/b_<i>_<page>.bin`. Channels 6/7 unused. Display `i` shows the bitmap for physical button `i`.
- Display init loop (setup):
```cpp
  for (int i=0; i<6; i++) {
    tcaselect(i);
    if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
      display.clearDisplay();
      display.display();
    }
  }
```
- Display update loop (verbatim, identical in ino/template):
```cpp
void updateDisplays() {
  if (isSyncing) return;
  for (int i = 0; i < 6; i++) {
    tcaselect(i);
    display.clearDisplay();
    String filename = "/b_" + String(i) + "_" + String(currentPage) + ".bin";
    File f = LittleFS.open(filename, "r");
    if (f) {
      uint8_t buf[1024];
      f.read(buf, 1024);
      display.drawBitmap(0, 0, buf, 128, 64, SSD1306_WHITE);
      f.close();
    } else {
      display.setTextSize(1);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(10, 28);
      display.print("No Image");
    }
    display.display();
  }
}
```
  (Does not check that `f.read` returned 1024; a short file leaves stale/uninitialised bytes in `buf`.) It is redrawn only on page change, SAVE, and screens-on; there is no periodic refresh.
- Screens on/off (PC ping power saving): `display.ssd1306_command(SSD1306_DISPLAYON / SSD1306_DISPLAYOFF)` per channel 0..5 in `setDisplaysOn(bool)`.
- Boot-time IP splash (only when Wi-Fi connected): on all 6 screens prints `WiFi Connected` at (0,10), `IP:` at (0,30), the IP at (0,45) (text size 1), then `delay(5000)`.
- **Physical layout of the 6 screens**: not defined in firmware. The web editor renders buttons in a **3-column x 2-row grid** (`grid grid-cols-3 gap-4`), row-major: index 0,1,2 top row; 3,4,5 bottom row. Encoder 1 ("Encoder L"/"E") is drawn on the LEFT of the grid, Encoder 2 ("Encoder R"/"D") on the RIGHT. A rewrite should keep `index = row*3 + col`.
- 6 main buttons + 2 navigation buttons (prev/next page) + 2 rotary encoders (CLK, DT, SW each; KY-040 per README). Max 6 OLEDs (README mentions mux could drive 8).

---

## 3. Default pinout

ino (committed firmware, "Hardcoded Defaults"):
```cpp
int PIN_BTN[6] = { 1, 2, 3, 4, 5, 6 };
int PIN_PREV = 7;
int PIN_NEXT = 15;
int PIN_ENC1_CLK = 16;
int PIN_ENC1_DT = 17;
int PIN_ENC1_BTN = 18;
int PIN_ENC2_CLK = -1;
int PIN_ENC2_DT = -1;
int PIN_ENC2_BTN = -1;
int PIN_SDA = 8;
int PIN_SCL = 9;
```
`-1` = disabled. No status LED exists anywhere.

Default pins in the web app (`StreamDeckConfigurator.tsx` DEFAULT_PINS; also template fallbacks `??`):
```ts
const DEFAULT_PINS = {
  btn1: 1, btn2: 2, btn3: 3, btn4: 4, btn5: 5, btn6: 6,
  btnPrev: 7, btnNext: 15,
  enc1Clk: 16, enc1Dt: 17, enc1Btn: 18,
  enc2Clk: 20, enc2Dt: 21, enc2Btn: 41,
  sda: 8, scl: 9
};
```
Other inconsistent default sets: `PinsSettings.tsx` fallback and `syncProtocol.ts parseExportedConfig` use `enc2Clk: 21, enc2Dt: 22, enc2Btn: 23`. Canonical (template + DEFAULT_PINS): enc2 = 20/21/41. **GPIO19/20 are the ESP32-S3 USB D-/D+ pins; the default enc2Clk=20 conflicts with native USB**, which is why the committed ino disables encoder 2 (-1).

Pin ID table for the runtime `P <id> <val>` command and `/pins.txt` (firmware `loadPins`):

| id | variable | id | variable |
|---|---|---|---|
| 0..5 | `PIN_BTN[0..5]` | 10 | `PIN_ENC1_BTN` |
| 6 | `PIN_PREV` | 11 | `PIN_ENC2_CLK` |
| 7 | `PIN_NEXT` | 12 | `PIN_ENC2_DT` |
| 8 | `PIN_ENC1_CLK` | 13 | `PIN_ENC2_BTN` |
| 9 | `PIN_ENC1_DT` | 14 | `PIN_SDA` |
| | | 15 | `PIN_SCL` |

```cpp
void loadPins() {
  File f = LittleFS.open("/pins.txt", "r");
  if (!f) return;
  while(f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.startsWith("P ")) {
      int id = line.substring(2, line.indexOf(' ', 2)).toInt();
      int val = line.substring(line.lastIndexOf(' ') + 1).toInt();
      switch(id) { case 0: PIN_BTN[0]=val; break; ... case 15: PIN_SCL=val; break; }
    }
  }
  f.close();
}
```
`loadPins()` runs ONLY in `setup()` (SAVE does not reload pins; a reboot is required). Pins stored in `/pins.txt` override the compile-time defaults. The template bakes pin values (with `*Enabled === false -> -1`) at generation time; the enabled flags are NOT sent by runtime sync.

pinMode / pull-ups: every pin != -1 gets `INPUT_PULLUP` (buttons, nav, encoder CLK/DT/SW). All inputs are active LOW (pressed = LOW). External pull-ups not needed.

Input logic (verbatim, `loop()`):
```cpp
  for (int i = 0; i < 6; i++) {
    if (PIN_BTN[i] != -1) {
      bool state = digitalRead(PIN_BTN[i]);
      if (state == LOW && lastBtnState[i] == HIGH) { executeAction(i, currentPage); delay(200); }
      lastBtnState[i] = state;
    }
  }
```
- **Debounce**: falling-edge detection + blocking `delay(200)` after any button press (buttons, prev, next, encoder switches). No timers, no release action, no long-press, no key repeat. During `delay(200)` and during macro delays the whole loop (HTTP, serial, other buttons) is blocked.
- Page nav (ino): `currentPage = (currentPage - 1 + totalPages) % totalPages` / `(currentPage + 1) % totalPages`, then `updateDisplays()`. Template: same but skips folder pages (see section 5).
- **Encoder reading** (polling, rising edge of CLK, DT sampled at that moment):
```cpp
  if (PIN_ENC1_CLK != -1 && PIN_ENC1_DT != -1) {
    int clk1 = digitalRead(PIN_ENC1_CLK);
    if (clk1 != lastClk1 && clk1 == 1) {
      if (digitalRead(PIN_ENC1_DT) != clk1) executeAction(6, 0);
      else executeAction(7, 0);
      delay(50);
    }
    lastClk1 = clk1;
  }
  if (PIN_ENC1_BTN != -1) {
    bool btn1 = digitalRead(PIN_ENC1_BTN);
    if (btn1 == LOW && lastBtnState1 == HIGH) { executeAction(8, 0); delay(200); }
    lastBtnState1 = btn1;
  }
```
  On CLK rising edge: DT != CLK (DT low) -> slot 6 (CW); DT == CLK (DT high) -> slot 7 (CCW). Encoder 2 identical with slots 9 (CW), 10 (CCW), 11 (SW). 50 ms blocking delay per detent. Detents are polled in the main loop (fast rotation can be missed when anything else blocks, e.g. ping).
- PC-ping screen power: every `PING_INTERVAL = 60000` ms (and at first loop) `pingIP(pc_ip)` (1 ICMP echo, 1500 ms blocking wait) -> `setDisplaysOn(success)`. While `screensOn == false`, `executeAction()` returns immediately (buttons/encoders do nothing; page nav buttons still change `currentPage` but displays are off). If Wi-Fi not connected or `pc_ip == ""`, `setDisplaysOn(true)` each loop.

---

## 4. Bitmap format

- Size: **128 x 64 px, 1 bit per pixel, 1024 bytes** (`16 bytes/row * 64 rows`).
- Layout: **horizontal, row-major, MSB-first** == Adafruit_GFX `drawBitmap` format. Byte index `y*16 + (x>>3)`, bit `7 - (x & 7)`; bit `1` = pixel ON (white/lit), `0` = off.
- Not PROGMEM. Bitmaps are NOT compiled into the .ino. Each is a raw 1024-byte file in LittleFS: `/b_<button>_<page>.bin` (button 0..5, page 0..N), loaded into a stack `uint8_t buf[1024]` and drawn with `display.drawBitmap(0, 0, buf, 128, 64, SSD1306_WHITE)`.
- Web side: `bitmap: number[]` of length exactly 1024 (empty array = none). Sent only if `btn.bitmap.length === 1024`.
- Conversion code (all three generators share the same packing; verbatim from `imageConverter.ts`):

`imageToBitmap(file)` (user-uploaded image; threshold, NO dithering, NO inversion, "contain" scaling centered on black):
```ts
const canvas = new OffscreenCanvas(128, 64);
ctx.fillStyle = 'black';
ctx.fillRect(0, 0, 128, 64);
const scale = Math.min(128 / img.width, 64 / img.height);
const w = img.width * scale;
const h = img.height * scale;
const x = (128 - w) / 2;
const y = (64 - h) / 2;
ctx.drawImage(img, x, y, w, h);
const imageData = ctx.getImageData(0, 0, 128, 64);
...
const bitmap = new Array(1024).fill(0);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const r = data[idx]; const g = data[idx + 1]; const b = data[idx + 2];
    // Grayscale conversion
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    if (brightness > 128) {
      const byteIdx = y * 16 + (x >> 3);
      const bitIdx = 7 - (x & 7);
      bitmap[byteIdx] |= (1 << bitIdx);
    }
  }
}
```
(Alpha is ignored: transparent PNG pixels have their stored RGB, composited over the black fill by drawImage, so they become black.)

`generateDefaultBitmap()`: black 128x64, white rounded-rect border stroked `lineWidth = 4`, `x=2,y=2,w=124,h=60,r=8` via `quadraticCurveTo`; packing uses only `r > 128` of the red channel.

`generateIconBitmap({iconName, iconSize=24, iconXOffset=0, iconYOffset=0, label='', textSize=12, textXOffset=0, textYOffset=0, layout='icon-only', showBorder=true})` (the main renderer, called on every appearance change):
- awaits `document.fonts.load(\`${iconSize}px "Material Symbols Rounded"\`)`; OffscreenCanvas 128x64; black fill.
- border (if `showBorder`): white stroke `lineWidth = 2`, rounded rect `x=2,y=2,w=124,h=60,r=6`.
- `ctx.fillStyle='white'; textAlign='center'; textBaseline='middle'`.
- Positions (center anchors):
  - `icon-only`: icon (64+iconXOffset, 32+iconYOffset)
  - `icon-text-side`: icon (36+iconXOffset, 32+iconYOffset); text (68+textXOffset, 32+textYOffset), text `textAlign = 'left'`
  - `icon-text-below`: icon (64+iconXOffset, 22+iconYOffset); text (64+textXOffset, 48+textYOffset)
- Icon: `ctx.font = \`${iconSize}px "Material Symbols Rounded"\``; `ctx.fillText(iconName, iconX, iconY)` (iconName is a Material Symbols ligature name e.g. `play_arrow`).
- Text: `ctx.font = \`bold ${textSize}px sans-serif\``; `ctx.fillText(label, textX, textY)`.
- Pack: `brightness = 0.299*r + 0.587*g + 0.114*b; if (brightness > 128) set bit` (same packing as above).
- Slider ranges in UI: iconSize 8..48 (default 24), textSize 6..24 (default 12), icon X offset -40..40, icon Y -20..20, text X -40..40, text Y -20..20.

`BitmapCanvas.tsx` decodes with the same indexing: `byteIdx = y*16 + (x>>3); bit = (bitmap[byteIdx] >> (7-(x&7))) & 1` -> white/black.

Serial upload: raw 1024 bytes after `READY` (see section 6). HTTP upload: multipart file named `b_<b>_<p>.bin`.

---

## 5. Actions model

### 5.1 Firmware data structures (verbatim)
```cpp
struct Action {
  uint8_t type; // 0=none, 1=kb, 2=cons, 3=mouse, 4=seq, 5=cpp
  uint8_t mod;
  uint16_t key;
  int16_t val1; // for mouse x/scroll
  int16_t val2; // for mouse y
};

struct Step {
  uint8_t type;
  uint8_t mod;
  uint16_t key;
  int16_t val1;
  int16_t val2;
  uint16_t delayMs;
};

Action actions[12][8]; // 6 buttons + 2 encoders(3 each) = 12 total, max 8 pages
Step macros[12][8][10]; // Max 10 steps per macro
uint8_t macroLen[12][8];
bool isFolderPage[16] = {false};   // template only
```
(The struct comment "5=cpp" is stale: in the template **5 = folder, 6 = back**; cpp/text are compiled in, never sent.)

**Slot index (`b`)**: 0..5 = the six screen buttons (per page `p`); 6 = enc1 CW, 7 = enc1 CCW, 8 = enc1 SW, 9 = enc2 CW, 10 = enc2 CCW, 11 = enc2 SW. Encoder slots always use page 0 (`executeAction(6, 0)` etc.): encoder actions are global, not per page.

**Limits**: `b < 12`, `p < 8` (max **8 pages** of actions), `s < 10` (max **10 steps** per macro). `isFolderPage` sized 16 and the web editor allows up to 16 pages (see bugs). Nothing limits bitmap file pages.

### 5.2 Action type codes (wire encoding in `ACT`)
| type | meaning | `mod` | `key` | `val1` | `val2` |
|---|---|---|---|---|---|
| 0 | none (also used for web `text` and `cpp`, which are compiled into the firmware instead) | 0 | 0 | 0 | 0 |
| 1 | keyboard | modifier bitmask | key code | 0 | 0 |
| 2 | consumer (media) | 0 | usage code (16-bit) | 0 | 0 |
| 3 | mouse | 0 | 1=left click, 2=right click, 3=middle click, 4=move, 5=scroll | move: x / scroll: amount | move: y |
| 4 | sequence/macro (steps sent with `SEQ`) | 0 | 0 | 0 | 0 |
| 5 | folder (template only): open page index | 0 | target page index | 0 | 0 |
| 6 | back (template only): go to page 0 | 0 | (sent: parent page idx, **ignored** by firmware) | 0 | 0 |

Modifier bitmask (`mod`), web `syncProtocol.ts` and firmware agree:
`1=leftCtrl, 2=leftShift, 4=leftAlt, 8=leftGui, 16=rightCtrl, 32=rightShift, 64=rightAlt, 128=rightGui` (firmware supports 128; web never sets it - `KeyModifiers` has no `rightGui`).

Step type codes in `SEQ` (same as above except): 1 kb, 2 consumer, 3 mouse, **4 = delay step** (firmware: `delay(s.delayMs)`), 0 = nothing (e.g. unsupported step type). Folder/back are not valid steps.

### 5.3 Execution (ino/template `runStep`, `executeAction`)
```cpp
void runStep(uint8_t t, uint8_t m, uint16_t k, int16_t v1, int16_t v2) {
  if (t == 1) { // KB
    if (m & 1) Keyboard.press(KEY_LEFT_CTRL);
    if (m & 2) Keyboard.press(KEY_LEFT_SHIFT);
    if (m & 4) Keyboard.press(KEY_LEFT_ALT);
    if (m & 8) Keyboard.press(KEY_LEFT_GUI);
    if (m & 16) Keyboard.press(KEY_RIGHT_CTRL);
    if (m & 32) Keyboard.press(KEY_RIGHT_SHIFT);
    if (m & 64) Keyboard.press(KEY_RIGHT_ALT);
    if (m & 128) Keyboard.press(KEY_RIGHT_GUI);
    if (k > 0) Keyboard.press(k);
    delay(10);
    Keyboard.releaseAll();
  } else if (t == 2) { // CONS
    Consumer.press(k);
    Consumer.release();
  } else if (t == 3) { // MOUSE
    if (k == 1) Mouse.click(MOUSE_LEFT);
    else if (k == 2) Mouse.click(MOUSE_RIGHT);
    else if (k == 3) Mouse.click(MOUSE_MIDDLE);
    else if (k == 4) Mouse.move(v1, v2, 0);
    else if (k == 5) Mouse.move(0, 0, v1);
  }
}
```
Template `executeAction` (ino version lacks the type 5/6 block):
```cpp
void executeAction(int b, int p) {
  if (!screensOn) return;
  // Hardcoded C++ Actions
  ${generateEmbeddedActions()}

  Action a = actions[b][p];
  if (a.type == 5) { // Folder navigation
    if (a.key < totalPages) {
      currentPage = a.key;
    } else {
      currentPage = 0;
    }
    updateDisplays();
    return;
  } else if (a.type == 6) { // Back action (return to root page 0)
    currentPage = 0;
    updateDisplays();
    return;
  }

  if (a.type == 4) { // Macro
    for (int i = 0; i < macroLen[b][p]; i++) {
      Step s = macros[b][p][i];
      if (s.type == 4) delay(s.delayMs); // Delay step
      else runStep(s.type, s.mod, s.key, s.val1, s.val2);
      if (s.delayMs > 0 && s.type != 4) delay(s.delayMs);
    }
  } else {
    runStep(a.type, a.mod, a.key, a.val1, a.val2);
  }
}
```
Semantics: keyboard = press all modifiers + key, wait 10 ms, release all (tap; no hold). Consumer = press+release. Macro step `delayMs` is applied AFTER every non-delay step as well. `executeAction` runs while blocking; macros run synchronously. Key code `0` presses only modifiers.

### 5.4 Compiled-in actions (template only: `text` and `cpp`)
`generateEmbeddedActions()` emits, for every button of every page and each encoder slot (6..11 at p == 0):
```cpp
if (b == <bIdx> && p == <pIdx>) {
<cpp code verbatim>
return;
}
```
or for text:
```cpp
if (b == <bIdx> && p == <pIdx>) {
Keyboard.print("<text with " escaped as \">");
return;
}
```
These are inserted at the top of `executeAction`, before the table lookup. They are keyed by (button, page index) positions at flash time -> reordering/deleting pages in the web app desynchronizes them until re-flash. `ACT` for such buttons is still sent as type 0 (the web `sendAction` has no branch for text/cpp). Only `"` is escaped for text (backslashes/newlines would break the C++). Cpp code is trusted raw C++.

### 5.5 Web action types (`types.ts`) -> wire
`'keyboard' | 'text' | 'consumer' | 'mouse' | 'cpp' | 'sequence' | 'folder' | 'back' | 'none'`. Mapping in `syncProtocol.ts sendAction` (identical code duplicated in WiFi and USB paths):
- keyboard -> type 1, `mod` from modifiers, `key = getKeyCode(keyboard.key)`.
- consumer -> type 2, `key = getKeyCode(consumer)` (CONSUMER_MAP).
- mouse: click -> type 3, key 1/2/3 (`left?1: right?2 : 3`); move -> key 4, v1=x||0, v2=y||0; scroll -> key 5, v1=amount||0.
- folder -> type 5, `key = index of page with id == folder.targetPageId`, else `folder.targetPageIndex ?? 0`.
- back -> type 6; `key` = 0 if targetPageId == 'root'; index of targetPageId if set and not 'back'/'parent'; else index of current page's `parentId`, else 0. (Firmware ignores it and always goes to page 0.)
- sequence -> type 4: for each step emit `SEQ b p i st sm sk sv1 sv2 sd` (sd = `step.delayMs || 0`), THEN `ACT b p 4 0 0 0 0`.
- text, cpp, none -> `ACT b p 0 0 0 0 0`.
- Sequence step types supported on wire: keyboard(1), consumer(2), mouse(3), delay(4). `SequenceStep.type === 'text'` exists in types but has no wire encoding (sent as st=0) and no UI.

### 5.6 keyMap.ts (verbatim)
```ts
export const KEY_MAP: Record<string, number> = {
  'KEY_RETURN': 0xB0, 'KEY_ESC': 0xB1, 'KEY_BACKSPACE': 0xB2, 'KEY_TAB': 0xB3,
  'KEY_DELETE': 0xD4, 'KEY_INSERT': 0xD1, 'KEY_HOME': 0xD2, 'KEY_PAGE_UP': 0xD3,
  'KEY_END': 0xD5, 'KEY_PAGE_DOWN': 0xD6,
  'KEY_RIGHT_ARROW': 0xD7, 'KEY_LEFT_ARROW': 0xD8, 'KEY_DOWN_ARROW': 0xD9, 'KEY_UP_ARROW': 0xDA,
  'KEY_F1': 0xC2, 'KEY_F2': 0xC3, 'KEY_F3': 0xC4, 'KEY_F4': 0xC5, 'KEY_F5': 0xC6, 'KEY_F6': 0xC7,
  'KEY_F7': 0xC8, 'KEY_F8': 0xC9, 'KEY_F9': 0xCA, 'KEY_F10': 0xCB, 'KEY_F11': 0xCC, 'KEY_F12': 0xCD,
  'KEY_F13': 0xF0, 'KEY_F14': 0xF1, 'KEY_F15': 0xF2, 'KEY_F16': 0xF3, 'KEY_F17': 0xF4, 'KEY_F18': 0xF5,
  'KEY_F19': 0xF6, 'KEY_F20': 0xF7, 'KEY_F21': 0xF8, 'KEY_F22': 0xF9, 'KEY_F23': 0xFA, 'KEY_F24': 0xFB,
  'HID_KEY_APPLICATION': 0x65,
};

export const CONSUMER_MAP: Record<string, number> = {
  'VOLUME_INCREMENT': 0x00E9, 'VOLUME_DECREMENT': 0x00EA, 'PLAY_PAUSE': 0x00CD, 'MUTE': 0x00E2,
  'SCAN_NEXT_TRACK': 0x00B5, 'SCAN_PREV_TRACK': 0x00B6, 'STOP': 0x00B7,
  'BRIGHTNESS_INCREMENT': 0x006F, 'BRIGHTNESS_DECREMENT': 0x0070,
};

export function getKeyCode(key: string): number {
  if (KEY_MAP[key]) return KEY_MAP[key];
  if (CONSUMER_MAP[key]) return CONSUMER_MAP[key];
  if (key.length === 1) return key.charCodeAt(0);
  return 0;
}
```
(The values in KEY_MAP are the Arduino-ESP32 `USBHIDKeyboard` non-printing key constants, which `Keyboard.press(uint8_t)` expects; single characters are passed as their ASCII code, 32 for space.) `getKeyName(code, type)` is the inverse used by import (`type 1` KEY_MAP then ASCII 32..126; `type 2` CONSUMER_MAP).

Keys offered by ActionModal (`COMMON_KEYS`): `a-z0-9`; `' '`, KEY_RETURN, KEY_ESC, KEY_BACKSPACE, KEY_TAB, KEY_DELETE, KEY_INSERT, KEY_HOME, KEY_END, KEY_PAGE_UP, KEY_PAGE_DOWN, KEY_UP/DOWN/LEFT/RIGHT_ARROW; KEY_F1..KEY_F24; KEY_LEFT/RIGHT_CTRL/SHIFT/ALT/GUI (8 modifier keys); HID_KEY_APPLICATION. Letters are lowercase only (no uppercase/punctuation options).

### 5.7 Pages / profiles and navigation
- `totalPages` set by `PAGES <n>` (= `config.pages.length`, includes folder pages). Default 1.
- Hardware prev/next buttons cycle `currentPage` mod `totalPages`. ino: visits every page. Template: skips pages flagged `isFolderPage[]` (via `FOLDER <p> 1`) with `do { nextP = ... } while (isFolderPage[nextP] && nextP != currentPage);`.
- "Folder" = a normal page flagged as folder, reached only via a button of type 5 (`currentPage = a.key`, or 0 if `a.key >= totalPages`). "Back" (type 6) always jumps to page 0 regardless of parent.
- The web Back default in a new folder: button 0 = `{label: back, iconName: 'arrow_back', iconLayout: 'icon-text-below', action:{type:'back', folder:{targetPageId: <parent id>}}}`.
- **Max pages**: firmware actions limited to 8 (`p < 8`); web allows adding up to 16 (`config.pages.length >= 16`) but duplicate is capped at 8 (`>= 8`). Effective safe max = **8** total (main + folders).
- Encoders always page 0 / global.

---

## 6. Communication protocols

There is **no WebSocket, no mDNS, no AP mode, no JSON, no chunked/base64 bitmap**. Two transports carry the same line-based text protocol: **Web Serial** (USB CDC, 115200) and **HTTP over Wi-Fi STA**.

### 6.1 Wi-Fi / network (firmware)
- Mode: **STA only** (`WiFi.mode(WIFI_STA); WiFi.begin(wifi_ssid, wifi_password);`), credentials compile-time (`const char* wifi_ssid / wifi_password`), baked by the template from the SYNC panel inputs (`generateFirmware(config, ssid, password)`; unescaped, empty SSID -> Wi-Fi entirely skipped). Connect wait: up to 10 x 500 ms; if it fails, no HTTP/OTA for that boot (no retry/reconnect).
- **The committed ino contains personal Wi-Fi credentials hard-coded: `wifi_ssid = "<REDACTED>"`, `wifi_password = "<REDACTED>"`, `pc_ip = "<REDACTED>"`. Do not carry them into the rewrite.**
- Discovery: none (user reads the IP from the OLED splash and types it in the web app). Port 80. Also `ArduinoOTA.begin()` (default config).
- Handler code (verbatim, ino = template):
```cpp
      server.enableCORS(true);
      server.on("/", []() {
        String html = "<html><body><h1>Danjos Deck</h1><p>IP: " + WiFi.localIP().toString() + "</p></body></html>";
        server.send(200, "text/html", html);
      });
      server.on("/command", HTTP_POST, []() {
        if (server.hasArg("plain")) { processCommand(server.arg("plain")); server.send(200, "text/plain", "OK"); }
      });
      server.on("/upload", HTTP_POST, []() { server.send(200, "text/plain", "OK"); }, []() {
        HTTPUpload& upload = server.upload();
        if (upload.status == UPLOAD_FILE_START) {
          String filename = upload.filename;
          if (!filename.startsWith("/")) filename = "/" + filename;
          File f = LittleFS.open(filename, "w");
          if (f) f.close();
        } else if (upload.status == UPLOAD_FILE_WRITE) {
          String filename = upload.filename;
          if (!filename.startsWith("/")) filename = "/" + filename;
          File f = LittleFS.open(filename, "a");
          if (f) { f.write(upload.buf, upload.currentSize); f.close(); }
        } else if (upload.status == UPLOAD_FILE_END) {
          if (upload.filename == "config.json" || upload.filename == "/config.json") {
            loadConfig();
            updateDisplays();
          }
        }
      });
      server.begin();
```
HTTP routes:

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/` | - | 200 `text/html` tiny page with IP |
| POST | `/command` | body = ONE protocol line (`Content-Type: text/plain`, so WebServer exposes it as arg `plain`). NOT trimmed. | 200 `text/plain` `OK` (always, even for unknown commands). If body is empty (no `plain` arg) the handler sends NO response (client hangs). |
| POST | `/upload` | `multipart/form-data`, one part named `file` with `filename=b_<b>_<p>.bin`, `application/octet-stream`, 1024 bytes | 200 `text/plain` `OK`. Saved to LittleFS `/<filename>`, written in "a"ppend chunks (file truncated on START). Any filename is accepted (path traversal/overwrite of `/config.txt` possible). Uploading `config.json` triggers `loadConfig()`+`updateDisplays()` (web never does). |

CORS: `server.enableCORS(true)` (adds `Access-Control-Allow-Origin: *`); no custom headers, no explicit OPTIONS routes. Requests are "simple" (text/plain, multipart) so no preflight is needed. The configurator, if served over HTTPS, is blocked by mixed-content rules (UI warns: `wifiWarnDesc`).
Persistence: lines are appended to `/config.txt` / `/pins.txt` as they arrive; `SAVE` merely re-parses `config.txt` into RAM (`loadConfig()`), redraws, and clears `isSyncing`. Bitmaps are written immediately to `/b_x_y.bin`.

### 6.2 Command protocol (shared by HTTP `/command` and Serial; one command per line)
```cpp
void processCommand(String cmd) {
  if (cmd == "CLEAR") {
    isSyncing = true;
    File root = LittleFS.open("/");
    File file = root.openNextFile();
    while(file){
      String fileName = String(file.name());
      if (!fileName.startsWith("/")) fileName = "/" + fileName;
      LittleFS.remove(fileName);
      file = root.openNextFile();
    }
    Serial.println("OK");
  } else if (cmd == "SAVE") {
    isSyncing = false;
    loadConfig();
    updateDisplays();
    Serial.println("OK");
  } else if (cmd.startsWith("ACT ") || cmd.startsWith("SEQ ") || cmd.startsWith("PAGES ") || cmd.startsWith("PCIP ") || cmd.startsWith("FOLDER ")) {   // ino: no FOLDER
    File f = LittleFS.open("/config.txt", "a");
    f.println(cmd);
    f.close();
    Serial.println("OK");
  } else if (cmd.startsWith("P ")) {
    File f = LittleFS.open("/pins.txt", "a");
    f.println(cmd);
    f.close();
    Serial.println("OK");
  } else if (cmd.startsWith("BITMAP ")) {
    int space1 = cmd.indexOf(' ', 7);
    int b = cmd.substring(7, space1).toInt();
    int p = cmd.substring(space1 + 1).toInt();
    Serial.println("READY");
    uint8_t buf[1024];
    size_t read = Serial.readBytes(buf, 1024);
    if (read == 1024) {
      String filename = "/b_" + String(b) + "_" + String(p) + ".bin";
      File file = LittleFS.open(filename, "w");
      file.write(buf, 1024);
      file.close();
      Serial.println("OK");
    } else {
      Serial.println("ERROR");
    }
  }
}
```
Replies are printed on **Serial** (even for HTTP-originated commands); HTTP clients only get a literal `OK`. Unknown commands: no reply at all on Serial.

Grammar (space-separated decimal ints, `\n` terminated):
- `CLEAR` - set `isSyncing=true`, delete every file in LittleFS root (config.txt, pins.txt, all b_*.bin). Device stays in syncing state (buttons/displays frozen) until `SAVE`.
- `PAGES <n>`
- `FOLDER <page> 1` (template only; only sent for folder pages)
- `PCIP <ip>` (note: with an empty IP this is `PCIP ` - see bugs)
- `ACT <b> <p> <type> <mod> <key> <v1> <v2>` (`b` 0..11, `p` 0..7)
- `SEQ <b> <p> <step> <type> <mod> <key> <v1> <v2> <delayMs>` (`step` 0..9)
- `P <id> <value>` (one pin per line; id table in section 3)
- `BITMAP <b> <p>` -> device replies `READY`, host sends exactly 1024 raw bytes, device replies `OK` or `ERROR` (Serial only; `Serial.readBytes` default 1 s timeout)
- `SAVE` -> reload + redraw
- `config.txt` format = the same `PAGES/FOLDER/PCIP/ACT/SEQ` lines, parsed by `loadConfig()`:
```cpp
void loadConfig() {
  totalPages = 1;
  memset(actions, 0, sizeof(actions));
  memset(macroLen, 0, sizeof(macroLen));
  memset(isFolderPage, 0, sizeof(isFolderPage));   // template only
  pc_ip = "${config.pcIp || ''}";                  // ino: "<REDACTED>"
  File f = LittleFS.open("/config.txt", "r");
  ...
    if (line.startsWith("PAGES ")) { totalPages = line.substring(6).toInt(); }
    else if (line.startsWith("FOLDER ")) { sscanf(.., "FOLDER %d %d", &p, &isF) ... if (p < 16) isFolderPage[p] = (isF == 1); }
    else if (line.startsWith("PCIP ")) { pc_ip = line.substring(5); pc_ip.trim(); }
    else if (line.startsWith("ACT ")) { sscanf(.., "ACT %d %d %d %d %d %d %d", &b,&p,&t,&m,&k,&v1,&v2); if (b < 12 && p < 8) actions[b][p] = {...}; }
    else if (line.startsWith("SEQ ")) { sscanf(.., "SEQ %d %d %d %d %d %d %d %d %d", &b,&p,&s,&t,&mod,&k,&v1,&v2,&d); if (b < 12 && p < 8 && s < 10) { macros[b][p][s] = {...}; if (s + 1 > macroLen[b][p]) macroLen[b][p] = s + 1; } }
```
(`macros` array itself is never cleared; only `macroLen`.)

### 6.3 Web side sync (`lib/syncProtocol.ts`)
**Wi-Fi sync `syncConfigViaWiFi(ip, config, onProgress)`** - base `http://${ip}`:
```ts
const sendCommand = async (cmd: string) => {
  const res = await fetch(`${baseUrl}/command`, { method: 'POST', body: cmd, headers: { 'Content-Type': 'text/plain' } });
  if (!res.ok) throw new Error(`Command failed: ${cmd}`);
};
const uploadFile = async (filename: string, data: Uint8Array) => {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
  formData.append('file', blob, filename);
  const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${filename}`);
};
```
Order: `CLEAR` -> `PAGES n` -> `FOLDER p 1` for each folder page -> `P i pin` x16 (i = 0..15 in the table order; pin values RAW, ignoring `*Enabled` flags) -> `PCIP <ip>` if `config.pcIp !== undefined` -> for each page p, button b (0..5): [`SEQ`...] `ACT b p ...`, then (if bitmap length 1024) upload `b_${b}_${p}.bin` -> encoder actions `ACT 6..11 0 ...` (cw1, ccw1, btn1, cw2, ccw2, btn2) -> `SAVE`. Progress: 0, 10, 10..90 per button, 95, 98, 100. No retries/timeouts.

**USB sync `syncConfigToDevice(config, writeText, writeBinary, setOnLineReceived, onProgress)`**: same order, but each command awaits a reply line (`waitForResponse(expected, timeoutMs)`): `CLEAR`->`OK` (10 s), `PAGES`->`OK` (2 s), `FOLDER`->`OK`, `PCIP`->`OK`, `SEQ`/`ACT`->`OK` (2 s), **pins sent as ONE line** `P b1 b2 b3 b4 b5 b6 prev next e1clk e1dt e1btn e2clk e2dt e2btn sda scl`, `BITMAP b p` -> `READY` (2 s) -> raw `Uint8Array(1024)` -> `OK` (5 s), encoder ACTs, `SAVE` -> `OK` (5 s). On failure: `onProgress('Sync failed: ...', 0)` and rethrow.

**Import `importConfigFromDevice`**: sends `EXPORT` and expects lines `PAGES n`/`ACTION b p t m k`, `END_CONFIG`, `BITMAP_HEX b p <2048 hex chars>`, `END_EXPORT` (15 s timeout). **Firmware has NO `EXPORT` command** - this feature is dead (always times out). `parseExportedConfig` only restores keyboard/consumer/folder/back actions and bitmaps.

**Serial helper `hooks/useSerial.ts`**: Web Serial `navigator.serial.requestPort()`, `port.open({ baudRate })` (default 115200; UI offers 9600/115200/230400), no filters. `writeText(text)` writes `text + '\n'` (TextEncoder) and releases the writer lock every call; `writeBinary(Uint8Array)` writes raw bytes. Read loop decodes UTF-8, splits on `\n`, trims, logs `RX: <line>`, and forwards each non-empty trimmed line to a single `onLineReceived` callback; `waitForResponse` compares the whole line to the expected string (`'OK'`, `'READY'`).

**Other web data flows**: `handleDownloadConfig` produces a "manual" `config.txt` with format `ACTION <b> <p> <type> <mod> 0` (wrong/lossy; firmware parses `ACT`, not `ACTION`). `handleDownloadFirmware` downloads `danjos_deck_firmware.ino` from the template. Quick-sync button: USB if connected else Wi-Fi if IP set.

---

## 7. Firmware template generation (`lib/firmwareTemplate.ts`)

`generateFirmware(config: DanjosDeckConfig, ssid = '', password = '')` returns one big template string. Substitutions:
- `PIN_BTN[0..5]`: `${pins?.btnNEnabled !== false ? (pins?.btnN ?? N) : -1}`; likewise `PIN_PREV` (default 7), `PIN_NEXT` (15), `PIN_ENC1_*` (16/17/18, gated by `enc1Enabled`), `PIN_ENC2_*` (20/21/41, gated by `enc2Enabled`); `PIN_SDA = ${pins ? pins.sda : 8}`, `PIN_SCL = ${pins ? pins.scl : 9}`.
- `const char* wifi_ssid = "${ssid}"; const char* wifi_password = "${password}";`
- `String pc_ip = "${config.pcIp || ''}";` and again inside `loadConfig()` (`pc_ip = "${config.pcIp || ''}";`).
- `${generateEmbeddedActions()}` inside `executeAction` (text and cpp, section 5.4).
- Backslash escapes in the TS template literal are doubled so output contains `'\n'` (`readStringUntil('\\n')` -> `'\n'`).
Everything else is static text. No other placeholders. Generated file name: `danjos_deck_firmware.ino`.

**Discrepancies between the committed ino and the template**
1. ino lacks `isFolderPage[]`, `FOLDER` command, `memset(isFolderPage)`; ino `processCommand` does not accept `FOLDER ` (returns no reply -> USB sync times out when folders exist).
2. ino `executeAction` has no type 5 (folder) / 6 (back) handling; template does.
3. ino nav buttons do not skip folder pages; template does.
4. Enc2 pins: ino `-1/-1/-1`; template `20/21/41` default (configurable/disable).
5. `pc_ip`: ino default `"<REDACTED>"` (in both globals and `loadConfig`); template `config.pcIp || ''`.
6. ino has hard-coded Wi-Fi credentials; template uses the SYNC-panel values.
7. ino has no embedded text/cpp actions (placeholder blank lines at "Hardcoded C++ Actions").
8. ino `Action` comment says 5=cpp; template reuses 5 for folder.
9. Both define `setDisplaysOn()` before `tcaselect()` is declared (works only because Arduino auto-generates prototypes for .ino files; will fail in plain C++/PlatformIO `.cpp` unless a prototype is added).
10. The TS `ButtonState.bitmap` default and template have no direct link (bitmaps never compiled in).

---

## 8. Web app data model

### 8.1 `lib/types.ts` (verbatim)
```ts
export type ActionType = 'keyboard' | 'text' | 'consumer' | 'mouse' | 'cpp' | 'sequence' | 'folder' | 'back' | 'none';

export type ConsumerAction =
  | 'VOLUME_INCREMENT' | 'VOLUME_DECREMENT' | 'PLAY_PAUSE' | 'MUTE'
  | 'SCAN_NEXT_TRACK' | 'SCAN_PREV_TRACK' | 'STOP' | 'BRIGHTNESS_INCREMENT' | 'BRIGHTNESS_DECREMENT';

export interface KeyModifiers {
  leftGui: boolean; leftCtrl: boolean; leftShift: boolean; leftAlt: boolean;
  rightCtrl: boolean; rightShift: boolean; rightAlt: boolean;
}

export interface KeyboardAction {
  modifiers: KeyModifiers;
  key: string; // e.g. 'c', 'F13', 'KEY_RIGHT_CTRL', 'HID_KEY_APPLICATION', 'SPACE'
}

export interface MouseAction {
  actionType: 'move' | 'click' | 'scroll';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  amount?: number; // for scroll
}

export interface CppAction { code: string; }

export interface FolderAction {
  targetPageId?: string;
  targetPageIndex?: number;
}

export interface SequenceStep {
  type: 'keyboard' | 'text' | 'consumer' | 'mouse' | 'delay';
  keyboard?: KeyboardAction;
  text?: string;
  consumer?: ConsumerAction;
  mouse?: MouseAction;
  delayMs?: number;
}

export interface ButtonAction {
  type: ActionType;
  keyboard?: KeyboardAction;
  text?: string;
  consumer?: ConsumerAction;
  mouse?: MouseAction;
  cpp?: CppAction;
  sequence?: SequenceStep[];
  folder?: FolderAction;
}

export interface ButtonState {
  label: string;
  bitmap: number[]; // 1024 bytes, empty array = use default border bitmap
  action: ButtonAction;
  iconName?: string;
  iconLayout?: 'icon-only' | 'icon-text-side' | 'icon-text-below';
  iconSize?: number;
  iconXOffset?: number;
  iconYOffset?: number;
  textSize?: number;
  textXOffset?: number;
  textYOffset?: number;
  showBorder?: boolean;
}

export interface EncoderConfig {
  cwAction: ButtonAction;    // clockwise = volume up by default
  ccwAction: ButtonAction;   // counter-clockwise = volume down
  btnAction: ButtonAction;   // press = play/pause
}

export interface PinConfig {
  btn1: number; btn2: number; btn3: number; btn4: number; btn5: number; btn6: number;
  btnPrev: number; btnNext: number;
  enc1Clk: number; enc1Dt: number; enc1Btn: number;
  enc2Clk: number; enc2Dt: number; enc2Btn: number;
  sda: number; scl: number;
  btn1Enabled?: boolean; btn2Enabled?: boolean; btn3Enabled?: boolean; btn4Enabled?: boolean;
  btn5Enabled?: boolean; btn6Enabled?: boolean;
  btnPrevEnabled?: boolean; btnNextEnabled?: boolean;
  enc1Enabled?: boolean; enc2Enabled?: boolean;
}

export interface PageConfig {
  id: string;
  name: string;
  parentId?: string;
  isFolder?: boolean;
  buttons: ButtonState[]; // exactly 6 buttons per page
}

export interface DanjosDeckConfig {
  pages: PageConfig[];
  encoder1: EncoderConfig;
  encoder2: EncoderConfig;
  pins: PinConfig;
  pcIp?: string;
}
```
(The code also writes undeclared `id` fields on buttons in `parseExportedConfig` via `as any`. Page IDs: `p0`, `p1` (defaults), `p-<Date.now()>`, `p<Date.now()>` (duplicate), `folder-<Date.now()>`.)

### 8.2 Storage (`lib/storage.ts`, browser localStorage)
| Key | Value |
|---|---|
| `danjos_deck_config` | JSON of `DanjosDeckConfig` where each `button.bitmap` with length > 0 is replaced by a **base64 string** of the 1024 raw bytes (`btoa(String.fromCharCode(...))`). Empty bitmaps stay `[]`. Loading converts strings back to `number[]`. |
| `danjos_ip` | ESP32 IP string for Wi-Fi sync |
| `danjos_lang` | `'en'` or `'pt'` |
`saveConfig` is called on every change; errors only logged. Load migration: if `!loaded.encoder1` -> `encoder1 = loaded.encoder || DEFAULT.encoder1; encoder2 = DEFAULT.encoder2; pins = DEFAULT.pins`.
Backup/JSON import/export described in README is NOT implemented.

### 8.3 Default config (`StreamDeckConfigurator.tsx`)
- `pages` created on first load: 2 pages `{id:'p0', name:'Page 1'}`, `{id:'p1', name:'Page 2'}` with the same 6 buttons (bitmap = `generateDefaultBitmap()`, i.e. only a border, no label render):
  1. `Color Pick`: keyboard `c` + leftGui + leftShift
  2. `New Tab`: `t` + leftGui + leftCtrl
  3. `Spotlight`: `' '` (space) + leftGui + leftAlt
  4. `App 2`: `2` + leftGui
  5. `Context Menu`: `HID_KEY_APPLICATION`, no mods
  6. `Right Ctrl`: `KEY_RIGHT_CTRL`, no mods
- `encoder1`: cw `consumer VOLUME_INCREMENT`, ccw `VOLUME_DECREMENT`, btn `PLAY_PAUSE`; `encoder2`: cw `VOLUME_INCREMENT`, ccw `VOLUME_DECREMENT`, btn `MUTE`.
- `pins`: `DEFAULT_PINS` (section 3); `pcIp: ''`.
- New page: 6 buttons `{label:'', bitmap: generateDefaultBitmap(), action:{type:'none'}}`, name `${t.page} ${mainPages.length+1}`.
- UI constants: tabs `config | sync | pins | docs`; header badge text "v2.5 Firmware"; ~100 `POPULAR_ICONS` Material Symbols names; i18n en/pt dictionaries (`lib/i18n.ts`, ~190 keys each, same keys).
- Fonts/assets pulled from the network: Google Fonts "Material Symbols Rounded" (`<link>` in layout), Inter, logo `https://i.imgur.com/700dwV5.png`.

---

## 9. Known bugs, inconsistencies, layout problems

### Protocol / firmware mismatches (critical first)
1. **USB pin sync corrupts pin config.** `syncConfigToDevice` sends `P 1 2 3 4 5 6 7 15 16 17 18 20 21 41 8 9` (one line, 16 values). Firmware expects `P <id> <val>`: it parses `id` = first number (btn1 pin) and `val` = LAST number (scl pin), then `PIN_BTN[id]`/etc. = SCL value. With defaults it sets `PIN_BTN[1] = 9` (= the SCL pin!) and persists it in `/pins.txt`, applied at next boot. Only the Wi-Fi path (`P <i> <pin>` x16) matches the firmware.
2. **USB sync fails with the default config**: `config.pcIp` defaults to `''` (defined), so web sends `PCIP ` (trailing space); Serial path trims the command (`cmd.trim()` in `loop()`) -> `PCIP`, which matches no branch -> no `OK` -> `waitForResponse('OK', 2000)` times out ("Timeout waiting for OK"). (Over HTTP the untrimmed `PCIP ` is stored; `loadConfig` then trims it to `PCIP`, ignored -> pc_ip stays template default.)
3. **ino (committed) does not support `FOLDER`, folder (5) or back (6) actions**; USB sync with any folder page stalls on `FOLDER` (no reply). Template does.
4. **`EXPORT`/import does not exist in firmware**; the "Import" button always times out after 15 s (and the UI just stops spinning).
5. **Back action ignores target**: web computes parent index into `key`, firmware always `currentPage = 0`. UI offers "back to parent/other page" options that do nothing different.
6. **Pages > 8**: web allows up to 16 pages; firmware `actions[12][8]`: `ACT/SEQ` for p >= 8 silently dropped (bitmaps still stored, so screens show images but buttons do nothing).
7. **Macros > 10 steps** silently truncated (UI has no limit).
8. **Compiled-in `text`/`cpp` actions** are keyed by page index at flash time; not synced over the air; changing text requires re-flash; `text` containing `\`, newline or `%` breaks/corrupts the generated C++ (only `"` escaped). In ino there is no way to use `text` at all. ACT sent as type 0.
9. **Bogus key codes**: `KEY_LEFT_CTRL/SHIFT/ALT/GUI`, `KEY_RIGHT_*` offered in the key picker and `KEY_RIGHT_CTRL` used by the default "Right Ctrl" button are NOT in `KEY_MAP`; `getKeyCode` returns `0` -> keyboard action presses nothing (the 6th default button is a no-op). `HID_KEY_APPLICATION = 0x65` is passed to `Keyboard.press(uint8_t)`, which treats values < 128 as ASCII (0x65 == 'e') - likely types "e" instead of the Menu key (needs `pressRaw`). Letters are lowercase only.
10. **Mouse scroll has no UI field for `amount`** (always 0 -> no-op). Mouse move inputs use `parseInt` -> `NaN` when blank. `rightGui` modifier missing in web types though firmware supports bit 128.
11. **`Clear ESP` button** sends `CLEAR\n` through `writeText` (extra blank line) and never sends `SAVE`, leaving the device in `isSyncing=true` (displays frozen, buttons ignored) until reboot/next sync. Any sync that fails mid-way leaves the same stuck state.
12. **CLEAR deletes while iterating** the LittleFS root (`openNextFile` after `remove`) - may skip files, leaving stale `b_*.bin`; also removes `/pins.txt` but RAM pins are unchanged.
13. **Pins disabled flags not synced**: `*Enabled=false` only affects generated firmware (`-1`); runtime sync sends raw numbers. `PinsSettings` parses `parseInt(value) || 0`, so a cleared field becomes pin 0 (strapping pin) and the field displays blank. Pin changes need reboot (loadPins only at boot) even though the UI note says "re-flash".
14. **Default enc2 pin 20 = USB D+** on ESP32-S3 (19/20 are USB). Different defaults in four places (see section 3).
15. **Race/robustness in USB sync**: `writeText` swallows errors; `waitForResponse` is registered after the write resolves (response could be missed -> timeout); `writeBinary` then wait for `OK`; no CRC; 1024-byte raw payload must arrive within `Serial.readBytes` 1 s timeout. Bitmap bytes can contain `\n` but are read raw, fine.
16. Blocking firmware: 200 ms/50 ms delays, 1.5 s ping, macro delays, 5 s IP splash; HTTP and encoder polling stall meanwhile. Encoder uses simple polling (missed steps, bounce).
17. `/command` with empty body never replies; unknown commands return `OK` over HTTP; replies go to Serial. No auth on HTTP/OTA; `/upload` accepts arbitrary filenames (can overwrite config).
18. `handleDownloadConfig` ("manual fallback") emits `ACTION b p type mod 0` which the firmware does not parse (and type is 1 or 2 only, no key). Useless.
19. `loadConfig` does not reset `macros[]` (only `macroLen`), `executeAction` has no bounds check for `b/p` beyond callers; `f.read` result unchecked in `updateDisplays`.
20. Hard-coded Wi-Fi credentials and PC IP in the committed ino (privacy).
21. Wi-Fi not retried after boot failure; no reconnect handling; no mDNS; IP only visible on OLEDs for 5 s at boot.
22. Template: `${pins.sda}` etc. could emit `NaN`/`undefined` for malformed stored config; ssid/password not C-escaped.

### Web app issues
- **State is mutated in place** (`newC.pages.push`, `newConfig.pages[i].buttons[j] = ...` after a shallow `{...config}` spread; ActionModal mutates `action.keyboard.modifiers`), relying on `saveConfig` + `setConfig` to re-render.
- **Editing any appearance control regenerates the bitmap** via `generateIconBitmap`, overwriting an image uploaded with `imageToBitmap` (camera button in `ButtonCard`).
- Newly created pages share the same `bm` array reference across 6 buttons.
- `updateButtonDesign` is async; rapid slider changes can race and apply out of order. The font is loaded from Google Fonts; if offline, icons are drawn as ligature text.
- `ButtonCard` is a 96x96 (`w-24 h-24`) card but renders `BitmapCanvas` at a fixed inline `width:128px;height:64px` (inline style beats `w-full`), so the 2:1 preview is clipped by `overflow-hidden`. Buttons whose bitmap is all zeros show only the label text.
- `app/globals.css` uses sweeping `!important` overrides (every `button`, `input`, `select`, `textarea`, `.bg-[#...]`, `.border-*`, `.shadow-*`, `.bg-blue-600/green/orange`) that neutralize Tailwind colors/states; active-tab and selection highlights are hacked by `.bg-blue-600 { inset shadow }`. `custom-scrollbar` class is used but never defined.
- Fixed `h-[460px]` bottom panel, `w-[500px]` modal, 12-column fixed grid: not responsive; modal overflows on phones. The editor needs `overflow-hidden` at root and clips on short viewports.
- `duplicatePage` cap 8 vs add cap 16; deleting a page does not repair `folder.targetPageId`/`parentId`; `handleCreateSubFolder` in ActionModal names `Folder ${pages.length+1}` and uses all-zero bitmaps; `handleAddFolder` uses `generateDefaultBitmap`.
- `renameCurrentPage` is in the button toolbar and uses `window.prompt`.
- `README` claims: JSON backup export/import (absent), 128x64 AND 64x64 bitmaps (only 128x64), "Standby by ping" (present), "WebSocket" (absent), config.json upload (never used).
- Dead code/deps: `lib/utils.ts (cn)`, `hooks/use-mobile.ts`, `.env.example` (GEMINI_API_KEY, APP_URL; AI Studio boilerplate), `@google/genai`, `motion`, `jszip`, `class-variance-authority`, `@hookform/resolvers`, `firebase-tools` are never imported. `build` script uses `rm -rf dist && mv out dist` (POSIX-only). `next.config.ts` has `output: 'export'`, `images.unoptimized`, remotePatterns picsum/imgur.
- Metadata: `layout.tsx` title "Danjos Deck", `html lang="en" class="dark"`, favicon = imgur URL.
- `metadata.json`: `{"name": "Danjos Deck", "description": "Visual configurator for ESP32 macro decks.", "requestFramePermissions": [], "majorCapabilities": []}` (AI Studio applet manifest).

---

## 10. Old dependencies (`package.json`)

name `ai-studio-applet` v0.1.0, private. Scripts: `dev: next dev`, `build: next build && rm -rf dist && mv out dist`, `lint: eslint .`, `clean: next clean`.

dependencies:
```
"@google/genai": "^1.17.0",        (unused)
"@hookform/resolvers": "^5.2.1",   (unused)
"autoprefixer": "^10.4.21",
"class-variance-authority": "^0.7.1", (unused)
"clsx": "^2.1.1",
"jszip": "^3.10.1",                (unused)
"lucide-react": "^0.553.0",
"motion": "^12.23.24",             (unused)
"next": "^16.2.4",
"postcss": "^8.5.6",
"react": "19.0.0",
"react-dom": "19.0.0",
"tailwind-merge": "^3.3.1"
```
devDependencies:
```
"@eslint/eslintrc": "^3.2.0", "@eslint/js": "^9.17.0", "@tailwindcss/postcss": "4.1.11",
"@tailwindcss/typography": "^0.5.19", "@types/jszip": "^3.4.1", "@types/node": "^20.17.19",
"@types/react": "^19.0.8", "@types/react-dom": "^19.0.3", "@types/w3c-web-serial": "^1.0.8",
"eslint": "^9.17.0", "eslint-config-next": "^16.2.4", "firebase-tools": "^15.0.0",
"tailwindcss": "4.1.11", "tw-animate-css": "^1.4.0", "typescript": "^5.7.3"
```
Actually used at runtime: `next`, `react`, `react-dom`, `lucide-react` (icons: Settings2, Bell, Settings, User, ChevronLeft/Right, Trash2, Edit2, Plus, Layout, Cpu, BookOpen, Send, Wifi, Usb, RefreshCw, Sliders, Search, Folder, Camera, ArrowLeft, ArrowUp, ArrowDown, X, Download, Monitor, Terminal, Plug, Unplug, Book, Code, Mouse, Keyboard, Clock, Info), `tailwindcss` v4 (+ `@tailwindcss/postcss`), `@types/w3c-web-serial` (Web Serial types), `typescript`. `tsconfig`: strict, `paths: {"@/*": ["./*"]}`, target ES2017, bundler resolution. Browser requirements: Web Serial API (Chromium), `OffscreenCanvas`, `document.fonts`.

File inventory audited: .ino; lib/{firmwareTemplate,imageConverter,keyMap,syncProtocol,types,storage,i18n,utils}.ts; hooks/{useSerial,use-mobile}.ts; components/{ActionModal,BitmapCanvas,ButtonCard,ButtonGrid,InstructionsTab,PinsSettings,SerialMonitor,StreamDeckConfigurator,SyncPanel}.tsx; app/{layout,page,not-found}.tsx + globals.css; package.json, next.config.ts, tsconfig.json, eslint configs, postcss, README.md, metadata.json, .env.example.
