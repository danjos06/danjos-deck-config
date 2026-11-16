import type { KeyName, PinId } from './types';

export const MAX_PAGES = 8;
export const MAX_MACRO_STEPS = 10;
export const KEYS_PER_PAGE = 6;
export const MAX_IMAGE_SIDE = 512;

/** Wire pin ids 0..15 follow this order (`P <id> <val>`). */
export const PIN_IDS: readonly PinId[] = [
  'btn0', 'btn1', 'btn2', 'btn3', 'btn4', 'btn5',
  'prev', 'next',
  'enc1Clk', 'enc1Dt', 'enc1Sw', 'enc2Clk', 'enc2Dt', 'enc2Sw',
  'sda', 'scl',
];

/** Arduino-ESP32 USBHIDKeyboard non-printing key constants (CONTRACT §5.6). */
export const KEY_MAP: Readonly<Record<string, number>> = {
  KEY_RETURN: 0xb0, KEY_ESC: 0xb1, KEY_BACKSPACE: 0xb2, KEY_TAB: 0xb3,
  KEY_DELETE: 0xd4, KEY_INSERT: 0xd1, KEY_HOME: 0xd2, KEY_PAGE_UP: 0xd3,
  KEY_END: 0xd5, KEY_PAGE_DOWN: 0xd6,
  KEY_RIGHT_ARROW: 0xd7, KEY_LEFT_ARROW: 0xd8, KEY_DOWN_ARROW: 0xd9, KEY_UP_ARROW: 0xda,
  KEY_F1: 0xc2, KEY_F2: 0xc3, KEY_F3: 0xc4, KEY_F4: 0xc5, KEY_F5: 0xc6, KEY_F6: 0xc7,
  KEY_F7: 0xc8, KEY_F8: 0xc9, KEY_F9: 0xca, KEY_F10: 0xcb, KEY_F11: 0xcc, KEY_F12: 0xcd,
  KEY_F13: 0xf0, KEY_F14: 0xf1, KEY_F15: 0xf2, KEY_F16: 0xf3, KEY_F17: 0xf4, KEY_F18: 0xf5,
  KEY_F19: 0xf6, KEY_F20: 0xf7, KEY_F21: 0xf8, KEY_F22: 0xf9, KEY_F23: 0xfa, KEY_F24: 0xfb,
  HID_KEY_APPLICATION: 0x65, // legacy; Keyboard.press(0x65) types 'e' on most cores - prefer KEY_MENU
  // Additions (Arduino-ESP32 USBHIDKeyboard constants)
  KEY_CAPS_LOCK: 0xc1,
  KEY_PRINT_SCREEN: 0xce,
  KEY_SCROLL_LOCK: 0xcf,
  KEY_PAUSE: 0xd0,
  KEY_NUM_LOCK: 0xdb,
  KEY_MENU: 0xed,
};

/** Modifier key names -> modifier bit. `encodeAction` converts them into the modifier bitmask with key 0. */
export const MODIFIER_KEYS: Readonly<Record<string, number>> = {
  KEY_LEFT_CTRL: 1,
  KEY_LEFT_SHIFT: 2,
  KEY_LEFT_ALT: 4,
  KEY_LEFT_GUI: 8,
  KEY_RIGHT_CTRL: 16,
  KEY_RIGHT_SHIFT: 32,
  KEY_RIGHT_ALT: 64,
  KEY_RIGHT_GUI: 128,
};

/** Modifier bit flags, same order as the bitmask. */
export const MODIFIER_BITS = [
  { bit: 1, key: 'KEY_LEFT_CTRL', label: 'Ctrl esq.', short: 'Ctrl' },
  { bit: 2, key: 'KEY_LEFT_SHIFT', label: 'Shift esq.', short: 'Shift' },
  { bit: 4, key: 'KEY_LEFT_ALT', label: 'Alt esq.', short: 'Alt' },
  { bit: 8, key: 'KEY_LEFT_GUI', label: 'Win/Cmd esq.', short: 'Win' },
  { bit: 16, key: 'KEY_RIGHT_CTRL', label: 'Ctrl dir.', short: 'Ctrl dir.' },
  { bit: 32, key: 'KEY_RIGHT_SHIFT', label: 'Shift dir.', short: 'Shift dir.' },
  { bit: 64, key: 'KEY_RIGHT_ALT', label: 'Alt Gr / Alt dir.', short: 'Alt dir.' },
  { bit: 128, key: 'KEY_RIGHT_GUI', label: 'Win/Cmd dir.', short: 'Win dir.' },
] as const;

