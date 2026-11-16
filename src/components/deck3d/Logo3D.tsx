import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, LinearMipmapLinearFilter, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { LOCKUP, MARK, markPaths } from '../brand/logoGeometry';
import { MM, PLATE } from './layout';
import type { DeckResources } from './resources';

const SCALE = 0.75; // canvas px per logo unit
const WIDTH = 33 * MM; // printed logo width on the plate (~1.15 keycaps, measured against the photo)

function drawLogo(ctx: CanvasRenderingContext2D, res: DeckResources): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.strokeStyle = `#${res.palette.accent.getHexString()}`;
  ctx.lineWidth = MARK.stroke;
  ctx.lineJoin = 'round';
  for (const d of markPaths()) ctx.stroke(new Path2D(d));
  ctx.textBaseline = 'alphabetic';
  const word = (text: string, px: number, length: number, x: number, baseline: number, color: string) => {
    ctx.font = `800 ${px}px Montserrat, Inter, sans-serif`;
    const w = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(x, baseline);
    ctx.scale(w > 0 ? length / w : 1, 1);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  word('DANJOS', LOCKUP.danjos.size, LOCKUP.danjos.length, LOCKUP.textX, LOCKUP.danjos.baseline, `#${res.palette.wordDanjos.getHexString()}`);
  word('DECK', LOCKUP.deck.size, LOCKUP.deck.length, LOCKUP.deck.centerX - LOCKUP.deck.length / 2, LOCKUP.deck.baseline, `#${res.palette.wordDeck.getHexString()}`);
  ctx.restore();
}

/** The official logo printed on the face plate, drawn from the shared SVG geometry into a CanvasTexture. */
export function Logo3D({ res, y }: { res: DeckResources; y: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const { tex, mat, geo, canvas } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(LOCKUP.width * SCALE);
    canvas.height = Math.ceil(LOCKUP.height * SCALE);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearMipmapLinearFilter;
    const mat = new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.75, metalness: 0, depthWrite: false });
    const geo = new PlaneGeometry(WIDTH, (WIDTH * LOCKUP.height) / LOCKUP.width);
    return { tex, mat, geo, canvas };
  }, []);

  useEffect(() => {
    tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      drawLogo(ctx, res);
      tex.needsUpdate = true;
      invalidate();
    };
    paint();
    // Repaint once the self-hosted Montserrat face is available (no-op if already loaded).
    document.fonts?.load('800 100px Montserrat').then(paint, () => undefined);
    return () => {
      alive = false;
    };
  }, [canvas, tex, gl, res, invalidate]);

  useEffect(() => () => (tex.dispose(), mat.dispose(), geo.dispose()), [tex, mat, geo]);

  return <mesh geometry={geo} material={mat} position={[0, y, PLATE.top + 0.03 * MM]} raycast={() => null} />;
}
