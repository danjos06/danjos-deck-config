/**
 * Danjos Deck v2 firmware template, as composable string builders.
 *
 * Every builder returns a chunk of C++ (Arduino-ESP32 core 3.x, ESP32-S3, USB-OTG/TinyUSB).
 * Static chunks use `String.raw` so backslashes (`'\n'`, `\"`) reach the generated file literally.
 * Nothing here touches the DOM; it is pure and unit tested through `generateFirmware`.
 */
import { toCppArray } from '../bitmap/cpp';
import { tryBase64ToBitmap } from '../bitmap/pack';
import { MAX_MACRO_STEPS, MAX_PAGES, PIN_IDS } from '../constants';
import { encodeAction } from '../protocol/encode';
import type { Action, DeckConfig } from '../types';

export const FIRMWARE_VERSION = '2.0.0';

const KEYS = 6;

/* ------------------------------------------------------------------ helpers */

/**
 * Escapes text for use inside a C string literal. Backslash, quote, CR/LF/TAB are escaped,
 * `??` is split (trigraph safety) and every other non-printable / non-ASCII character is
 * stripped. With `keepUtf8` non-ASCII characters are kept as 3-digit octal UTF-8 bytes
 * (used for Wi-Fi SSID/password/hostname where stripping would change the value).
 */
export function escapeCString(s: string, opts: { keepUtf8?: boolean } = {}): string {
  let out = '';
  let prev = '';
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '?' && prev === '?') out += '\\?';
    else if (c >= 32 && c < 127) out += ch;
    else if (c >= 128 && opts.keepUtf8) {
      for (const byte of new TextEncoder().encode(ch)) out += '\\' + byte.toString(8).padStart(3, '0');
    }
    prev = ch;
  }
  return out;
}

/** Makes a string safe for a `//` comment: no line breaks, no comment terminators. */
function commentSafe(s: string): string {
  return String(s ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\*\//g, '* /')
    .replace(/[^\x20-\x7e]/g, '?');
}

function intOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  return Math.min(hi, Math.max(lo, intOr(v, fallback)));
}

function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

function cfgPages(cfg: DeckConfig) {
  return cfg.pages.slice(0, MAX_PAGES);
}

/* ----------------------------------------------------------------- sections */

export function headerSection(cfg: DeckConfig, now: Date): string {
  return String.raw`// ============================================================================
// Danjos Deck firmware v${FIRMWARE_VERSION} - generated file, do not edit by hand
// Deck name : ${commentSafe(cfg.name)}
// Generated : ${now.toISOString()}
//
// Board settings (Arduino IDE, "ESP32S3 Dev Module" or equivalent):
//   USB Mode            : USB-OTG (TinyUSB)
//   USB CDC On Boot     : Enabled
//   Partition Scheme    : any with a LittleFS/SPIFFS data partition (e.g. Default 4MB with spiffs)
//   Core                : arduino-esp32 3.x
// Libraries (Library Manager): Adafruit SSD1306, Adafruit GFX Library.
//   Everything else (USB, Wire, LittleFS, WiFi, WebServer, ESPmDNS, ArduinoOTA, ping) ships with the core.
//
// NOTE: text actions, C++ actions and the default (PROGMEM) bitmaps are baked at flash time,
// keyed by (button, page index). Reordering pages in the app requires re-flashing them.
// Everything else (actions, macros, pins, bitmaps) can be synced over Wi-Fi or USB serial.
// ============================================================================
`;
}

export function includesSection(): string {
  return String.raw`
#include <Arduino.h>
#include "USB.h"
#include "USBHIDKeyboard.h"
#include "USBHIDConsumerControl.h"
#include "USBHIDMouse.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include "ping/ping_sock.h"

#if defined(ARDUINO_USB_MODE) && ARDUINO_USB_MODE == 1
#error "Select Tools > USB Mode > USB-OTG (TinyUSB) - HID needs TinyUSB"
#endif

#define FW_VERSION "${FIRMWARE_VERSION}"
`;
}

