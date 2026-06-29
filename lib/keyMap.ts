export const KEY_MAP: Record<string, number> = {
  'KEY_RETURN': 0xB0,
  'KEY_ESC': 0xB1,
  'KEY_BACKSPACE': 0xB2,
  'KEY_TAB': 0xB3,
  'KEY_DELETE': 0xD4,
  'KEY_INSERT': 0xD1,
  'KEY_HOME': 0xD2,
  'KEY_PAGE_UP': 0xD3,
  'KEY_END': 0xD5,
  'KEY_PAGE_DOWN': 0xD6,
  'KEY_RIGHT_ARROW': 0xD7,
  'KEY_LEFT_ARROW': 0xD8,
  'KEY_DOWN_ARROW': 0xD9,
  'KEY_UP_ARROW': 0xDA,
  'KEY_F1': 0xC2,
  'KEY_F2': 0xC3,
  'KEY_F3': 0xC4,
  'KEY_F4': 0xC5,
  'KEY_F5': 0xC6,
  'KEY_F6': 0xC7,
  'KEY_F7': 0xC8,
  'KEY_F8': 0xC9,
  'KEY_F9': 0xCA,
  'KEY_F10': 0xCB,
  'KEY_F11': 0xCC,
  'KEY_F12': 0xCD,
  'KEY_F13': 0xF0,
  'KEY_F14': 0xF1,
  'KEY_F15': 0xF2,
  'KEY_F16': 0xF3,
  'KEY_F17': 0xF4,
  'KEY_F18': 0xF5,
  'KEY_F19': 0xF6,
  'KEY_F20': 0xF7,
  'KEY_F21': 0xF8,
  'KEY_F22': 0xF9,
  'KEY_F23': 0xFA,
  'KEY_F24': 0xFB,
  'HID_KEY_APPLICATION': 0x65,
};

export const CONSUMER_MAP: Record<string, number> = {
  'VOLUME_INCREMENT': 0x00E9,
  'VOLUME_DECREMENT': 0x00EA,
  'PLAY_PAUSE': 0x00CD,
  'MUTE': 0x00E2,
  'SCAN_NEXT_TRACK': 0x00B5,
  'SCAN_PREV_TRACK': 0x00B6,
  'STOP': 0x00B7,
  'BRIGHTNESS_INCREMENT': 0x006F,
  'BRIGHTNESS_DECREMENT': 0x0070,
};

export function getKeyCode(key: string): number {
  if (KEY_MAP[key]) return KEY_MAP[key];
  if (CONSUMER_MAP[key]) return CONSUMER_MAP[key];
  if (key.length === 1) return key.charCodeAt(0);
  return 0;
}

export function getKeyName(code: number, type: number): string {
  if (type === 1) { // Keyboard
    for (const [key, val] of Object.entries(KEY_MAP)) {
      if (val === code) return key;
    }
    if (code >= 32 && code <= 126) return String.fromCharCode(code);
    return '';
  } else if (type === 2) { // Consumer
    for (const [key, val] of Object.entries(CONSUMER_MAP)) {
      if (val === code) return key;
    }
    return '';
  }
  return '';
}
