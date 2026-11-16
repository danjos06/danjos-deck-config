import { tryBase64ToBitmap, bitmapToBase64 } from './bitmap/pack';
import { CONSUMER_MAP, KEYS_PER_PAGE, MAX_MACRO_STEPS, MAX_PAGES, PIN_IDS } from './constants';
import {
  createDefaultAppearance,
  createDefaultConfig,
  createDefaultHardware,
  createDefaultNetwork,
  createEmptyKey,
  newId,
} from './defaults';
import type {
  Action,
  ConsumerName,
  DeckConfig,
  DitherMode,
  EncoderConfig,
  FitMode,
  IconLayout,
  ImageSource,
  KeyAppearance,
  KeyConfig,
  MacroStep,
  MouseAction,
  Page,
  PinId,
} from './types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T =>
  typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : d;

const isConsumer = (v: unknown): v is ConsumerName =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CONSUMER_MAP, v);

function sanitizeMouse(v: unknown): MouseAction | null {
  if (!isRec(v)) return null;
  switch (v.kind) {
    case 'left':
    case 'right':
    case 'middle':
      return { kind: v.kind };
    case 'move':
      return { kind: 'move', x: Math.trunc(num(v.x, 0, -127, 127)), y: Math.trunc(num(v.y, 0, -127, 127)) };
    case 'scroll':
      return { kind: 'scroll', amount: Math.trunc(num(v.amount, 0, -127, 127)) };
    default:
      return null;
  }
}

function sanitizeStep(v: unknown): MacroStep | null {
  if (!isRec(v)) return null;
  const id = str(v.id) || newId('step');
  const delayMs = Math.trunc(num(v.delayMs, 0, 0, 65535));
  switch (v.type) {
    case 'keyboard':
      return { id, type: 'keyboard', key: str(v.key), modifiers: Math.trunc(num(v.modifiers, 0, 0, 255)), delayMs };
    case 'consumer':
      return isConsumer(v.code) ? { id, type: 'consumer', code: v.code, delayMs } : null;
    case 'mouse': {
      const mouse = sanitizeMouse(v.mouse);
      return mouse ? { id, type: 'mouse', mouse, delayMs } : null;
    }
    case 'delay':
      return { id, type: 'delay', delayMs };
    default:
      return null;
  }
}

function sanitizeAction(v: unknown, pageIds: ReadonlySet<string>, allowNav: boolean): Action {
  if (!isRec(v)) return { type: 'none' };
  switch (v.type) {
    case 'keyboard':
      return { type: 'keyboard', key: str(v.key), modifiers: Math.trunc(num(v.modifiers, 0, 0, 255)) };
    case 'consumer':
      return isConsumer(v.code) ? { type: 'consumer', code: v.code } : { type: 'none' };
    case 'mouse': {
      const mouse = sanitizeMouse(v.mouse);
      return mouse ? { type: 'mouse', mouse } : { type: 'none' };
    }
    case 'macro': {
      const steps = (Array.isArray(v.steps) ? v.steps : [])
        .map(sanitizeStep)
        .filter((s): s is MacroStep => s !== null)
        .slice(0, MAX_MACRO_STEPS);
      return { type: 'macro', steps };
    }
    case 'text':
      return { type: 'text', text: str(v.text) };
    case 'cpp':
      return { type: 'cpp', code: str(v.code) };
    case 'folder': {
      const t = str(v.targetPageId);
      return allowNav && pageIds.has(t) ? { type: 'folder', targetPageId: t } : { type: 'none' };
    }
    case 'back':
      return allowNav ? { type: 'back' } : { type: 'none' };
    default:
      return { type: 'none' };
  }
}

const LAYOUTS: readonly IconLayout[] = ['icon-only', 'icon-text-below', 'icon-text-side', 'text-only'];
const DITHERS: readonly DitherMode[] = ['none', 'floyd-steinberg', 'atkinson', 'bayer'];
const FITS: readonly FitMode[] = ['contain', 'cover', 'stretch'];

