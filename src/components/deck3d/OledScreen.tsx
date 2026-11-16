import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, NearestFilter, ShaderMaterial, SRGBColorSpace, type BufferGeometry } from 'three';
import { OLED_H, OLED_W } from '@/core/bitmap/pack';
import { bitmapB64ToImageData } from '@/lib/ui/oled';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * OLED: 1-bit bitmap (pale blue-white on true black), unlit and not tone mapped so it stays legible,
 * with a page-change wipe whose bright scan edge travels in the navigation direction.
 */
const FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform float uProgress;
uniform float uDir;
uniform float uBright;
uniform vec3 uScan;
void main() {
  vec3 cur = texture2D(uCur, vUv).rgb;
  vec3 prev = texture2D(uPrev, vUv).rgb;
  float xp = uDir < 0.0 ? 1.0 - vUv.x : vUv.x;
  float edge = 1.0 - uProgress;
  float reveal = step(edge, xp);
  float wiping = step(0.001, uProgress) * (1.0 - step(0.999, uProgress));
  vec3 col = mix(prev * (1.0 - uProgress * 0.7), cur, reveal);
  col += uScan * exp(-abs(xp - edge) * 70.0) * wiping * 0.9;
  col *= uBright;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = OLED_W;
  c.height = OLED_H;
  return c;
}

function makeTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface OledScreenProps {
  geometry: BufferGeometry;
  bitmap: string;
  /** Changes when the page changes; triggers the wipe transition. */
  pageKey: string;
  direction: -1 | 0 | 1;
  hovered: boolean;
  reducedMotion: boolean;
  z: number;
}

export const OledScreen = memo(function OledScreen({ geometry, bitmap, pageKey, direction, hovered, reducedMotion, z }: OledScreenProps) {
  const invalidate = useThree((s) => s.invalidate);
  const state = useMemo(() => {
    const cur = makeCanvas();
    const prev = makeCanvas();
    const curTex = makeTexture(cur);
    const prevTex = makeTexture(prev);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCur: { value: curTex },
        uPrev: { value: prevTex },
        uProgress: { value: 1 },
        uDir: { value: 1 },
        uBright: { value: 1 },
        uScan: { value: [0.55, 0.85, 1.0] },
      },
      toneMapped: false,
    });
    return { cur, prev, curTex, prevTex, material };
  }, []);
  const lastPage = useRef<string | null>(null);
  const progress = useRef(1);

  useEffect(
    () => () => {
      state.curTex.dispose();
      state.prevTex.dispose();
      state.material.dispose();
    },
    [state],
  );

  // Redraw only when this key's bitmap (or the page) changes.
  useEffect(() => {
    const pc = state.prev.getContext('2d');
    const cc = state.cur.getContext('2d');
    if (!pc || !cc) return;
    pc.clearRect(0, 0, OLED_W, OLED_H);
    pc.drawImage(state.cur, 0, 0);
    cc.putImageData(bitmapB64ToImageData(bitmap), 0, 0);
    state.curTex.needsUpdate = true;
    state.prevTex.needsUpdate = true;
    const pageChanged = lastPage.current !== null && lastPage.current !== pageKey;
    lastPage.current = pageKey;
    progress.current = pageChanged && !reducedMotion ? 0 : 1;
    state.material.uniforms.uDir.value = direction < 0 ? -1 : 1;
    state.material.uniforms.uProgress.value = progress.current;
    invalidate();
  }, [bitmap, pageKey, direction, reducedMotion, state, invalidate]);

  useEffect(() => {
    state.material.uniforms.uBright.value = hovered ? 1.12 : 1;
    invalidate();
  }, [hovered, state, invalidate]);

  useFrame((_, dt) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt / 0.34);
    state.material.uniforms.uProgress.value = progress.current;
    invalidate();
  });

  return <mesh geometry={geometry} material={state.material} position-z={z} raycast={() => null} />;
});
