import { BufferGeometry, ExtrudeGeometry, LatheGeometry, Path, Shape, ShapeGeometry, Vector2 } from 'three';
import { KEY, MM, NAV, PLATE } from './layout';

function roundedRectPath<T extends Path>(p: T, w: number, h: number, r: number, cx = 0, cy = 0): T {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.quadraticCurveTo(x + w, y, x + w, y + rr);
  p.lineTo(x + w, y + h - rr);
  p.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  p.lineTo(x + rr, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - rr);
  p.lineTo(x, y + rr);
  p.quadraticCurveTo(x, y, x + rr, y);
  return p;
}

export const roundedRectShape = (w: number, h: number, r: number) => roundedRectPath(new Shape(), w, h, r);

/** Extrudes along +Z from z=0 to z=height (bevel included). */
function extrudeRounded(shape: Shape, height: number, bevel: number, curveSegments = 6): ExtrudeGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(height - bevel * 2, 0.0001),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, bevel);
  g.computeVertexNormals();
  return g;
}

/** Face plate that closes the shell opening; top surface at z=0, extends down to the ledge. */
export function plateGeometry(): BufferGeometry {
  const thickness = PLATE.top - PLATE.bottom;
  const g = extrudeRounded(roundedRectShape(PLATE.w, PLATE.h, PLATE.radius), thickness, 0.5 * MM, 4);
  g.translate(0, 0, -thickness);
  return g;
}

/** Raised square keycap with a recessed rectangular OLED window (through-hole; glass sits inside). */
export function keycapGeometry(): BufferGeometry {
  const s = roundedRectShape(KEY.w, KEY.h, KEY.radius);
  s.holes.push(roundedRectPath(new Path(), KEY.windowW, KEY.windowH, 0.8 * MM, 0, KEY.windowY));
  return extrudeRounded(s, KEY.height, KEY.bevel, 6);
}

/** Nav key base (rounded square). */
export function navBaseGeometry(): BufferGeometry {
  return extrudeRounded(roundedRectShape(NAV.size, NAV.size, NAV.radius), NAV.height, 0.8 * MM, 6);
}

/** Round domed button top of the nav key, axis +Z, base at z=0. */
export function navDomeGeometry(): BufferGeometry {
  const pts: Vector2[] = [];
  const r = NAV.domeR;
  const h = NAV.domeH;
  pts.push(new Vector2(0.0001, h));
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    // flat-ish cap that rolls over into a vertical skirt
    const a = (t * Math.PI) / 2;
    pts.push(new Vector2(Math.sin(a) * r * 0.25 + r * 0.75 * t, h - (1 - Math.cos(a)) * h * 0.55));
  }
  pts.push(new Vector2(r, 0));
  const g = new LatheGeometry(pts.reverse(), 40);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Thin chevron "<" (dir -1) or ">" (dir 1), flat in XY, slightly extruded. */
export function chevronGeometry(dir: 1 | -1): BufferGeometry {
  const a = 2.0 * MM;
  const b = 2.6 * MM;
  const t = 0.75 * MM;
  const s = new Shape();
  s.moveTo(-a / 2, b);
  s.lineTo(-a / 2 + t, b);
  s.lineTo(a / 2 + t * 0.5, 0);
  s.lineTo(-a / 2 + t, -b);
  s.lineTo(-a / 2, -b);
  s.lineTo(a / 2 - t * 0.5, 0);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.15 * MM, bevelEnabled: false });
  if (dir === -1) g.rotateZ(Math.PI);
  return g;
}

/** Flat ring hugging a keycap footprint (selection rim light). */
export function keyRingGeometry(inset: number, outset: number): BufferGeometry {
  const s = roundedRectShape(KEY.w + outset * 2, KEY.h + outset * 2, KEY.radius + outset);
  s.holes.push(roundedRectPath(new Path(), KEY.w + inset * 2, KEY.h + inset * 2, KEY.radius + inset));
  return new ShapeGeometry(s, 8);
}

