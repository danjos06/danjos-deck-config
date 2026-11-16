import { describe, expect, it } from 'vitest';
import { bitmapToBase64, emptyBitmap } from '../bitmap/pack';
import { createDefaultConfig, createPage } from '../defaults';
import type { Action, DeckConfig, MacroStep } from '../types';
import { buildCommandPlan, encodeAction, keyNameToCode } from './encode';

const ctx = () => {
  const pages = [createPage('A'), createPage('B', { isFolder: true })];
  pages[1].parentId = pages[0].id;
  return { pages, currentPageIndex: 1 };
};

describe('keyNameToCode', () => {
  it('maps named keys, ASCII chars and unknowns', () => {
    expect(keyNameToCode('KEY_RETURN')).toBe(0xb0);
    expect(keyNameToCode('a')).toBe(97);
    expect(keyNameToCode(' ')).toBe(32);
    expect(keyNameToCode('')).toBe(0);
    expect(keyNameToCode('KEY_NOPE')).toBe(0);
    expect(keyNameToCode('toString')).toBe(0);
  });
});

describe('encodeAction', () => {
  const c = ctx();
  const enc = (a: Action) => encodeAction(a, c);

  it('none/text/cpp are type 0', () => {
    for (const a of [{ type: 'none' }, { type: 'text', text: 'hi' }, { type: 'cpp', code: 'x();' }] as Action[]) {
      expect(enc(a)).toEqual({ act: [0, 0, 0, 0, 0], seq: [] });
    }
  });

  it('keyboard with modifiers', () => {
    expect(enc({ type: 'keyboard', key: 'c', modifiers: 8 | 2 }).act).toEqual([1, 10, 99, 0, 0]);
  });

  it('modifier-only key becomes the modifier bitmask with key 0', () => {
    expect(enc({ type: 'keyboard', key: 'KEY_RIGHT_CTRL', modifiers: 0 }).act).toEqual([1, 16, 0, 0, 0]);
    expect(enc({ type: 'keyboard', key: 'KEY_LEFT_GUI', modifiers: 2 }).act).toEqual([1, 10, 0, 0, 0]);
    expect(enc({ type: 'keyboard', key: '', modifiers: 5 }).act).toEqual([1, 5, 0, 0, 0]);
  });

  it('consumer', () => {
    expect(enc({ type: 'consumer', code: 'PLAY_PAUSE' }).act).toEqual([2, 0, 0xcd, 0, 0]);
  });

  it('mouse variants with clamping', () => {
    expect(enc({ type: 'mouse', mouse: { kind: 'left' } }).act).toEqual([3, 0, 1, 0, 0]);
    expect(enc({ type: 'mouse', mouse: { kind: 'right' } }).act).toEqual([3, 0, 2, 0, 0]);
    expect(enc({ type: 'mouse', mouse: { kind: 'middle' } }).act).toEqual([3, 0, 3, 0, 0]);
    expect(enc({ type: 'mouse', mouse: { kind: 'move', x: 500, y: -500 } }).act).toEqual([3, 0, 4, 127, -127]);
    expect(enc({ type: 'mouse', mouse: { kind: 'move', x: NaN, y: 3.9 } }).act).toEqual([3, 0, 4, 0, 3]);
    expect(enc({ type: 'mouse', mouse: { kind: 'scroll', amount: -5 } }).act).toEqual([3, 0, 5, -5, 0]);
  });

  it('macro emits SEQ rows (all step types) and caps at 10 steps', () => {
    const steps: MacroStep[] = [
      { id: '1', type: 'keyboard', key: 'a', modifiers: 1, delayMs: 20 },
      { id: '2', type: 'consumer', code: 'MUTE', delayMs: 0 },
      { id: '3', type: 'mouse', mouse: { kind: 'move', x: 1, y: 2 }, delayMs: 5 },
      { id: '4', type: 'delay', delayMs: 100000 },
    ];
    const r = enc({ type: 'macro', steps });
    expect(r.act).toEqual([4, 0, 0, 0, 0]);
    expect(r.seq).toEqual([
      [1, 1, 97, 0, 0, 20],
      [2, 0, 0xe2, 0, 0, 0],
      [3, 0, 4, 1, 2, 5],
      [4, 0, 0, 0, 0, 65535],
    ]);
    const many = Array.from({ length: 14 }, (_, i): MacroStep => ({ id: String(i), type: 'delay', delayMs: 1 }));
    expect(enc({ type: 'macro', steps: many }).seq).toHaveLength(10);
    expect(enc({ type: 'macro', steps: [] })).toEqual({ act: [0, 0, 0, 0, 0], seq: [] });
  });

  it('folder uses target page index; unknown target is none', () => {
    expect(enc({ type: 'folder', targetPageId: c.pages[1].id }).act).toEqual([5, 0, 1, 0, 0]);
    expect(enc({ type: 'folder', targetPageId: 'zzz' }).act).toEqual([0, 0, 0, 0, 0]);
  });

  it('back encodes the parent page index', () => {
    expect(enc({ type: 'back' }).act).toEqual([6, 0, 0, 0, 0]);
    const pages = [createPage('R'), createPage('F1', { isFolder: true }), createPage('F2', { isFolder: true })];
    pages[1].parentId = pages[0].id;
    pages[2].parentId = pages[1].id;
    expect(encodeAction({ type: 'back' }, { pages, currentPageIndex: 2 }).act).toEqual([6, 0, 1, 0, 0]);
  });
});