export function configSection(cfg: DeckConfig): string {
  const hw = cfg.hardware;
  const pin = (id: (typeof PIN_IDS)[number]) => intOr(hw.pins[id], -1);
  const channels = Array.from({ length: KEYS }, (_, i) => clampInt(hw.muxChannels[i], 0, 7, i));
  const host = cfg.network.hostname.trim() || 'danjos-deck';
  const lines = [
    '',
    '// --- PINS (defaults baked from the app; /pins.txt overrides them at boot, -1 = disabled) ---',
    `int PIN_BTN[6] = { ${PIN_IDS.slice(0, 6).map(pin).join(', ')} };`,
    `int PIN_PREV = ${pin('prev')};`,
    `int PIN_NEXT = ${pin('next')};`,
    `int PIN_ENC1_CLK = ${pin('enc1Clk')};`,
    `int PIN_ENC1_DT = ${pin('enc1Dt')};`,
    `int PIN_ENC1_BTN = ${pin('enc1Sw')};`,
    `int PIN_ENC2_CLK = ${pin('enc2Clk')};`,
    `int PIN_ENC2_DT = ${pin('enc2Dt')};`,
    `int PIN_ENC2_BTN = ${pin('enc2Sw')};`,
    `int PIN_SDA = ${pin('sda')};`,
    `int PIN_SCL = ${pin('scl')};`,
    '',
    '// --- DISPLAYS (I2C mux address, OLED address, mux channel of each screen) ---',
    `uint8_t muxAddress = ${hex(clampInt(hw.muxAddress, 0, 127, 0x70))};`,
    `uint8_t oledAddress = ${hex(clampInt(hw.oledAddress, 0, 127, 0x3c))};`,
    `uint8_t muxChannels[6] = { ${channels.join(', ')} };`,
    '',
    '// --- NETWORK (empty SSID = Wi-Fi disabled) ---',
    `static const char WIFI_SSID[] = "${escapeCString(cfg.network.wifiSsid, { keepUtf8: true })}";`,
    `static const char WIFI_PASSWORD[] = "${escapeCString(cfg.network.wifiPassword, { keepUtf8: true })}";`,
    `static const char DECK_HOSTNAME[] = "${escapeCString(host, { keepUtf8: true })}";`,
    `static const char PC_IP_DEFAULT[] = "${escapeCString(cfg.network.pcIp.trim())}";`,
    '',
  ];
  return lines.join('\n');
}

/** PROGMEM default bitmaps (one array per key that has a rendered 1024-byte bitmap) + pointer table. */
export function bitmapsSection(cfg: DeckConfig): string {
  const pages = cfgPages(cfg);
  const arrays: string[] = [];
  const table: string[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const row: string[] = [];
    for (let b = 0; b < KEYS; b++) {
      const data = pages[p] ? tryBase64ToBitmap(pages[p].keys[b]?.bitmap ?? '') : null;
      if (data) {
        const sym = `DEF_BMP_${b}_${p}`;
        arrays.push(toCppArray(sym, data));
        row.push(sym);
      } else {
        row.push('nullptr');
      }
    }
    table.push(`  { ${row.join(', ')} }`);
  }
  return [
    '',
    '// --- DEFAULT BITMAPS (PROGMEM, used when /b_<key>_<page>.bin is missing or not 1024 bytes) ---',
    ...arrays,
    '// DEFAULT_BITMAPS[page][key]; nullptr = draw the generated fallback (border + key number)',
    `const uint8_t* const DEFAULT_BITMAPS[${MAX_PAGES}][${KEYS}] PROGMEM = {`,
    table.join(',\n'),
    '};',
    '',
  ].join('\n');
}

export function stateSection(): string {
  return String.raw`
// --- DISPLAY / HID / SERVER OBJECTS ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
USBHIDKeyboard Keyboard;
USBHIDConsumerControl Consumer;
USBHIDMouse Mouse;
WebServer server(80);

// --- TUNABLES ---
#define DEBOUNCE_MS 25            // per-pin debounce window
#define ENC_STEPS_PER_DETENT 4    // quadrature transitions per detent (typical KY-040 = 4, some = 2 or 1)
#define SYNC_TIMEOUT_MS 60000UL   // auto-leave sync mode when the host goes silent
#define PING_INTERVAL_MS 60000UL
#define PING_TIMEOUT_MS 1500
#define WIFI_RETRY_MS 15000UL
#define SPLASH_MS 2000UL
#define MAX_PAGES_FW 8

// --- TYPES ---
struct Action {
  uint8_t type; // 0=none, 1=keyboard, 2=consumer, 3=mouse, 4=macro, 5=folder, 6=back
  uint8_t mod;
  uint16_t key;
  int16_t val1; // mouse x / scroll
  int16_t val2; // mouse y
};

struct Step {
  uint8_t type; // same as Action, 4 = delay
  uint8_t mod;
  uint16_t key;
  int16_t val1;
  int16_t val2;
  uint16_t delayMs;
};

struct Debounce {
  bool state;
  uint32_t changedAt;
};

struct Encoder {
  uint8_t state;
  int8_t acc;
};

// --- STATE ---
int currentPage = 0;
int totalPages = 1;
bool isSyncing = false;
uint32_t lastSyncActivity = 0;
bool screensOn = true;
String pc_ip = PC_IP_DEFAULT;

Action actions[12][8];    // 6 keys + 2 encoders x 3 = 12 slots, max 8 pages
Step macros[12][8][10];   // max 10 steps per macro
uint8_t macroLen[12][8];
bool isFolderPage[16] = {false};

static uint8_t ioBuf[1024];
static String serialLine;

Debounce dbBtn[6];
Debounce dbPrev, dbNext, dbEnc1Sw, dbEnc2Sw;
Encoder enc1, enc2;

// network / ping state
bool wifiConfigured = false;
bool wifiWasConnected = false;
bool servicesStarted = false;
uint32_t lastWifiAttempt = 0;
uint32_t splashUntil = 0;

static const uint8_t PING_IDLE = 0, PING_RUNNING = 1, PING_DONE = 2;
volatile uint8_t pingState = PING_IDLE;
volatile bool pingGotReply = false;
esp_ping_handle_t pingHandle = nullptr;
uint32_t pingStartedAt = 0;
uint32_t lastPingAt = 0;
bool pingEverStarted = false;

// upload state
File uploadFile;
String uploadName;
bool uploadSeen = false;
bool uploadOk = false;
size_t uploadSize = 0;
`;
}

