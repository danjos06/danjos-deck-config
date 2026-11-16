import { describe, expect, it } from 'vitest';
import { bitmapToBase64 } from '../bitmap/pack';
import { createDefaultConfig } from '../defaults';
import type { DeckConfig } from '../types';
import { escapeCString, FIRMWARE_FILENAME, generateFirmware } from './generate';

/** Counts `{` and `}` outside string/char literals and comments; returns [open, close]. */
function countBraces(src: string): [number, number] {
  let open = 0;
  let close = 0;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
    } else {
      if (c === '{') open++;
      else if (c === '}') close++;
      i++;
    }
  }
  return [open, close];
}

function bitmap(seed: number): string {
  const b = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) b[i] = (i * 7 + seed) & 0xff;
  return bitmapToBase64(b);
}

function sampleConfig(): DeckConfig {
  const cfg = createDefaultConfig();
  cfg.name = 'Deck */ "x"';
  cfg.network.wifiSsid = 'My "Wi\\Fi"';
  cfg.network.wifiPassword = 'pa$$\\"w?';
  cfg.network.pcIp = '192.168.1.5';
  cfg.hardware.pins.btn3 = -1;
  cfg.hardware.pins.enc1Clk = -1;
  cfg.hardware.muxChannels = [5, 4, 3, 2, 1, 0];
  cfg.hardware.muxAddress = 0x71;
  cfg.hardware.oledAddress = 0x3d;
  const p0 = cfg.pages[0];
  p0.keys[0].bitmap = bitmap(1);
  p0.keys[2].bitmap = bitmap(2);
  p0.keys[1].action = { type: 'text', text: 'say "hi"\\path\nline2\t' };
  p0.keys[3].action = { type: 'cpp', code: '  Serial.println("{ not a brace");\n  digitalWrite(2, HIGH);' };
  p0.keys[4].action = {
    type: 'macro',
    steps: [
      { id: 'a', type: 'keyboard', key: 'a', modifiers: 1, delayMs: 5 },
      { id: 'b', type: 'delay', delayMs: 100 },
    ],
  };
  cfg.encoders[1].cw = { type: 'text', text: 'enc' };
  return cfg;
}

const FIXED = new Date('2026-01-02T03:04:05.000Z');

describe('escapeCString', () => {
  it('escapes quotes, backslashes and control characters', () => {
    expect(escapeCString('a"b\\c\nd\re\tf')).toBe('a\\"b\\\\c\\nd\\re\\tf');
  });
  it('strips non-ASCII by default and keeps UTF-8 bytes on request', () => {
    expect(escapeCString('a\u00e9')).toBe('a');
    expect(escapeCString('\u00e9', { keepUtf8: true })).toBe('\\303\\251');
  });
  it('splits trigraphs', () => {
    expect(escapeCString('??=')).toBe('?\\?=');
  });
});