function plannedConfig(): DeckConfig {
  const cfg = createDefaultConfig();
  const folder = createPage('Pasta', { isFolder: true, parentId: cfg.pages[0].id });
  cfg.pages.push(folder);
  cfg.pages[0].keys[0].action = { type: 'macro', steps: [{ id: 's', type: 'delay', delayMs: 10 }] };
  cfg.pages[0].keys[1].action = { type: 'folder', targetPageId: folder.id };
  cfg.pages[0].keys[0].bitmap = bitmapToBase64(emptyBitmap());
  cfg.pages[0].keys[2].bitmap = '';
  folder.keys[0].action = { type: 'back' };
  return cfg;
}

describe('buildCommandPlan', () => {
  const cfg = plannedConfig();
  const plan = buildCommandPlan(cfg);
  const lines = plan.map((s) => (s.kind === 'command' ? s.line : `BITMAP ${s.button} ${s.page}`));

  it('has the documented order', () => {
    expect(lines[0]).toBe('CLEAR');
    expect(lines[1]).toBe('PAGES 2');
    expect(lines[2]).toBe('FOLDER 1 1');
    expect(lines[lines.length - 1]).toBe('SAVE');
    const firstPin = lines.findIndex((l) => l.startsWith('P '));
    const firstAct = lines.findIndex((l) => l.startsWith('ACT '));
    const firstSeq = lines.findIndex((l) => l.startsWith('SEQ '));
    expect(firstPin).toBeLessThan(firstAct);
    expect(firstSeq).toBeLessThan(firstAct);
    expect(lines.findIndex((l) => l.startsWith('PCIP'))).toBe(-1);
  });

  it('sends pins one per line (ids 0..23)', () => {
    const pins = lines.filter((l) => l.startsWith('P '));
    expect(pins).toHaveLength(24);
    pins.forEach((l, i) => {
      expect(l.split(' ')).toHaveLength(3);
      expect(l.startsWith(`P ${i} `)).toBe(true);
    });
    expect(pins[0]).toBe('P 0 1');
    expect(pins[11]).toBe('P 11 -1');
    expect(pins[14]).toBe('P 14 8');
    expect(pins[15]).toBe('P 15 9');
    expect(pins[16]).toBe('P 16 112');
    expect(pins[17]).toBe('P 17 60');
    expect(pins[18]).toBe('P 18 0');
    expect(pins[23]).toBe('P 23 5');
  });

  it('does not send PCIP when empty, sends it when set', () => {
    const c2 = plannedConfig();
    c2.network.pcIp = ' 192.168.0.5 ';
    const l2 = buildCommandPlan(c2).map((s) => (s.kind === 'command' ? s.line : ''));
    expect(l2).toContain('PCIP 192.168.0.5');
    expect(l2.indexOf('PCIP 192.168.0.5')).toBeLessThan(l2.findIndex((l) => l.startsWith('ACT ')));
  });

  it('emits SEQ before ACT, then the bitmap, per key; skips empty bitmaps', () => {
    const seq = lines.indexOf('SEQ 0 0 0 4 0 0 0 0 10');
    const act = lines.indexOf('ACT 0 0 4 0 0 0 0');
    const bmp = lines.indexOf('BITMAP 0 0');
    expect(seq).toBeGreaterThan(-1);
    expect(act).toBe(seq + 1);
    expect(bmp).toBe(act + 1);
    expect(lines).not.toContain('BITMAP 2 0');
    const step = plan.find((s) => s.kind === 'bitmap');
    expect(step && step.kind === 'bitmap' && step.data.length).toBe(1024);
  });

  it('encodes folder/back actions and encoder slots 6..11 on page 0', () => {
    expect(lines).toContain('ACT 1 0 5 0 1 0 0');
    expect(lines).toContain('ACT 0 1 6 0 0 0 0');
    const encActs = lines.filter((l) => /^ACT (6|7|8|9|10|11) 0 /.test(l));
    expect(encActs).toHaveLength(6);
    expect(encActs[0]).toBe('ACT 6 0 2 0 233 0 0'); // enc1 cw = VOLUME_INCREMENT 0xE9
    expect(lines.indexOf(encActs[0])).toBeGreaterThan(lines.indexOf('ACT 5 1 0 0 0 0 0'));
  });

  it('every page/key gets an ACT line', () => {
    expect(lines.filter((l) => /^ACT [0-5] [01] /.test(l))).toHaveLength(12);
  });
});