export function prototypesSection(): string {
  return String.raw`
// --- FORWARD DECLARATIONS ---
void tcaselect(uint8_t channel);
void setDisplaysOn(bool on);
void drawFallback(int key);
void updateDisplays();
void showSplash();
void loadPins();
void setAct(int b, int p, int t, int m, int k, int v1, int v2);
void setStep(int b, int p, int s, int t, int m, int k, int v1, int v2, int d);
void loadCompiledDefaults();
void loadConfig();
void runStep(uint8_t t, uint8_t m, uint16_t k, int16_t v1, int16_t v2);
void executeAction(int b, int p);
void navigate(int dir);
void touchSync();
void processCommand(String cmd, bool fromSerial);
void pollSerial();
void serviceSyncWatchdog();
void startPing();
void stopPing();
void servicePing();
bool isValidUploadName(const String& name);
void handleRoot();
void handleInfo();
void handleCommand();
void handleUploadData();
void handleUploadDone();
void startNetworkServices();
void serviceNetwork();
void setupPin(int pin);
bool debouncedPress(Debounce& d, int pin);
int encoderStep(Encoder& e, int clkPin, int dtPin);
uint8_t encoderReadState(int clkPin, int dtPin);
void pollInputs();
`;
}

export function displaySection(): string {
  return String.raw`
// ============================ DISPLAYS ============================
void tcaselect(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(muxAddress);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

void setDisplaysOn(bool on) {
  if (screensOn == on) return;
  screensOn = on;
  for (int i = 0; i < 6; i++) {
    tcaselect(muxChannels[i]);
    display.ssd1306_command(on ? SSD1306_DISPLAYON : SSD1306_DISPLAYOFF);
  }
  if (on) updateDisplays();
}

// Used when a key has neither a bitmap file nor a compiled default: border + key number.
void drawFallback(int key) {
  display.drawRoundRect(2, 2, 124, 60, 6, SSD1306_WHITE);
  display.setTextSize(4);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(52, 16);
  display.print(key + 1);
}

void updateDisplays() {
  if (isSyncing) return;
  for (int i = 0; i < 6; i++) {
    tcaselect(muxChannels[i]);
    display.clearDisplay();
    bool drawn = false;

    char path[24];
    snprintf(path, sizeof(path), "/b_%d_%d.bin", i, currentPage);
    File f = LittleFS.open(path, "r");
    if (f) {
      if (f.size() == 1024 && f.read(ioBuf, 1024) == 1024) {
        display.drawBitmap(0, 0, ioBuf, 128, 64, SSD1306_WHITE);
        drawn = true;
      }
      f.close();
    }
    if (!drawn && currentPage >= 0 && currentPage < MAX_PAGES_FW) {
      const uint8_t* def = DEFAULT_BITMAPS[currentPage][i];
      if (def != nullptr) {
        display.drawBitmap(0, 0, def, 128, 64, SSD1306_WHITE);
        drawn = true;
      }
    }
    if (!drawn) drawFallback(i);
    display.display();
  }
}

// Short boot / reconnect splash with the IP; restored by serviceNetwork() after SPLASH_MS.
void showSplash() {
  if (isSyncing) return;
  String ip = WiFi.localIP().toString();
  for (int i = 0; i < 6; i++) {
    tcaselect(muxChannels[i]);
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.print("Danjos Deck v");
    display.print(FW_VERSION);
    display.setCursor(0, 20);
    display.print("WiFi Connected");
    display.setCursor(0, 34);
    display.print("IP:");
    display.setCursor(0, 46);
    display.print(ip);
    display.display();
  }
  splashUntil = millis() + SPLASH_MS;
  if (splashUntil == 0) splashUntil = 1;
}
`;
}

/** Compiled default action table / macros / folders / pages, used when /config.txt is absent. */
export function defaultsSection(cfg: DeckConfig): string {
  const pages = cfgPages(cfg);
  const out: string[] = [];
  out.push(`  totalPages = ${Math.max(1, pages.length)};`);
  pages.forEach((page, i) => {
    if (page.isFolder) out.push(`  isFolderPage[${i}] = true;`);
  });
  const slot = (b: number, p: number, action: Action) => {
    const { act, seq } = encodeAction(action, { pages, currentPageIndex: p });
    seq.slice(0, MAX_MACRO_STEPS).forEach((row, s) => {
      out.push(`  setStep(${b}, ${p}, ${s}, ${row.join(', ')});`);
    });
    if (act[0] !== 0) out.push(`  setAct(${b}, ${p}, ${act.join(', ')});`);
  };
  pages.forEach((page, p) => {
    page.keys.slice(0, KEYS).forEach((key, b) => slot(b, p, key.action));
  });
  cfg.encoders.forEach((enc, e) => {
    (['cw', 'ccw', 'sw'] as const).forEach((fn, f) => {
      const raw = enc[fn];
      slot(6 + e * 3 + f, 0, raw.type === 'folder' || raw.type === 'back' ? { type: 'none' } : raw);
    });
  });
  return String.raw`
// Compiled defaults: a freshly flashed board works without any sync.
void loadCompiledDefaults() {
${out.join('\n')}
}
`;
}

