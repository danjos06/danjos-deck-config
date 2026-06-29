import { DanjosDeckConfig } from './types';

const STORAGE_KEY = 'danjos_deck_config';

// Helper to convert byte array to base64
function bytesToBase64(bytes: number[]): string {
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to byte array
function base64ToBytes(base64: string): number[] {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function saveConfig(config: DanjosDeckConfig): void {
  try {
    // Clone config to avoid mutating the original
    const serializedConfig = JSON.parse(JSON.stringify(config));
    
    // Convert bitmaps to base64
    for (const page of serializedConfig.pages) {
      if (page.buttons) {
        for (const btn of page.buttons) {
          if (btn.bitmap && btn.bitmap.length > 0) {
            btn.bitmap = bytesToBase64(btn.bitmap);
          }
        }
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedConfig));
  } catch (e) {
    console.error('Failed to save config to localStorage', e);
  }
}

export function loadConfig(): DanjosDeckConfig | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const config = JSON.parse(data);
    
    // Convert base64 back to bitmaps
    if (config.pages) {
      for (const page of config.pages) {
        if (page.buttons) {
          for (const btn of page.buttons) {
            if (typeof btn.bitmap === 'string') {
              btn.bitmap = base64ToBytes(btn.bitmap);
            }
          }
        }
      }
    }
    
    return config as DanjosDeckConfig;
  } catch (e) {
    console.error('Failed to load config from localStorage', e);
    return null;
  }
}