function sanitizeImage(v: unknown): ImageSource | null {
  if (!isRec(v) || typeof v.dataUrl !== 'string' || !v.dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl: v.dataUrl,
    fit: oneOf(v.fit, FITS, 'contain'),
    zoom: num(v.zoom, 1, 0.25, 4),
    offsetX: num(v.offsetX, 0, -128, 128),
    offsetY: num(v.offsetY, 0, -64, 64),
  };
}

function sanitizeAppearance(v: unknown): KeyAppearance {
  const d = createDefaultAppearance();
  if (!isRec(v)) return d;
  const icon = isRec(v.icon) ? v.icon : {};
  const label = isRec(v.label) ? v.label : {};
  return {
    mode: oneOf(v.mode, ['icon', 'image', 'blank'] as const, d.mode),
    layout: oneOf(v.layout, LAYOUTS, d.layout),
    icon: {
      name: str(icon.name, d.icon.name),
      size: num(icon.size, d.icon.size, 8, 56),
      x: num(icon.x, 0, -128, 128),
      y: num(icon.y, 0, -64, 64),
      fill: bool(icon.fill, false),
      weight: num(icon.weight, 400, 100, 700),
    },
    label: {
      text: str(label.text),
      size: num(label.size, d.label.size, 6, 28),
      x: num(label.x, 0, -128, 128),
      y: num(label.y, 0, -64, 64),
      bold: bool(label.bold, true),
    },
    image: sanitizeImage(v.image),
    border: bool(v.border, true),
    threshold: Math.round(num(v.threshold, 128, 0, 255)),
    invert: bool(v.invert, false),
    dither: oneOf(v.dither, DITHERS, 'none'),
  };
}

function sanitizeKey(v: unknown, pageIds: ReadonlySet<string>): KeyConfig {
  if (!isRec(v)) return createEmptyKey();
  const bmp = tryBase64ToBitmap(str(v.bitmap));
  return {
    id: str(v.id) || newId('key'),
    name: str(v.name),
    appearance: sanitizeAppearance(v.appearance),
    bitmap: bmp ? bitmapToBase64(bmp) : '',
    action: sanitizeAction(v.action, pageIds, true),
  };
}

function sanitizeEncoder(v: unknown, d: EncoderConfig, pageIds: ReadonlySet<string>): EncoderConfig {
  if (!isRec(v)) return d;
  return {
    cw: sanitizeAction(v.cw, pageIds, false),
    ccw: sanitizeAction(v.ccw, pageIds, false),
    sw: sanitizeAction(v.sw, pageIds, false),
  };
}

/**
 * Validates and repairs any DeckConfig-like value (missing fields get defaults, invalid actions become
 * `none`, pages are limited to 8, keys padded to 6, dangling folder/parent references cleaned).
 * Throws a pt-BR Error if the value is not a recognisable configuration.
 */
