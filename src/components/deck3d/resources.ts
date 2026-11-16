import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  type BufferGeometry,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import {
  chevronGeometry,
  keyRingGeometry,
  keycapGeometry,
  navBaseGeometry,
  navDomeGeometry,
  plateGeometry,
} from './geometry';
import { KEY, MM } from './layout';
import { createPalette } from './palette';
import { createPlaMaterial } from './plaMaterial';

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function build() {
  const palette = createPalette();
  const geo = {
    plate: plateGeometry(),
    keycap: keycapGeometry(),
    glass: new PlaneGeometry(KEY.windowW, KEY.windowH),
    oled: new PlaneGeometry(KEY.oledW, KEY.oledH),
    ring: keyRingGeometry(0.2 * MM, 1.3 * MM),
    glow: new PlaneGeometry(KEY.w + 16 * MM, KEY.h + 16 * MM),
    navBase: navBaseGeometry(),
    navDome: navDomeGeometry(),
    chevronL: chevronGeometry(-1),
    chevronR: chevronGeometry(1),
  } satisfies Record<string, BufferGeometry>;
  const glowMap = glowTexture();
  const mat = {
    shell: createPlaMaterial({ color: palette.pla, roughness: 0.82, grain: 0.00028, grainScale: 210 }),
    labels: new MeshStandardMaterial({ color: palette.labels, roughness: 0.7 }),
    plate: createPlaMaterial({ color: palette.plaFace, roughness: 0.92, grain: 0.0007, grainScale: 260 }),
    key: createPlaMaterial({ color: palette.plaKey, roughness: 0.95, grain: 0.0008, grainScale: 240 }),
    knob: createPlaMaterial({ color: palette.pla, roughness: 0.8, grain: 0.0003, grainScale: 230 }),
    knobDisabled: createPlaMaterial({ color: palette.knobGhost, roughness: 0.95, grain: 0.0003, transparent: true, opacity: 0.42 }),
    /** Inactive black of the OLED module behind the window: unlit, never glares. */
    glass: new MeshBasicMaterial({ color: palette.glass }),
    /** Glass reflection only, as a very faint separate layer; the camera rig fades it out in front/focus. */
    glassLayer: new MeshPhysicalMaterial({ color: palette.glass, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false }),
    shaft: new MeshStandardMaterial({ color: palette.shaft, roughness: 0.35, metalness: 0.9 }),
    chevron: new MeshStandardMaterial({ color: palette.chevron, roughness: 0.6 }),
  } satisfies Record<string, Material>;
  return { palette, geo, mat, glowMap };
}

export type DeckResources = ReturnType<typeof build>;

/** Shared geometries/materials for the 3D deck, created once per Canvas and disposed on unmount. */
export function useDeckResources(): DeckResources {
  const res = useMemo(build, []);
  useEffect(
    () => () => {
      Object.values(res.geo).forEach((g) => g.dispose());
      Object.values(res.mat).forEach((m) => m.dispose());
      res.glowMap.dispose();
    },
    [res],
  );
  return res;
}

/** Per-instance additive glow / rim materials (opacity is animated per key). */
export function createGlowMaterial(res: DeckResources): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map: res.glowMap,
    color: res.palette.accent,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

/** Additive back-face halo (soft rim) drawn around a slightly enlarged copy of a mesh. */
export function createHaloMaterial(res: DeckResources): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: res.palette.accent,
    transparent: true,
    opacity: 0,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export function createRingMaterial(res: DeckResources): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: res.palette.accent, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
}