export function storageSection(): string {
  return String.raw`
// ============================ STORAGE ============================
void loadPins() {
  File f = LittleFS.open("/pins.txt", "r");
  if (!f) return;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.startsWith("P ")) {
      int sp = line.indexOf(' ', 2);
      if (sp < 0) continue;
      int id = line.substring(2, sp).toInt();
      int val = line.substring(line.lastIndexOf(' ') + 1).toInt();
      switch (id) {
        case 0: PIN_BTN[0] = val; break;
        case 1: PIN_BTN[1] = val; break;
        case 2: PIN_BTN[2] = val; break;
        case 3: PIN_BTN[3] = val; break;
        case 4: PIN_BTN[4] = val; break;
        case 5: PIN_BTN[5] = val; break;
        case 6: PIN_PREV = val; break;
        case 7: PIN_NEXT = val; break;
        case 8: PIN_ENC1_CLK = val; break;
        case 9: PIN_ENC1_DT = val; break;
        case 10: PIN_ENC1_BTN = val; break;
        case 11: PIN_ENC2_CLK = val; break;
        case 12: PIN_ENC2_DT = val; break;
        case 13: PIN_ENC2_BTN = val; break;
        case 14: PIN_SDA = val; break;
        case 15: PIN_SCL = val; break;
        case 16: muxAddress = (uint8_t)val; break;
        case 17: oledAddress = (uint8_t)val; break;
        case 18: muxChannels[0] = (uint8_t)val; break;
        case 19: muxChannels[1] = (uint8_t)val; break;
        case 20: muxChannels[2] = (uint8_t)val; break;
        case 21: muxChannels[3] = (uint8_t)val; break;
        case 22: muxChannels[4] = (uint8_t)val; break;
        case 23: muxChannels[5] = (uint8_t)val; break;
        default: break; // unknown ids are ignored
      }
    }
  }
  f.close();
}

void setAct(int b, int p, int t, int m, int k, int v1, int v2) {
  if (b < 0 || b >= 12 || p < 0 || p >= 8) return;
  actions[b][p] = { (uint8_t)t, (uint8_t)m, (uint16_t)k, (int16_t)v1, (int16_t)v2 };
}

void setStep(int b, int p, int s, int t, int m, int k, int v1, int v2, int d) {
  if (b < 0 || b >= 12 || p < 0 || p >= 8 || s < 0 || s >= 10) return;
  macros[b][p][s] = { (uint8_t)t, (uint8_t)m, (uint16_t)k, (int16_t)v1, (int16_t)v2, (uint16_t)d };
  if (s + 1 > macroLen[b][p]) macroLen[b][p] = s + 1;
}

void loadConfig() {
  totalPages = 1;
  memset(actions, 0, sizeof(actions));
  memset(macros, 0, sizeof(macros));
  memset(macroLen, 0, sizeof(macroLen));
  memset(isFolderPage, 0, sizeof(isFolderPage));
  pc_ip = PC_IP_DEFAULT;

  File f = LittleFS.open("/config.txt", "r");
  if (!f) {
    loadCompiledDefaults();
  } else {
    while (f.available()) {
      String line = f.readStringUntil('\n');
      line.trim();
      if (line.startsWith("PAGES ")) {
        totalPages = line.substring(6).toInt();
      } else if (line.startsWith("FOLDER ")) {
        int p, isF;
        if (sscanf(line.c_str(), "FOLDER %d %d", &p, &isF) == 2) {
          if (p >= 0 && p < 16) isFolderPage[p] = (isF == 1);
        }
      } else if (line.startsWith("PCIP ")) {
        pc_ip = line.substring(5);
        pc_ip.trim();
      } else if (line.startsWith("ACT ")) {
        int b, p, t, m, k, v1, v2;
        if (sscanf(line.c_str(), "ACT %d %d %d %d %d %d %d", &b, &p, &t, &m, &k, &v1, &v2) == 7) {
          setAct(b, p, t, m, k, v1, v2);
        }
      } else if (line.startsWith("SEQ ")) {
        int b, p, s, t, mod, k, v1, v2, d;
        if (sscanf(line.c_str(), "SEQ %d %d %d %d %d %d %d %d %d", &b, &p, &s, &t, &mod, &k, &v1, &v2, &d) == 9) {
          setStep(b, p, s, t, mod, k, v1, v2, d);
        }
      }
    }
    f.close();
  }
  if (totalPages < 1) totalPages = 1;
  if (totalPages > MAX_PAGES_FW) totalPages = MAX_PAGES_FW;
  if (currentPage >= totalPages) currentPage = 0;
}
`;
}

