import { CONSUMER_MAP, KEY_MAP, MAX_MACRO_STEPS, MAX_PAGES, MODIFIER_KEYS, PIN_IDS } from '../constants';
import { BITMAP_BYTES, tryBase64ToBitmap } from '../bitmap/pack';
import type { Action, DeckConfig, KeyName, MacroStep, MouseAction, Page } from '../types';

export type SyncStep =
  | { kind: 'command'; line: string; label: string }
  | { kind: 'bitmap'; button: number; page: number; data: Uint8Array; label: string };

type ActRow = [number, number, number, number, number];
type SeqRow = [number, number, number, number, number, number];

const toInt = (v: number): number => (Number.isFinite(v) ? Math.trunc(v) : 0);
const clampInt = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, toInt(v)));

/** Numeric HID/Arduino code of a key name: KEY_MAP entry, or ASCII code of a single printable char; 0 otherwise. */
export function keyNameToCode(k: KeyName): number {
  if (Object.prototype.hasOwnProperty.call(KEY_MAP, k)) return KEY_MAP[k];
  if (k.length === 1) {
    const c = k.charCodeAt(0);
    if (c >= 32 && c <= 126) return c;
  }
  return 0;
}

function encodeKeyboard(key: KeyName, modifiers: number): { mod: number; code: number } {
  let mod = clampInt(modifiers, 0, 255);
  if (Object.prototype.hasOwnProperty.call(MODIFIER_KEYS, key)) {
    return { mod: mod | MODIFIER_KEYS[key], code: 0 };
  }
  return { mod, code: keyNameToCode(key) };
}

function encodeMouse(m: MouseAction): { key: number; v1: number; v2: number } {
  switch (m.kind) {
    case 'left':
      return { key: 1, v1: 0, v2: 0 };
    case 'right':
      return { key: 2, v1: 0, v2: 0 };
    case 'middle':
      return { key: 3, v1: 0, v2: 0 };
    case 'move':
      return { key: 4, v1: clampInt(m.x, -127, 127), v2: clampInt(m.y, -127, 127) };
    case 'scroll':
      return { key: 5, v1: clampInt(m.amount, -127, 127), v2: 0 };
  }
}

function encodeStep(s: MacroStep): SeqRow {
  const delay = clampInt(s.delayMs, 0, 65535);
  switch (s.type) {
    case 'keyboard': {
      const { mod, code } = encodeKeyboard(s.key, s.modifiers);
      return [1, mod, code, 0, 0, delay];
    }
    case 'consumer':
      return [2, 0, CONSUMER_MAP[s.code] ?? 0, 0, 0, delay];
    case 'mouse': {
      const m = encodeMouse(s.mouse);
      return [3, 0, m.key, m.v1, m.v2, delay];
    }
    case 'delay':
      return [4, 0, 0, 0, 0, delay];
  }
}

/**
 * Encodes an action into the wire representation `[type, mod, key, v1, v2]` plus macro rows
 * `[type, mod, key, v1, v2, delayMs]`. text/cpp encode as type 0 (compiled into firmware);
 * modifier-only keys become the modifier bitmask with key 0; `back` carries the parent page index;
 * a macro is truncated to 10 steps; ints are clamped to the firmware ranges.
 */
export function encodeAction(
  a: Action,
  ctx: { pages: Page[]; currentPageIndex: number },
): { act: ActRow; seq: number[][] } {
  const none: ActRow = [0, 0, 0, 0, 0];
  switch (a.type) {
    case 'none':
    case 'text':
    case 'cpp':
      return { act: none, seq: [] };
    case 'keyboard': {
      const { mod, code } = encodeKeyboard(a.key, a.modifiers);
      return { act: [1, mod, code, 0, 0], seq: [] };
    }
    case 'consumer':
      return { act: [2, 0, CONSUMER_MAP[a.code] ?? 0, 0, 0], seq: [] };
    case 'mouse': {
      const m = encodeMouse(a.mouse);
      return { act: [3, 0, m.key, m.v1, m.v2], seq: [] };
    }
    case 'macro': {
      const seq = a.steps.slice(0, MAX_MACRO_STEPS).map((s) => encodeStep(s) as number[]);
      return { act: seq.length ? [4, 0, 0, 0, 0] : none, seq };
    }
    case 'folder': {
      const idx = ctx.pages.findIndex((p) => p.id === a.targetPageId);
      return { act: idx >= 0 ? [5, 0, idx, 0, 0] : none, seq: [] };
    }
    case 'back': {
      const cur = ctx.pages[ctx.currentPageIndex];
      const parent = cur?.parentId ? ctx.pages.findIndex((p) => p.id === cur.parentId) : 0;
      return { act: [6, 0, Math.max(0, parent), 0, 0], seq: [] };
    }
  }
}