describe('generateFirmware', () => {
  const cfg = sampleConfig();
  const out = generateFirmware(cfg, { now: FIXED });

  it('exports the filename', () => {
    expect(FIRMWARE_FILENAME).toBe('danjos_deck_firmware.ino');
  });

  it('has a header with date, name and a sanitized comment', () => {
    expect(out).toContain('2026-01-02T03:04:05.000Z');
    expect(out).toContain('Deck * / "x"');
    expect(out).toContain('USB-OTG (TinyUSB)');
  });

  it('handles every pin id 0..23', () => {
    for (let i = 0; i <= 23; i++) expect(out).toContain(`case ${i}:`);
  });

  it('keeps all legacy commands, routes and the new ones', () => {
    for (const s of [
      '"CLEAR"', '"SAVE"', '"ACT "', '"SEQ "', '"PAGES "', '"PCIP "', '"FOLDER "', '"P "', '"BITMAP "',
      '"READY"', '"ERROR"', 'Danjos Deck', '"/command"', '"/upload"', '"/info"', '"/"',
      'server.enableCORS(true)', "readStringUntil('\\n')", '"/config.txt"', '"/pins.txt"', 'LittleFS.begin(true)',
      '"EMPTY"', 'screensOn', 'SYNC_TIMEOUT_MS', 'ENC_STEPS_PER_DETENT', 'DEBOUNCE_MS',
    ]) {
      expect(out, s).toContain(s);
    }
    expect(out).toContain('\\"fw\\"');
    expect(out).toContain('\\"screensOn\\"');
    expect(out).toContain("'\\n'");
  });

  it('bakes pins (-1 for disabled), addresses and mux channels', () => {
    expect(out).toContain('int PIN_BTN[6] = { 1, 2, 3, -1, 5, 6 };');
    expect(out).toContain('int PIN_ENC1_CLK = -1;');
    expect(out).toContain('int PIN_ENC2_CLK = -1;');
    expect(out).toContain('uint8_t muxAddress = 0x71;');
    expect(out).toContain('uint8_t oledAddress = 0x3D;');
    expect(out).toContain('uint8_t muxChannels[6] = { 5, 4, 3, 2, 1, 0 };');
    expect(out).toContain('tcaselect(muxChannels[i])');
  });

  it('escapes Wi-Fi credentials', () => {
    expect(out).toContain('WIFI_SSID[] = "My \\"Wi\\\\Fi\\"";');
    expect(out).toContain('WIFI_PASSWORD[] = "pa$$\\\\\\"w?";');
    expect(out).toContain('PC_IP_DEFAULT[] = "192.168.1.5";');
  });

  it('emits PROGMEM arrays only for keys with bitmaps, 1024 bytes each, plus the table', () => {
    const arrays = [...out.matchAll(/const uint8_t (DEF_BMP_\d+_\d+)\[1024\] PROGMEM = \{([\s\S]*?)\n\};/g)];
    expect(arrays.map((m) => m[1])).toEqual(['DEF_BMP_0_0', 'DEF_BMP_2_0']);
    for (const m of arrays) expect((m[2].match(/0x[0-9A-F]{2}/g) ?? []).length).toBe(1024);
    expect(out).toContain('const uint8_t* const DEFAULT_BITMAPS[8][6] PROGMEM = {');
    expect(out).toContain('{ DEF_BMP_0_0, nullptr, DEF_BMP_2_0, nullptr, nullptr, nullptr }');
    expect(out).toContain('display.drawBitmap(0, 0, def, 128, 64, SSD1306_WHITE)');
  });

  it('embeds text actions fully escaped and cpp verbatim', () => {
    expect(out).toContain('Keyboard.print("say \\"hi\\"\\\\path\\nline2\\t");');
    expect(out).toContain('if (b == 1 && p == 0) {');
    expect(out).toContain('  Serial.println("{ not a brace");\n  digitalWrite(2, HIGH);');
    expect(out).toContain('if (b == 3 && p == 0) {');
    expect(out).toContain('if (b == 9 && p == 0) {\n  Keyboard.print("enc");');
  });

  it('compiles default actions and macros', () => {
    expect(out).toContain('setAct(6, 0, 2, 0, 233, 0, 0);'); // enc1 CW = VOLUME_INCREMENT 0xE9
    expect(out).toContain('setStep(4, 0, 0, 1, 1, 97, 0, 0, 5);');
    expect(out).toContain('setStep(4, 0, 1, 4, 0, 0, 0, 0, 100);');
    expect(out).toContain('setAct(4, 0, 4, 0, 0, 0, 0);');
    expect(out).toContain('totalPages = 1;');
  });

  it('has balanced braces outside strings/comments', () => {
    const [open, close] = countBraces(out);
    expect(open).toBeGreaterThan(50);
    expect(open).toBe(close);
  });

  it('has no template leftovers, undefined or NaN', () => {
    expect(out).not.toContain('${');
    expect(out).not.toMatch(/undefined|NaN/);
  });

  it('is deterministic for a fixed timestamp; defaults produce no arrays', () => {
    expect(generateFirmware(cfg, { now: FIXED })).toBe(out);
    const plain = generateFirmware(createDefaultConfig(), { now: FIXED });
    expect(plain).not.toContain('DEF_BMP_');
    expect(plain).toContain('(no text / C++ actions)');
    expect(plain).toContain('WIFI_SSID[] = "";');
  });

  it('forward-declares the main functions', () => {
    for (const proto of [
      'void updateDisplays();',
      'void executeAction(int b, int p);',
      'void processCommand(String cmd, bool fromSerial);',
      'void loadConfig();',
      'void pollInputs();',
      'void serviceNetwork();',
    ]) {
      expect(out).toContain(`\n${proto}\n`);
    }
  });
});