/** Text / C++ actions compiled into executeAction(), keyed by (button, page). */
export function embeddedActionsSection(cfg: DeckConfig): string {
  const blocks: string[] = [];
  const add = (b: number, p: number, a: Action) => {
    if (a.type === 'cpp' && a.code.trim() !== '') {
      blocks.push(`  if (b == ${b} && p == ${p}) {\n${a.code}\n  return;\n  }`);
    } else if (a.type === 'text' && a.text !== '') {
      blocks.push(`  if (b == ${b} && p == ${p}) {\n  Keyboard.print("${escapeCString(a.text)}");\n  return;\n  }`);
    }
  };
  cfgPages(cfg).forEach((page, p) => page.keys.slice(0, KEYS).forEach((k, b) => add(b, p, k.action)));
  cfg.encoders.forEach((enc, e) => {
    (['cw', 'ccw', 'sw'] as const).forEach((fn, f) => add(6 + e * 3 + f, 0, enc[fn]));
  });
  return blocks.length ? blocks.join('\n') : '  // (no text / C++ actions)';
}

export function actionsSection(cfg: DeckConfig): string {
  return String.raw`
// ============================ ACTIONS ============================
void runStep(uint8_t t, uint8_t m, uint16_t k, int16_t v1, int16_t v2) {
  if (t == 1) { // keyboard: modifiers + key, tap
    if (m & 1) Keyboard.press(KEY_LEFT_CTRL);
    if (m & 2) Keyboard.press(KEY_LEFT_SHIFT);
    if (m & 4) Keyboard.press(KEY_LEFT_ALT);
    if (m & 8) Keyboard.press(KEY_LEFT_GUI);
    if (m & 16) Keyboard.press(KEY_RIGHT_CTRL);
    if (m & 32) Keyboard.press(KEY_RIGHT_SHIFT);
    if (m & 64) Keyboard.press(KEY_RIGHT_ALT);
    if (m & 128) Keyboard.press(KEY_RIGHT_GUI);
    if (k > 0) Keyboard.press((uint8_t)k);
    delay(10);
    Keyboard.releaseAll();
  } else if (t == 2) { // consumer / media key
    Consumer.press(k);
    Consumer.release();
  } else if (t == 3) { // mouse
    if (k == 1) Mouse.click(MOUSE_LEFT);
    else if (k == 2) Mouse.click(MOUSE_RIGHT);
    else if (k == 3) Mouse.click(MOUSE_MIDDLE);
    else if (k == 4) Mouse.move((int8_t)v1, (int8_t)v2, 0);
    else if (k == 5) Mouse.move(0, 0, (int8_t)v1);
  }
}

// Slots: 0..5 screen keys (per page), 6/7/8 = encoder 1 CW/CCW/SW, 9/10/11 = encoder 2 (always page 0).
void executeAction(int b, int p) {
  if (!screensOn) return;
  if (b < 0 || b >= 12 || p < 0 || p >= 8) return;

  // ---- text / C++ actions baked at flash time ----
${embeddedActionsSection(cfg)}
  // ---- end of baked actions ----

  Action a = actions[b][p];
  if (a.type == 5) { // folder: open page a.key
    currentPage = (a.key < totalPages) ? a.key : 0;
    updateDisplays();
    return;
  } else if (a.type == 6) { // back: go to the parent page stored in a.key, else page 0
    currentPage = (a.key < totalPages) ? a.key : 0;
    updateDisplays();
    return;
  }

  if (a.type == 4) {
    // Macro: BLOCKING (the loop, HTTP and encoders are paused while it runs). Max 10 steps.
    for (int i = 0; i < macroLen[b][p]; i++) {
      Step s = macros[b][p][i];
      if (s.type == 4) delay(s.delayMs); // delay step
      else runStep(s.type, s.mod, s.key, s.val1, s.val2);
      if (s.delayMs > 0 && s.type != 4) delay(s.delayMs);
    }
  } else {
    runStep(a.type, a.mod, a.key, a.val1, a.val2);
  }
}

// dir = +1 next, -1 previous; folder pages are skipped.
void navigate(int dir) {
  if (totalPages <= 0) return;
  int nextP = currentPage;
  do {
    nextP = (nextP + dir + totalPages) % totalPages;
  } while (nextP < 16 && isFolderPage[nextP] && nextP != currentPage);
  currentPage = nextP;
  updateDisplays();
}
`;
}