export function normalizeConfig(raw: unknown): DeckConfig {
  if (!isRec(raw) || !Array.isArray(raw.pages) || raw.pages.length === 0) {
    throw new Error('Arquivo inválido: configuração sem páginas.');
  }
  const def = createDefaultConfig();
  const rawPages = raw.pages.filter(isRec).slice(0, MAX_PAGES);
  if (rawPages.length === 0) throw new Error('Arquivo inválido: nenhuma página válida encontrada.');

  const ids: string[] = [];
  for (const p of rawPages) {
    let id = str(p.id) || newId('page');
    while (ids.includes(id)) id = newId('page');
    ids.push(id);
  }
  const idSet = new Set(ids);

  const pages: Page[] = rawPages.map((p, i) => {
    const keysRaw = Array.isArray(p.keys) ? p.keys : [];
    const keys = Array.from({ length: KEYS_PER_PAGE }, (_, k) => sanitizeKey(keysRaw[k], idSet));
    const keyIds = new Set<string>();
    for (const k of keys) {
      while (keyIds.has(k.id)) k.id = newId('key');
      keyIds.add(k.id);
    }
    const parent = str(p.parentId);
    return {
      id: ids[i],
      name: str(p.name) || (i === 0 ? 'Principal' : `Página ${i + 1}`),
      isFolder: i === 0 ? false : bool(p.isFolder, false),
      parentId: i === 0 ? null : parent && idSet.has(parent) && parent !== ids[i] ? parent : ids[0],
      keys,
    };
  });

  const enc = Array.isArray(raw.encoders) ? raw.encoders : [];
  const hwRaw = isRec(raw.hardware) ? raw.hardware : {};
  const pinsRaw = isRec(hwRaw.pins) ? hwRaw.pins : {};
  const hw = createDefaultHardware();
  for (const id of PIN_IDS) hw.pins[id as PinId] = Math.trunc(num(pinsRaw[id], hw.pins[id], -1, 255));
  hw.muxAddress = Math.trunc(num(hwRaw.muxAddress, hw.muxAddress, 0, 255));
  hw.oledAddress = Math.trunc(num(hwRaw.oledAddress, hw.oledAddress, 0, 255));
  if (Array.isArray(hwRaw.muxChannels)) {
    hw.muxChannels = hw.muxChannels.map((d, i) => Math.trunc(num((hwRaw.muxChannels as unknown[])[i], d, -1, 255)));
  }

  const netRaw = isRec(raw.network) ? raw.network : {};
  const net = createDefaultNetwork();

  return {
    version: 2,
    name: str(raw.name) || def.name,
    pages,
    encoders: [sanitizeEncoder(enc[0], def.encoders[0], idSet), sanitizeEncoder(enc[1], def.encoders[1], idSet)],
    hardware: hw,
    network: {
      deviceIp: str(netRaw.deviceIp, net.deviceIp),
      pcIp: str(netRaw.pcIp, net.pcIp),
      wifiSsid: str(netRaw.wifiSsid, net.wifiSsid),
      wifiPassword: str(netRaw.wifiPassword, net.wifiPassword),
      hostname: str(netRaw.hostname) || net.hostname,
    },
  };
}

/**
 * Serialises a config to pretty JSON (backup file).
 * `includeSecrets: false` blanks the Wi-Fi password.
 */
export function exportConfigJson(cfg: DeckConfig, opts: { includeSecrets?: boolean } = {}): string {
  const out: DeckConfig =
    opts.includeSecrets === false ? { ...cfg, network: { ...cfg.network, wifiPassword: '' } } : cfg;
  return JSON.stringify(out, null, 2);
}

/**
 * Parses, validates and migrates a JSON backup (v2 or legacy `danjos_deck_config`).
 * Throws an Error with a pt-BR message when the text is not a usable configuration.
 */
export function importConfigJson(text: string): DeckConfig {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Arquivo inválido: não é um JSON válido.');
  }
  if (!isRec(obj)) throw new Error('Arquivo inválido: formato de configuração não reconhecido.');
  if (obj.version === 2) return normalizeConfig(obj);
  if (Array.isArray(obj.pages) && obj.pages.some((p) => isRec(p) && Array.isArray(p.buttons))) {
    return migrateLegacyConfig(obj);
  }
  if (Array.isArray(obj.pages) && obj.version === undefined) return normalizeConfig(obj);
  throw new Error('Arquivo inválido: não parece uma configuração do Danjos Deck.');
}

// ---------------------------------------------------------------------------------------------
// Legacy (v1, Next.js app) import - best effort
// ---------------------------------------------------------------------------------------------

function legacyKeyName(k: string): string {
  if (/^F([1-9]|1\d|2[0-4])$/.test(k)) return `KEY_${k}`;
  if (k === 'SPACE') return ' ';
  return k;
}

function legacyModifiers(m: unknown): number {
  if (!isRec(m)) return 0;
  return (
    (m.leftCtrl ? 1 : 0) | (m.leftShift ? 2 : 0) | (m.leftAlt ? 4 : 0) | (m.leftGui ? 8 : 0) |
    (m.rightCtrl ? 16 : 0) | (m.rightShift ? 32 : 0) | (m.rightAlt ? 64 : 0) | (m.rightGui ? 128 : 0)
  );
}

function legacyMouse(m: unknown): MouseAction | null {
  if (!isRec(m)) return null;
  if (m.actionType === 'move') return { kind: 'move', x: num(m.x, 0), y: num(m.y, 0) };
  if (m.actionType === 'scroll') return { kind: 'scroll', amount: num(m.amount, 0) };
  if (m.actionType === 'click') {
    const b = m.button === 'right' ? 'right' : m.button === 'middle' ? 'middle' : 'left';
    return { kind: b };
  }
  return null;
}