/** HID consumer-control usage codes (legacy set + commonly supported extras). */
export const CONSUMER_MAP = {
  VOLUME_INCREMENT: 0x00e9,
  VOLUME_DECREMENT: 0x00ea,
  PLAY_PAUSE: 0x00cd,
  MUTE: 0x00e2,
  SCAN_NEXT_TRACK: 0x00b5,
  SCAN_PREV_TRACK: 0x00b6,
  STOP: 0x00b7,
  BRIGHTNESS_INCREMENT: 0x006f,
  BRIGHTNESS_DECREMENT: 0x0070,
  // Additions (USB HID Usage Tables, Consumer page 0x0C)
  PLAY: 0x00b0,
  PAUSE: 0x00b1,
  FAST_FORWARD: 0x00b3,
  REWIND: 0x00b4,
  EJECT: 0x00b8,
  AL_EMAIL: 0x018a,
  AL_CALCULATOR: 0x0192,
  AL_BROWSER: 0x0196,
  AC_SEARCH: 0x0221,
  AC_HOME: 0x0223,
  AC_BACK: 0x0224,
  AC_FORWARD: 0x0225,
  AC_REFRESH: 0x0227,
} as const satisfies Record<string, number>;

/** pt-BR labels + suggested Material icon for each consumer usage. */
export const CONSUMER_INFO: Readonly<Record<keyof typeof CONSUMER_MAP, { label: string; icon: string }>> = {
  VOLUME_INCREMENT: { label: 'Volume +', icon: 'volume_up' },
  VOLUME_DECREMENT: { label: 'Volume -', icon: 'volume_down' },
  PLAY_PAUSE: { label: 'Reproduzir/Pausar', icon: 'play_pause' },
  MUTE: { label: 'Mudo', icon: 'volume_off' },
  SCAN_NEXT_TRACK: { label: 'Próxima faixa', icon: 'skip_next' },
  SCAN_PREV_TRACK: { label: 'Faixa anterior', icon: 'skip_previous' },
  STOP: { label: 'Parar', icon: 'stop' },
  BRIGHTNESS_INCREMENT: { label: 'Brilho +', icon: 'brightness_7' },
  BRIGHTNESS_DECREMENT: { label: 'Brilho -', icon: 'brightness_5' },
  PLAY: { label: 'Reproduzir', icon: 'play_arrow' },
  PAUSE: { label: 'Pausar', icon: 'pause' },
  FAST_FORWARD: { label: 'Avançar', icon: 'fast_forward' },
  REWIND: { label: 'Retroceder', icon: 'fast_rewind' },
  EJECT: { label: 'Ejetar', icon: 'eject' },
  AL_EMAIL: { label: 'E-mail', icon: 'mail' },
  AL_CALCULATOR: { label: 'Calculadora', icon: 'calculate' },
  AL_BROWSER: { label: 'Navegador', icon: 'language' },
  AC_SEARCH: { label: 'Pesquisar', icon: 'search' },
  AC_HOME: { label: 'Página inicial', icon: 'home' },
  AC_BACK: { label: 'Voltar (navegador)', icon: 'arrow_back' },
  AC_FORWARD: { label: 'Avançar (navegador)', icon: 'arrow_forward' },
  AC_REFRESH: { label: 'Atualizar', icon: 'refresh' },
};

export type KeyGroup = 'letters' | 'digits' | 'punctuation' | 'navigation' | 'function' | 'modifiers' | 'system';

export const KEY_GROUP_LABELS: Readonly<Record<KeyGroup, string>> = {
  letters: 'Letras',
  digits: 'Números',
  punctuation: 'Pontuação',
  navigation: 'Navegação',
  function: 'Teclas de função',
  modifiers: 'Modificadoras',
  system: 'Sistema',
};

export interface KeyCatalogEntry {
  name: KeyName;
  label: string;
  group: KeyGroup;
}