export function protocolSection(): string {
  return String.raw`
// ============================ COMMAND PROTOCOL ============================
// Shared by HTTP POST /command and the Serial line protocol (115200).
void touchSync() {
  lastSyncActivity = millis();
}

void processCommand(String cmd, bool fromSerial) {
  cmd.trim();
  if (cmd.length() == 0) return;
  touchSync();

  if (cmd == "CLEAR") {
    isSyncing = true;
    // Delete one file at a time (removing while iterating skips entries).
    for (int guard = 0; guard < 256; guard++) {
      File root = LittleFS.open("/");
      File file = root.openNextFile();
      if (!file) { root.close(); break; }
      String fileName = String(file.name());
      file.close();
      root.close();
      if (!fileName.startsWith("/")) fileName = "/" + fileName;
      LittleFS.remove(fileName);
    }
    Serial.println("OK");
  } else if (cmd == "SAVE") {
    isSyncing = false;
    loadConfig();
    updateDisplays();
    Serial.println("OK");
  } else if (cmd.startsWith("ACT ") || cmd.startsWith("SEQ ") || cmd.startsWith("PAGES ") || cmd.startsWith("PCIP ") || cmd.startsWith("FOLDER ")) {
    File f = LittleFS.open("/config.txt", "a");
    if (f) { f.println(cmd); f.close(); }
    Serial.println("OK");
  } else if (cmd.startsWith("P ")) {
    File f = LittleFS.open("/pins.txt", "a");
    if (f) { f.println(cmd); f.close(); }
    Serial.println("OK");
  } else if (cmd.startsWith("BITMAP ")) {
    if (!fromSerial) { Serial.println("ERROR"); return; } // raw bytes only travel over Serial; use /upload for HTTP
    int space1 = cmd.indexOf(' ', 7);
    if (space1 < 0) { Serial.println("ERROR"); return; }
    int b = cmd.substring(7, space1).toInt();
    int p = cmd.substring(space1 + 1).toInt();
    Serial.println("READY");
    size_t got = Serial.readBytes(ioBuf, 1024);
    if (got == 1024 && b >= 0 && b < 6 && p >= 0 && p < 8) {
      char path[24];
      snprintf(path, sizeof(path), "/b_%d_%d.bin", b, p);
      File file = LittleFS.open(path, "w");
      if (file) {
        file.write(ioBuf, 1024);
        file.close();
        Serial.println("OK");
      } else {
        Serial.println("ERROR");
      }
    } else {
      Serial.println("ERROR");
    }
    touchSync();
  }
}

// Non-blocking line reader: accumulates characters until '\n'.
void pollSerial() {
  while (Serial.available() > 0) {
    int c = Serial.read();
    if (c < 0) break;
    if (c == '\n') {
      String line = serialLine;
      serialLine = "";
      line.trim();
      if (line.length() > 0) processCommand(line, true);
    } else if (c != '\r') {
      if (serialLine.length() < 200) serialLine += (char)c;
    }
  }
}

// If the host disappears mid-sync the deck would stay frozen forever: leave sync mode like SAVE does.
void serviceSyncWatchdog() {
  if (isSyncing && (millis() - lastSyncActivity) > SYNC_TIMEOUT_MS) {
    isSyncing = false;
    loadConfig();
    updateDisplays();
    Serial.println("SYNC_TIMEOUT");
  }
}
`;
}