function legacyAction(v: unknown, pageIds: ReadonlySet<string>, allowNav: boolean): Action {
  if (!isRec(v)) return { type: 'none' };
  switch (v.type) {
    case 'keyboard': {
      const kb = isRec(v.keyboard) ? v.keyboard : {};
      return { type: 'keyboard', key: legacyKeyName(str(kb.key)), modifiers: legacyModifiers(kb.modifiers) };
    }
    case 'consumer':
      return isConsumer(v.consumer) ? { type: 'consumer', code: v.consumer } : { type: 'none' };
    case 'mouse': {
      const mouse = legacyMouse(v.mouse);
      return mouse ? { type: 'mouse', mouse } : { type: 'none' };
    }
    case 'text':
      return { type: 'text', text: str(v.text) };
    case 'cpp':
      return { type: 'cpp', code: isRec(v.cpp) ? str(v.cpp.code) : '' };
    case 'sequence': {
      const steps: MacroStep[] = [];
      for (const s of Array.isArray(v.sequence) ? v.sequence : []) {
        if (!isRec(s)) continue;
        const delayMs = num(s.delayMs, 0, 0, 65535);
        const id = newId('step');
        if (s.type === 'keyboard' && isRec(s.keyboard)) {
          steps.push({ id, type: 'keyboard', key: legacyKeyName(str(s.keyboard.key)), modifiers: legacyModifiers(s.keyboard.modifiers), delayMs });
        } else if (s.type === 'consumer' && isConsumer(s.consumer)) {
          steps.push({ id, type: 'consumer', code: s.consumer, delayMs });
        } else if (s.type === 'mouse') {
          const mouse = legacyMouse(s.mouse);
          if (mouse) steps.push({ id, type: 'mouse', mouse, delayMs });
        } else if (s.type === 'delay') {
          steps.push({ id, type: 'delay', delayMs });
        }
      }
      return { type: 'macro', steps: steps.slice(0, MAX_MACRO_STEPS) };
    }
    case 'folder': {
      const f = isRec(v.folder) ? v.folder : {};
      const t = str(f.targetPageId);
      return allowNav && pageIds.has(t) ? { type: 'folder', targetPageId: t } : { type: 'none' };
    }
    case 'back':
      return allowNav ? { type: 'back' } : { type: 'none' };
    default:
      return { type: 'none' };
  }
}

function legacyBitmap(v: unknown): string {
  if (typeof v === 'string') {
    const b = tryBase64ToBitmap(v);
    return b ? bitmapToBase64(b) : '';
  }
  if (Array.isArray(v) && v.length === 1024) {
    const b = Uint8Array.from(v.map((n) => (typeof n === 'number' ? n & 0xff : 0)));
    return bitmapToBase64(b);
  }
  return '';
}

/**
 * Best-effort conversion of the legacy `danjos_deck_config` shape (CONTRACT §8) into a DeckConfig.
 * Keeps legacy bitmaps; icon/label settings are mapped into the new appearance model.
 */
