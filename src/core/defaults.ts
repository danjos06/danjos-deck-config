import { KEYS_PER_PAGE } from './constants';
import type {
  Action,
  DeckConfig,
  EncoderConfig,
  HardwareConfig,
  KeyAppearance,
  KeyConfig,
  NetworkConfig,
  Page,
} from './types';

/** Generates a short unique id with an optional prefix. */
export function newId(prefix = 'id'): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  const rnd =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

/** Default key appearance (blank screen with a border). */
export function createDefaultAppearance(patch: Partial<KeyAppearance> = {}): KeyAppearance {
  return {
    mode: 'blank',
    layout: 'icon-only',
    icon: { name: 'star', size: 24, x: 0, y: 0, fill: false, weight: 400 },
    label: { text: '', size: 12, x: 0, y: 0, bold: true },
    image: null,
    border: true,
    threshold: 128,
    invert: false,
    dither: 'none',
    ...patch,
  };
}

/** Appearance for an icon key (optionally with a label). */
export function iconAppearance(icon: string, label = '', layout?: KeyAppearance['layout']): KeyAppearance {
  const a = createDefaultAppearance({
    mode: 'icon',
    layout: layout ?? (label ? 'icon-text-below' : 'icon-only'),
  });
  a.icon.name = icon;
  a.label.text = label;
  if (a.layout === 'icon-text-below') {
    a.icon.size = 28;
    a.label.size = 10;
  } else {
    a.icon.size = 36;
  }
  return a;
}

/**
 * Creates an empty key. `bitmap` is '' until rendered: the deck store's `ensureBitmaps()`
 * renders every key whose bitmap is ''.
 */
export function createEmptyKey(): KeyConfig {
  return {
    id: newId('key'),
    name: '',
    appearance: createDefaultAppearance(),
    bitmap: '',
    action: { type: 'none' },
  };
}

/** Creates a page with 6 empty keys. */
export function createPage(name: string, opts: { isFolder?: boolean; parentId?: string | null } = {}): Page {
  return {
    id: newId('page'),
    name,
    isFolder: opts.isFolder ?? false,
    parentId: opts.parentId ?? null,
    keys: Array.from({ length: KEYS_PER_PAGE }, createEmptyKey),
  };
}

/** Default hardware: pins btn0..5=1..6, prev 7, next 15, enc1 16/17/18, enc2 disabled, sda 8, scl 9. */
export function createDefaultHardware(): HardwareConfig {
  return {
    pins: {
      btn0: 1, btn1: 2, btn2: 3, btn3: 4, btn4: 5, btn5: 6,
      prev: 7, next: 15,
      enc1Clk: 16, enc1Dt: 17, enc1Sw: 18,
      enc2Clk: -1, enc2Dt: -1, enc2Sw: -1,
      sda: 8, scl: 9,
    },
    muxAddress: 0x70,
    oledAddress: 0x3c,
    muxChannels: [0, 1, 2, 3, 4, 5],
  };
}

/** Default network: everything empty except the mDNS hostname. */
export function createDefaultNetwork(): NetworkConfig {
  return { deviceIp: '', pcIp: '', wifiSsid: '', wifiPassword: '', hostname: 'danjos-deck' };
}

function defaultEncoders(): [EncoderConfig, EncoderConfig] {
  return [
    {
      cw: { type: 'consumer', code: 'VOLUME_INCREMENT' },
      ccw: { type: 'consumer', code: 'VOLUME_DECREMENT' },
      sw: { type: 'consumer', code: 'PLAY_PAUSE' },
    },
    {
      cw: { type: 'consumer', code: 'SCAN_NEXT_TRACK' },
      ccw: { type: 'consumer', code: 'SCAN_PREV_TRACK' },
      sw: { type: 'consumer', code: 'MUTE' },
    },
  ];
}

/**
 * Creates the default deck: one root page "Principal" with 6 media/utility keys.
 * Keys have `bitmap: ''`; the deck store's `ensureBitmaps()` renders them.
 */
export function createDefaultConfig(): DeckConfig {
  const page = createPage('Principal');
  const defs: { name: string; icon: string; label: string; action: Action }[] = [
    { name: 'Reproduzir/Pausar', icon: 'play_pause', label: 'Play', action: { type: 'consumer', code: 'PLAY_PAUSE' } },
    { name: 'Anterior', icon: 'skip_previous', label: 'Anterior', action: { type: 'consumer', code: 'SCAN_PREV_TRACK' } },
    { name: 'Próxima', icon: 'skip_next', label: 'Próxima', action: { type: 'consumer', code: 'SCAN_NEXT_TRACK' } },
    { name: 'Mudo', icon: 'volume_off', label: 'Mudo', action: { type: 'consumer', code: 'MUTE' } },
    { name: 'Captura de tela', icon: 'screenshot_region', label: 'Captura', action: { type: 'keyboard', key: 's', modifiers: 2 | 8 } },
    { name: 'Calculadora', icon: 'calculate', label: 'Calc', action: { type: 'consumer', code: 'AL_CALCULATOR' } },
  ];
  page.keys = page.keys.map((k, i) => {
    const d = defs[i];
    return { ...k, name: d.name, appearance: iconAppearance(d.icon, d.label), action: d.action };
  });
  return {
    version: 2,
    name: 'Meu Danjos Deck',
    pages: [page],
    encoders: defaultEncoders(),
    hardware: createDefaultHardware(),
    network: createDefaultNetwork(),
  };
}