function buildCatalog(): KeyCatalogEntry[] {
  const out: KeyCatalogEntry[] = [];
  for (let c = 97; c <= 122; c++) {
    const ch = String.fromCharCode(c);
    out.push({ name: ch, label: ch.toUpperCase(), group: 'letters' });
  }
  for (let d = 0; d <= 9; d++) out.push({ name: String(d), label: String(d), group: 'digits' });
  const punct: [string, string][] = [
    [' ', 'Espaço'], ['-', 'Hífen ( - )'], ['=', 'Igual ( = )'], ['[', 'Colchete ( [ )'], [']', 'Colchete ( ] )'],
    ['\\', 'Barra invertida'], [';', 'Ponto e vírgula'], ["'", 'Apóstrofo'],
    ['`', 'Crase'], [',', 'Vírgula'], ['.', 'Ponto'], ['/', 'Barra'],
  ];
  for (const [name, label] of punct) out.push({ name, label, group: 'punctuation' });
  const nav: [string, string][] = [
    ['KEY_UP_ARROW', 'Seta para cima'], ['KEY_DOWN_ARROW', 'Seta para baixo'],
    ['KEY_LEFT_ARROW', 'Seta para a esquerda'], ['KEY_RIGHT_ARROW', 'Seta para a direita'],
    ['KEY_HOME', 'Home'], ['KEY_END', 'End'], ['KEY_PAGE_UP', 'Page Up'], ['KEY_PAGE_DOWN', 'Page Down'],
    ['KEY_INSERT', 'Insert'], ['KEY_DELETE', 'Delete'],
  ];
  for (const [name, label] of nav) out.push({ name, label, group: 'navigation' });
  for (let i = 1; i <= 24; i++) out.push({ name: `KEY_F${i}`, label: `F${i}`, group: 'function' });
  for (const m of MODIFIER_BITS) out.push({ name: m.key, label: m.label, group: 'modifiers' });
  const sys: [string, string][] = [
    ['KEY_RETURN', 'Enter'], ['KEY_ESC', 'Esc'], ['KEY_BACKSPACE', 'Backspace'], ['KEY_TAB', 'Tab'],
    ['KEY_CAPS_LOCK', 'Caps Lock'], ['KEY_PRINT_SCREEN', 'Print Screen'], ['KEY_SCROLL_LOCK', 'Scroll Lock'],
    ['KEY_PAUSE', 'Pause/Break'], ['KEY_NUM_LOCK', 'Num Lock'], ['KEY_MENU', 'Menu de contexto'],
  ];
  for (const [name, label] of sys) out.push({ name, label, group: 'system' });
  return out;
}

/** Catalog of keys for pickers (pt-BR labels, grouped). */
export const KEY_CATALOG: readonly KeyCatalogEntry[] = buildCatalog();

/** Human label for a key name (falls back to the name itself). */
export function keyLabel(name: KeyName): string {
  if (name === '') return '';
  const hit = KEY_CATALOG.find((k) => k.name === name);
  if (hit) return hit.label;
  return name.length === 1 ? name.toUpperCase() : name;
}

const CODE_TO_KEY: Readonly<Record<string, KeyName>> = {
  Enter: 'KEY_RETURN', NumpadEnter: 'KEY_RETURN', Escape: 'KEY_ESC', Backspace: 'KEY_BACKSPACE', Tab: 'KEY_TAB',
  Delete: 'KEY_DELETE', Insert: 'KEY_INSERT', Home: 'KEY_HOME', End: 'KEY_END',
  PageUp: 'KEY_PAGE_UP', PageDown: 'KEY_PAGE_DOWN',
  ArrowUp: 'KEY_UP_ARROW', ArrowDown: 'KEY_DOWN_ARROW', ArrowLeft: 'KEY_LEFT_ARROW', ArrowRight: 'KEY_RIGHT_ARROW',
  CapsLock: 'KEY_CAPS_LOCK', PrintScreen: 'KEY_PRINT_SCREEN', ScrollLock: 'KEY_SCROLL_LOCK',
  Pause: 'KEY_PAUSE', NumLock: 'KEY_NUM_LOCK', ContextMenu: 'KEY_MENU',
  ControlLeft: 'KEY_LEFT_CTRL', ShiftLeft: 'KEY_LEFT_SHIFT', AltLeft: 'KEY_LEFT_ALT', MetaLeft: 'KEY_LEFT_GUI',
  ControlRight: 'KEY_RIGHT_CTRL', ShiftRight: 'KEY_RIGHT_SHIFT', AltRight: 'KEY_RIGHT_ALT', MetaRight: 'KEY_RIGHT_GUI',
  Space: ' ', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
};

/**
 * Converts a browser keyboard event into a KeyName (for a "press a key" recorder).
 * Uses the physical `code` for letters/digits/function/special keys; returns null if unsupported.
 */
export function browserKeyToKeyName(e: Pick<KeyboardEvent, 'code' | 'key'>): KeyName | null {
  const code = e.code;
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1].toLowerCase();
  m = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (m) return m[1];
  m = /^F([0-9]{1,2})$/.exec(code);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 24 ? `KEY_F${n}` : null;
  }
  const mapped = CODE_TO_KEY[code];
  if (mapped !== undefined) return mapped;
  if (e.key.length === 1) {
    const c = e.key.charCodeAt(0);
    if (c >= 32 && c <= 126) return e.key.toLowerCase();
  }
  return null;
}

/** Modifier bitmask of the *held* modifiers of a keyboard event (left-side bits; the event cannot tell sides). */
export function eventModifiers(e: Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): number {
  return (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
}