export function migrateLegacyConfig(obj: unknown): DeckConfig {
  if (!isRec(obj) || !Array.isArray(obj.pages)) throw new Error('Configuração antiga inválida: sem páginas.');
  const rawPages = obj.pages.filter(isRec).slice(0, MAX_PAGES);
  if (rawPages.length === 0) throw new Error('Configuração antiga inválida: nenhuma página.');
  const ids = rawPages.map((p, i) => str(p.id) || `legacy_${i}`);
  const idSet = new Set(ids);
  const def = createDefaultConfig();

  const pages: Page[] = rawPages.map((p, i) => {
    const buttons = Array.isArray(p.buttons) ? p.buttons : [];
    const keys: KeyConfig[] = Array.from({ length: KEYS_PER_PAGE }, (_, b) => {
      const btn = isRec(buttons[b]) ? buttons[b] : {};
      const ap = createDefaultAppearance();
      const iconName = str(btn.iconName);
      if (iconName) {
        ap.mode = 'icon';
        ap.layout = oneOf(btn.iconLayout, ['icon-only', 'icon-text-side', 'icon-text-below'] as const, 'icon-only');
        ap.icon = {
          name: iconName,
          size: num(btn.iconSize, 24, 8, 56),
          x: num(btn.iconXOffset, 0, -128, 128),
          y: num(btn.iconYOffset, 0, -64, 64),
          fill: false,
          weight: 400,
        };
      }
      ap.label = {
        text: str(btn.label),
        size: num(btn.textSize, 12, 6, 28),
        x: num(btn.textXOffset, 0, -128, 128),
        y: num(btn.textYOffset, 0, -64, 64),
        bold: true,
      };
      ap.border = bool(btn.showBorder, true);
      return {
        id: newId('key'),
        name: str(btn.label),
        appearance: ap,
        bitmap: legacyBitmap(btn.bitmap),
        action: legacyAction(btn.action, idSet, true),
      };
    });
    const parent = str(p.parentId);
    return {
      id: ids[i],
      name: str(p.name) || `Página ${i + 1}`,
      isFolder: i === 0 ? false : bool(p.isFolder, false),
      parentId: i === 0 ? null : parent && idSet.has(parent) ? parent : ids[0],
      keys,
    };
  });

  const enc = (v: unknown, d: EncoderConfig): EncoderConfig =>
    isRec(v)
      ? {
          cw: legacyAction(v.cwAction, idSet, false),
          ccw: legacyAction(v.ccwAction, idSet, false),
          sw: legacyAction(v.btnAction, idSet, false),
        }
      : d;

  const hw = createDefaultHardware();
  if (isRec(obj.pins)) {
    const p = obj.pins;
    const map: [PinId, string, string | null][] = [
      ['btn0', 'btn1', 'btn1Enabled'], ['btn1', 'btn2', 'btn2Enabled'], ['btn2', 'btn3', 'btn3Enabled'],
      ['btn3', 'btn4', 'btn4Enabled'], ['btn4', 'btn5', 'btn5Enabled'], ['btn5', 'btn6', 'btn6Enabled'],
      ['prev', 'btnPrev', 'btnPrevEnabled'], ['next', 'btnNext', 'btnNextEnabled'],
      ['enc1Clk', 'enc1Clk', 'enc1Enabled'], ['enc1Dt', 'enc1Dt', 'enc1Enabled'], ['enc1Sw', 'enc1Btn', 'enc1Enabled'],
      ['enc2Clk', 'enc2Clk', 'enc2Enabled'], ['enc2Dt', 'enc2Dt', 'enc2Enabled'], ['enc2Sw', 'enc2Btn', 'enc2Enabled'],
      ['sda', 'sda', null], ['scl', 'scl', null],
    ];
    for (const [id, legacyKey, enabledKey] of map) {
      const disabled = enabledKey !== null && p[enabledKey] === false;
      // Legacy enc2 defaults (20/21/41) were incompatible with USB; only keep enc2 if explicitly enabled.
      const enc2Implicit = id.startsWith('enc2') && p.enc2Enabled !== true;
      hw.pins[id] = disabled || enc2Implicit ? -1 : Math.trunc(num(p[legacyKey], hw.pins[id], -1, 255));
    }
  }

  const net = createDefaultNetwork();
  net.pcIp = str(obj.pcIp);
  return {
    version: 2,
    name: def.name,
    pages,
    encoders: [enc(obj.encoder1, def.encoders[0]), enc(obj.encoder2, def.encoders[1])],
    hardware: hw,
    network: net,
  };
}

/**
 * Reads the legacy app's localStorage (`danjos_deck_config`, `danjos_ip`) and migrates it.
 * Returns null when absent or unusable.
 */
export function readLegacyLocalStorage(): DeckConfig | null {
  try {
    const raw = localStorage.getItem('danjos_deck_config');
    if (!raw) return null;
    const cfg = migrateLegacyConfig(JSON.parse(raw));
    const ip = localStorage.getItem('danjos_ip');
    if (ip) cfg.network.deviceIp = ip;
    return cfg;
  } catch {
    return null;
  }
}
