import { describe, expect, it } from 'vitest';
import { bitmapToBase64, emptyBitmap } from './bitmap/pack';
import { exportConfigJson, importConfigJson, migrateLegacyConfig, normalizeConfig } from './configIO';
import { createDefaultConfig, createPage } from './defaults';
import { KEY_CATALOG, browserKeyToKeyName } from './constants';
import { buildCommandPlan } from './protocol/encode';

describe('config import/export', () => {
  it('roundtrips a config', () => {
    const cfg = createDefaultConfig();
    cfg.pages[0].keys[0].bitmap = bitmapToBase64(emptyBitmap());
    cfg.network.deviceIp = '192.168.1.50';
    cfg.pages.push(createPage('Pasta', { isFolder: true, parentId: cfg.pages[0].id }));
    cfg.pages[0].keys[3].action = { type: 'folder', targetPageId: cfg.pages[1].id };
    const back = importConfigJson(exportConfigJson(cfg));
    expect(back).toEqual(cfg);
  });

  it('can blank secrets on export', () => {
    const cfg = createDefaultConfig();
    cfg.network.wifiPassword = 'secret';
    expect(JSON.parse(exportConfigJson(cfg, { includeSecrets: false })).network.wifiPassword).toBe('');
  });

  it('throws pt-BR errors on garbage', () => {
    expect(() => importConfigJson('{nope')).toThrow(/JSON/);
    expect(() => importConfigJson('[]')).toThrow(/Arquivo inválido/);
    expect(() => importConfigJson('{"version":2,"pages":[]}')).toThrow(/sem páginas/);
    expect(() => importConfigJson('{"foo":1}')).toThrow(/Arquivo inválido/);
  });

  it('repairs invalid content', () => {
    const cfg = createDefaultConfig();
    const raw = JSON.parse(exportConfigJson(cfg));
    raw.pages[0].keys = raw.pages[0].keys.slice(0, 2);
    raw.pages[0].keys[0].action = { type: 'folder', targetPageId: 'ghost' };
    raw.pages[0].keys[1].bitmap = 'AAAA';
    raw.encoders[0].cw = { type: 'back' };
    raw.hardware.pins.btn0 = 'x';
    const fixed = normalizeConfig(raw);
    expect(fixed.pages[0].keys).toHaveLength(6);
    expect(fixed.pages[0].keys[0].action).toEqual({ type: 'none' });
    expect(fixed.pages[0].keys[1].bitmap).toBe('');
    expect(fixed.encoders[0].cw).toEqual({ type: 'none' });
    expect(fixed.hardware.pins.btn0).toBe(1);
  });

  it('caps pages at 8', () => {
    const cfg = createDefaultConfig();
    for (let i = 0; i < 10; i++) cfg.pages.push(createPage(`P${i}`));
    expect(normalizeConfig(cfg).pages).toHaveLength(8);
  });

  it('default config produces a valid plan', () => {
    const plan = buildCommandPlan(createDefaultConfig());
    expect(plan[0]).toMatchObject({ kind: 'command', line: 'CLEAR' });
  });
});

describe('legacy migration', () => {
  it('maps the legacy shape', () => {
    const bm = bitmapToBase64(emptyBitmap());
    const legacy = {
      pages: [
        {
          id: 'p0',
          name: 'Page 1',
          buttons: [
            { label: 'Cor', bitmap: bm, iconName: 'palette', iconLayout: 'icon-text-below', action: { type: 'keyboard', keyboard: { key: 'c', modifiers: { leftGui: true, leftShift: true } } } },
            { label: 'x', bitmap: [], action: { type: 'sequence', sequence: [{ type: 'delay', delayMs: 50 }] } },
          ],
        },
        { id: 'p1', name: 'Pasta', isFolder: true, parentId: 'p0', buttons: [{ label: 'v', bitmap: [], action: { type: 'back' } }] },
      ],
      encoder1: { cwAction: { type: 'consumer', consumer: 'VOLUME_INCREMENT' }, ccwAction: { type: 'none' }, btnAction: { type: 'consumer', consumer: 'PLAY_PAUSE' } },
      encoder2: { cwAction: { type: 'none' }, ccwAction: { type: 'none' }, btnAction: { type: 'none' } },
      pins: { btn1: 1, btn2: 2, btn3: 3, btn4: 4, btn5: 5, btn6: 6, btnPrev: 7, btnNext: 15, enc1Clk: 16, enc1Dt: 17, enc1Btn: 18, enc2Clk: 20, enc2Dt: 21, enc2Btn: 41, sda: 8, scl: 9 },
      pcIp: '10.0.0.2',
    };
    const cfg = migrateLegacyConfig(legacy);
    expect(cfg.pages).toHaveLength(2);
    expect(cfg.pages[0].keys[0].action).toEqual({ type: 'keyboard', key: 'c', modifiers: 10 });
    expect(cfg.pages[0].keys[0].appearance.icon.name).toBe('palette');
    expect(cfg.pages[0].keys[0].bitmap).toBe(bm);
    expect(cfg.pages[0].keys[1].action.type).toBe('macro');
    expect(cfg.pages[1]).toMatchObject({ isFolder: true, parentId: 'p0' });
    expect(cfg.pages[1].keys[0].action).toEqual({ type: 'back' });
    expect(cfg.encoders[0].cw).toEqual({ type: 'consumer', code: 'VOLUME_INCREMENT' });
    expect(cfg.hardware.pins.enc2Clk).toBe(-1);
    expect(cfg.hardware.pins.enc1Sw).toBe(18);
    expect(cfg.network.pcIp).toBe('10.0.0.2');
    expect(importConfigJson(JSON.stringify(legacy)).pages).toHaveLength(2);
  });
});

describe('key helpers', () => {
  it('catalog names are unique', () => {
    const names = KEY_CATALOG.map((k) => k.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('browserKeyToKeyName maps events', () => {
    expect(browserKeyToKeyName({ code: 'KeyA', key: 'A' })).toBe('a');
    expect(browserKeyToKeyName({ code: 'Digit5', key: '%' })).toBe('5');
    expect(browserKeyToKeyName({ code: 'F13', key: 'F13' })).toBe('KEY_F13');
    expect(browserKeyToKeyName({ code: 'ArrowUp', key: 'ArrowUp' })).toBe('KEY_UP_ARROW');
    expect(browserKeyToKeyName({ code: 'ControlRight', key: 'Control' })).toBe('KEY_RIGHT_CTRL');
    expect(browserKeyToKeyName({ code: 'Space', key: ' ' })).toBe(' ');
    expect(browserKeyToKeyName({ code: 'Slash', key: '/' })).toBe('/');
    expect(browserKeyToKeyName({ code: 'LaunchApp1', key: 'LaunchApp1' })).toBeNull();
  });
});
