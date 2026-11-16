/**
 * Geometry of the official DANJOS DECK logo (traced from assets-src/logo-danjos-deck.png).
 * Shared by the SVG component, the favicon and the 3D face-plate canvas texture.
 *
 * The mark is a 3x3 grid of rounded-square outlines drawn on a common stroke grid (shared walls overlap).
 * At each of the 4 inner junctions the top-left cell's bottom-right corner and the bottom-right cell's
 * top-left corner use a large radius, which produces the interlocked "serpentine" S-walls. The bottom
 * middle tile ends in a shield-like point.
 */

export const MARK = {
  pitchX: 128,
  pitchY: 130,
  stroke: 24,
  radius: 30,
  bigRadius: 56,
  point: 24,
  width: 3 * 128 + 24,
  height: 3 * 130 + 24 + 24,
} as const;

/** Full lockup viewBox (mark + two-line wordmark), in the PNG's pixel scale. */
export const LOCKUP = {
  width: 1400,
  height: MARK.height,
  textX: 460,
  danjos: { baseline: 230, size: 200, length: 940 },
  deck: { baseline: 392, size: 172, length: 548, centerX: 460 + 470 },
} as const;

type Corners = [tl: number, tr: number, br: number, bl: number];

function roundedRect(x0: number, y0: number, x1: number, y1: number, [tl, tr, br, bl]: Corners): string {
  return [
    `M${x0 + tl} ${y0}`,
    `H${x1 - tr}`,
    `A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}`,
    `V${y1 - br}`,
    `A${br} ${br} 0 0 1 ${x1 - br} ${y1}`,
    `H${x0 + bl}`,
    `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}`,
    `V${y0 + tl}`,
    `A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}`,
    'Z',
  ].join(' ');
}

/** Bottom-middle tile: rounded top corners, sides run down into a soft shield point. */
function shieldTile(x0: number, y0: number, x1: number, y1: number, tl: number, tr: number): string {
  const xm = (x0 + x1) / 2;
  const p = MARK.point;
  return [
    `M${x0 + tl} ${y0}`,
    `H${x1 - tr}`,
    `A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}`,
    `V${y1 - 8}`,
    `Q${x1} ${y1 + 2} ${x1 - 12} ${y1 + 8}`,
    `L${xm + 13} ${y1 + p - 3}`,
    `Q${xm} ${y1 + p + 4} ${xm - 13} ${y1 + p - 3}`,
    `L${x0 + 12} ${y1 + 8}`,
    `Q${x0} ${y1 + 2} ${x0} ${y1 - 8}`,
    `V${y0 + tl}`,
    `A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}`,
    'Z',
  ].join(' ');
}

/** SVG path data (stroke-only) for the 9 tiles, in MARK units (origin top-left). */
export function markPaths(): string[] {
  const { pitchX, pitchY, stroke, radius: r, bigRadius: R } = MARK;
  const o = stroke / 2;
  const out: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = o + col * pitchX;
      const y0 = o + row * pitchY;
      const x1 = x0 + pitchX;
      const y1 = y0 + pitchY;
      // big radius where this cell is the TL cell (its BR) or the BR cell (its TL) of an inner junction
      const tl = row > 0 && col > 0 ? R : r;
      const br = row < 2 && col < 2 ? R : r;
      if (row === 2 && col === 1) out.push(shieldTile(x0, y0, x1, y1, tl, r));
      else out.push(roundedRect(x0, y0, x1, y1, [tl, r, br, r]));
    }
  }
  return out;
}
