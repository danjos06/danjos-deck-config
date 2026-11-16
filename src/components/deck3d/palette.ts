import { Color } from 'three';

/** Reads an "r g b" CSS custom property (see src/index.css) into a THREE.Color (sRGB). */
function cssRgb(name: string, fallback: string): Color {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const parts = raw.split(/\s+/).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return new Color().setRGB(parts[0] / 255, parts[1] / 255, parts[2] / 255, 'srgb');
    }
  } catch {
    /* SSR / tests */
  }
  return new Color(fallback);
}

/** 3D material colours. Brand colours follow the CSS theme tokens. */
export function createPalette() {
  return {
    accent: cssRgb('--accent', '#1fb6d6'),
    tile: cssRgb('--brand-tile', '#26b2d4'),
    tileDeep: cssRgb('--brand-tile-deep', '#1878a8'),
    pla: new Color('#0f1012'),
    plaFace: new Color('#121315'),
    plaKey: new Color('#141518'),
    labels: new Color('#6b6e74'),
    glass: new Color('#030405'),
    shaft: new Color('#8a8d92'),
    chevron: new Color('#d9dde2'),
    wordDanjos: new Color('#eef0f2'),
    wordDeck: new Color('#8d9299'),
    hover: new Color('#cfefff'),
    knobGhost: new Color('#4a4e56'),
    shadow: new Color('#000000'),
  };
}

export type Palette = ReturnType<typeof createPalette>;