export function networkSection(): string {
  return String.raw`
// ============================ PC PING (non-blocking) ============================
// Pings pc_ip every minute; no reply => screens off and keys ignored. Skipped when pc_ip is empty.
static void onPingSuccess(esp_ping_handle_t hdl, void* args) {
  pingGotReply = true;
}

static void onPingEnd(esp_ping_handle_t hdl, void* args) {
  pingState = PING_DONE;
}

void stopPing() {
  if (pingHandle != nullptr) {
    esp_ping_stop(pingHandle);
    esp_ping_delete_session(pingHandle);
    pingHandle = nullptr;
  }
  pingState = PING_IDLE;
}

void startPing() {
  IPAddress ip;
  if (!ip.fromString(pc_ip)) return;
  ip_addr_t target;
  IP_ADDR4(&target, ip[0], ip[1], ip[2], ip[3]);

  esp_ping_config_t pc = ESP_PING_DEFAULT_CONFIG();
  pc.target_addr = target;
  pc.count = 1;
  pc.timeout_ms = PING_TIMEOUT_MS;

  esp_ping_callbacks_t cbs;
  memset(&cbs, 0, sizeof(cbs));
  cbs.on_ping_success = onPingSuccess;
  cbs.on_ping_end = onPingEnd;

  pingGotReply = false;
  pingState = PING_RUNNING;
  pingStartedAt = millis();
  if (esp_ping_new_session(&pc, &cbs, &pingHandle) == ESP_OK) {
    esp_ping_start(pingHandle);
  } else {
    pingHandle = nullptr;
    pingState = PING_IDLE;
  }
}

void servicePing() {
  if (WiFi.status() != WL_CONNECTED || pc_ip.length() == 0) {
    stopPing();
    pingEverStarted = false;
    setDisplaysOn(true);
    return;
  }
  uint32_t now = millis();
  if (pingState == PING_RUNNING) {
    if (now - pingStartedAt > 5000) { // callbacks never came back: treat as offline
      stopPing();
      setDisplaysOn(false);
    }
  } else if (pingState == PING_DONE) {
    bool ok = pingGotReply;
    stopPing();
    setDisplaysOn(ok);
  } else if (!pingEverStarted || (now - lastPingAt) >= PING_INTERVAL_MS) {
    pingEverStarted = true;
    lastPingAt = now;
    startPing();
  }
}

// ============================ HTTP ============================
bool isValidUploadName(const String& name) {
  if (name == "config.json") return true;
  // b_[0-5]_[0-7].bin
  return name.length() == 9 && name[0] == 'b' && name[1] == '_' && name[2] >= '0' && name[2] <= '5' &&
         name[3] == '_' && name[4] >= '0' && name[4] <= '7' && name.endsWith(".bin");
}

void handleRoot() {
  String html = "<html><body><h1>Danjos Deck</h1><p>IP: " + WiFi.localIP().toString() + "</p><p>Firmware " FW_VERSION "</p></body></html>";
  server.send(200, "text/html", html);
}

void handleInfo() {
  String j = String("{\"name\":\"Danjos Deck\",\"fw\":\"") + FW_VERSION + "\",\"pages\":" + String(totalPages) +
             ",\"page\":" + String(currentPage) + ",\"ip\":\"" + WiFi.localIP().toString() +
             "\",\"screensOn\":" + (screensOn ? "true" : "false") + "}";
  server.send(200, "application/json", j);
}

void handleCommand() {
  if (!server.hasArg("plain") || server.arg("plain").length() == 0) {
    server.send(400, "text/plain", "EMPTY");
    return;
  }
  processCommand(server.arg("plain"), false);
  server.send(200, "text/plain", "OK");
}

// Upload data callback: only b_[0-5]_[0-7].bin (exactly 1024 bytes) and config.json are stored.
void handleUploadData() {
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    touchSync();
    uploadSeen = true;
    uploadOk = false;
    uploadSize = 0;
    uploadName = upload.filename;
    while (uploadName.startsWith("/")) uploadName.remove(0, 1);
    if (isValidUploadName(uploadName)) {
      uploadFile = LittleFS.open("/" + uploadName, "w");
      uploadOk = (bool)uploadFile;
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (uploadOk && uploadFile) {
      uploadSize += upload.currentSize;
      if (uploadName.endsWith(".bin") && uploadSize > 1024) {
        uploadOk = false; // too big for a bitmap
      } else {
        uploadFile.write(upload.buf, upload.currentSize);
      }
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (uploadFile) uploadFile.close();
    if (uploadOk && uploadName.endsWith(".bin") && uploadSize != 1024) uploadOk = false;
    if (!uploadOk && isValidUploadName(uploadName)) LittleFS.remove("/" + uploadName);
    touchSync();
    if (uploadOk && uploadName == "config.json") {
      loadConfig();
      updateDisplays();
    }
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    if (uploadFile) uploadFile.close();
    if (isValidUploadName(uploadName)) LittleFS.remove("/" + uploadName);
    uploadOk = false;
  }
}

void handleUploadDone() {
  bool ok = uploadSeen && uploadOk;
  uploadSeen = false;
  uploadOk = false;
  if (ok) server.send(200, "text/plain", "OK");
  else server.send(400, "text/plain", "BAD_UPLOAD");
}

void startNetworkServices() {
  if (!servicesStarted) {
    servicesStarted = true;
    server.enableCORS(true);
    server.on("/", HTTP_GET, handleRoot);
    server.on("/info", HTTP_GET, handleInfo);
    server.on("/command", HTTP_POST, handleCommand);
    server.on("/upload", HTTP_POST, handleUploadDone, handleUploadData);
    server.onNotFound([]() { server.send(404, "text/plain", "NOT_FOUND"); });
    server.begin();
    ArduinoOTA.setHostname(DECK_HOSTNAME);
    ArduinoOTA.begin();
  }
  MDNS.end();
  if (MDNS.begin(DECK_HOSTNAME)) MDNS.addService("http", "tcp", 80);
}

// Non-blocking Wi-Fi supervisor + server pump.
void serviceNetwork() {
  if (!wifiConfigured) return;
  uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      startNetworkServices();
      showSplash();
    }
    ArduinoOTA.handle();
    server.handleClient();
  } else {
    wifiWasConnected = false;
    if (now - lastWifiAttempt >= WIFI_RETRY_MS) {
      lastWifiAttempt = now;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
  if (splashUntil != 0 && (int32_t)(now - splashUntil) >= 0) {
    splashUntil = 0;
    updateDisplays();
  }
}
`;
}