/**
 * Builds the ordered sync plan (CONTRACT §6.3 with legacy bugs fixed):
 * CLEAR, PAGES, FOLDER*, P* (one per line, ids 0..15 + extension 16..23), PCIP (only if non-empty),
 * per page/key: SEQ rows, ACT, bitmap; encoder slots 6..11 on page 0; SAVE.
 */
export function buildCommandPlan(cfg: DeckConfig): SyncStep[] {
  const steps: SyncStep[] = [];
  const cmd = (line: string, label: string) => steps.push({ kind: 'command', line, label });
  const pages = cfg.pages.slice(0, MAX_PAGES);

  cmd('CLEAR', 'Limpando o dispositivo');
  cmd(`PAGES ${pages.length}`, `Definindo ${pages.length} página(s)`);
  pages.forEach((p, i) => {
    if (p.isFolder) cmd(`FOLDER ${i} 1`, `Marcando "${p.name}" como pasta`);
  });

  const hw = cfg.hardware;
  PIN_IDS.forEach((id, i) => cmd(`P ${i} ${toInt(hw.pins[id])}`, `Pino ${id} (GPIO ${toInt(hw.pins[id])})`));
  cmd(`P 16 ${toInt(hw.muxAddress)}`, 'Endereço do multiplexador');
  cmd(`P 17 ${toInt(hw.oledAddress)}`, 'Endereço dos OLEDs');
  for (let i = 0; i < 6; i++) {
    cmd(`P ${18 + i} ${toInt(hw.muxChannels[i] ?? i)}`, `Canal do multiplexador da tela ${i + 1}`);
  }

  const pcIp = cfg.network.pcIp.trim();
  if (pcIp) cmd(`PCIP ${pcIp}`, 'IP do PC (desligar telas offline)');

  const slot = (b: number, p: number, action: Action, pageIndex: number, name: string) => {
    const { act, seq } = encodeAction(action, { pages, currentPageIndex: pageIndex });
    seq.forEach((row, s) => cmd(`SEQ ${b} ${p} ${s} ${row.join(' ')}`, `${name}: passo ${s + 1} da macro`));
    cmd(`ACT ${b} ${p} ${act.join(' ')}`, `${name}: ação`);
  };

  pages.forEach((page, p) => {
    page.keys.slice(0, 6).forEach((key, b) => {
      slot(b, p, key.action, p, `${page.name} / tecla ${b + 1}`);
      const data = tryBase64ToBitmap(key.bitmap);
      if (data && data.length === BITMAP_BYTES) {
        steps.push({ kind: 'bitmap', button: b, page: p, data, label: `${page.name} / tecla ${b + 1}: imagem` });
      }
    });
  });

  const encNames = ['Encoder 1 horário', 'Encoder 1 anti-horário', 'Encoder 1 botão', 'Encoder 2 horário', 'Encoder 2 anti-horário', 'Encoder 2 botão'];
  cfg.encoders.forEach((enc, e) => {
    (['cw', 'ccw', 'sw'] as const).forEach((fn, f) => {
      const raw = enc[fn];
      const action: Action = raw.type === 'folder' || raw.type === 'back' ? { type: 'none' } : raw;
      slot(6 + e * 3 + f, 0, action, 0, encNames[e * 3 + f]);
    });
  });

  cmd('SAVE', 'Salvando no dispositivo');
  return steps;
}