export function inputSection(): string {
  return String.raw`
// ============================ INPUT (non-blocking) ============================
void setupPin(int pin) {
  if (pin >= 0) pinMode(pin, INPUT_PULLUP);
}

// Lock-out debounce: a change is accepted only DEBOUNCE_MS after the previous accepted change.
// Returns true on an accepted falling edge (press, active LOW).
bool debouncedPress(Debounce& d, int pin) {
  if (pin < 0) return false;
  bool level = digitalRead(pin);
  if (level == d.state) return false;
  uint32_t now = millis();
  if ((now - d.changedAt) < DEBOUNCE_MS) return false;
  d.state = level;
  d.changedAt = now;
  return level == LOW;
}

// Quadrature decoding. state = (CLK << 1) | DT. A clockwise detent walks 3 -> 1 -> 0 -> 2 -> 3
// (CLK rising edge while DT is low = CW, same convention as the legacy firmware).
static const int8_t ENC_TABLE[16] = {
   0, -1,  1,  0,
   1,  0,  0, -1,
  -1,  0,  0,  1,
   0,  1, -1,  0
};

uint8_t encoderReadState(int clkPin, int dtPin) {
  return (uint8_t)((digitalRead(clkPin) ? 2 : 0) | (digitalRead(dtPin) ? 1 : 0));
}

// Returns +1 (CW detent), -1 (CCW detent) or 0.
int encoderStep(Encoder& e, int clkPin, int dtPin) {
  if (clkPin < 0 || dtPin < 0) return 0;
  uint8_t s = encoderReadState(clkPin, dtPin);
  if (s == e.state) return 0;
  e.acc += ENC_TABLE[(e.state << 2) | s];
  e.state = s;
  if (e.acc >= ENC_STEPS_PER_DETENT) { e.acc = 0; return 1; }
  if (e.acc <= -ENC_STEPS_PER_DETENT) { e.acc = 0; return -1; }
  if (ENC_STEPS_PER_DETENT == 4 && s == 3) e.acc = 0; // back at rest without a full turn: drop the remainder
  return 0;
}

void pollInputs() {
  for (int i = 0; i < 6; i++) {
    if (debouncedPress(dbBtn[i], PIN_BTN[i])) executeAction(i, currentPage);
  }
  if (debouncedPress(dbPrev, PIN_PREV)) navigate(-1);
  if (debouncedPress(dbNext, PIN_NEXT)) navigate(1);

  int r1 = encoderStep(enc1, PIN_ENC1_CLK, PIN_ENC1_DT);
  if (r1 > 0) executeAction(6, 0);
  else if (r1 < 0) executeAction(7, 0);
  if (debouncedPress(dbEnc1Sw, PIN_ENC1_BTN)) executeAction(8, 0);

  int r2 = encoderStep(enc2, PIN_ENC2_CLK, PIN_ENC2_DT);
  if (r2 > 0) executeAction(9, 0);
  else if (r2 < 0) executeAction(10, 0);
  if (debouncedPress(dbEnc2Sw, PIN_ENC2_BTN)) executeAction(11, 0);
}
`;
}

export function mainSection(): string {
  return String.raw`
// ============================ SETUP / LOOP ============================
void setup() {
  Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(10); // never stall replies when no serial monitor is attached
#endif
  Serial.setTimeout(2000);   // raw BITMAP payload timeout

  if (!LittleFS.begin(true)) Serial.println("FS Error");
  loadPins();

  Wire.begin(PIN_SDA, PIN_SCL);
  for (int i = 0; i < 6; i++) setupPin(PIN_BTN[i]);
  setupPin(PIN_PREV);
  setupPin(PIN_NEXT);
  setupPin(PIN_ENC1_CLK);
  setupPin(PIN_ENC1_DT);
  setupPin(PIN_ENC1_BTN);
  setupPin(PIN_ENC2_CLK);
  setupPin(PIN_ENC2_DT);
  setupPin(PIN_ENC2_BTN);

  for (int i = 0; i < 6; i++) {
    dbBtn[i].state = HIGH;
    dbBtn[i].changedAt = 0;
  }
  dbPrev = { HIGH, 0 };
  dbNext = { HIGH, 0 };
  dbEnc1Sw = { HIGH, 0 };
  dbEnc2Sw = { HIGH, 0 };
  enc1.state = (PIN_ENC1_CLK >= 0 && PIN_ENC1_DT >= 0) ? encoderReadState(PIN_ENC1_CLK, PIN_ENC1_DT) : 3;
  enc1.acc = 0;
  enc2.state = (PIN_ENC2_CLK >= 0 && PIN_ENC2_DT >= 0) ? encoderReadState(PIN_ENC2_CLK, PIN_ENC2_DT) : 3;
  enc2.acc = 0;

  for (int i = 0; i < 6; i++) {
    tcaselect(muxChannels[i]);
    if (display.begin(SSD1306_SWITCHCAPVCC, oledAddress, true, false)) {
      display.clearDisplay();
      display.display();
    }
  }

  Keyboard.begin();
  Consumer.begin();
  Mouse.begin();
  USB.begin();

  loadConfig();
  updateDisplays();

  wifiConfigured = (WIFI_SSID[0] != 0);
  if (wifiConfigured) {
    WiFi.mode(WIFI_STA);
    WiFi.setHostname(DECK_HOSTNAME);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    lastWifiAttempt = millis();
  }
}

void loop() {
  serviceNetwork();   // Wi-Fi supervisor, OTA, HTTP
  pollSerial();       // Serial line protocol
  serviceSyncWatchdog();
  servicePing();
  if (isSyncing) return; // input ignored while the host is syncing
  pollInputs();
}
`;
}
