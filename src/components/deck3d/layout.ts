import { ENCLOSURE, KNOB } from './enclosure.generated';

/** Scene units per millimetre (the GLBs use 1 unit = 100 mm). */
export const MM = 0.01;

const CLEARANCE_MM = 0.6;
const PLATE_TOP_MM = -4; // plate surface sits 4 mm under the shell rim (it rests on the measured ledges)

/**
 * Face-local frame: origin = centre of the shell opening on the rim plane, +Z = face normal,
 * +Y = up the slope, X = width. All numbers in scene units.
 */
export const FACE = {
  /** Rotation about X that maps +Z to the measured face normal. */
  tiltX: -(90 - ENCLOSURE.faceAngleDeg) * (Math.PI / 180),
  origin: [...ENCLOSURE.openingCenter] as [number, number, number],
};

export const PLATE = {
  w: (ENCLOSURE.openingMm.width - CLEARANCE_MM) * MM,
  h: (ENCLOSURE.openingMm.slope - CLEARANCE_MM) * MM,
  top: PLATE_TOP_MM * MM,
  bottom: -ENCLOSURE.ledgeDepthMm * MM,
  radius: 1.2 * MM,
} as const;

export const KEY = {
  w: 31 * MM,
  h: 28 * MM,
  height: 9 * MM,
  radius: 3 * MM,
  bevel: 0.9 * MM,
  windowW: 23 * MM,
  windowH: 14 * MM,
  windowY: 1 * MM,
  /** Glass/OLED depth below the key top. */
  glassDepth: 3.2 * MM,
  oledW: 21.74 * MM,
  oledH: 10.87 * MM,
  travel: 1.8 * MM,
  pitchX: 35.5 * MM,
  pitchY: 32 * MM,
} as const;

const topMargin = 4.5 * MM;
const row0Y = PLATE.h / 2 - topMargin - KEY.h / 2;

/** Key centres (index = row * 3 + col), on the plate surface. */
export const KEY_POSITIONS: readonly [number, number][] = Array.from({ length: 6 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return [(col - 1) * KEY.pitchX, row0Y - row * KEY.pitchY];
});

const keysBottom = row0Y - KEY.pitchY - KEY.h / 2;
export const NAV_ROW_Y = (keysBottom + -PLATE.h / 2) / 2;

export const NAV = {
  size: 16 * MM,
  height: 6 * MM,
  radius: 2.2 * MM,
  domeR: 6.4 * MM,
  domeH: 2.2 * MM,
  x: 37.5 * MM,
  travel: 1.4 * MM,
} as const;

export const KNOB_MOUNT = {
  axisY: ENCLOSURE.knobAxis.y,
  axisZ: ENCLOSURE.knobAxis.z,
  wallX: ENCLOSURE.knobAxis.wallX,
  gap: 3 * MM,
  radius: (KNOB.diameterMm / 2) * MM,
  thickness: KNOB.thicknessMm * MM,
  shaftR: ENCLOSURE.knobHoleRadiusMm * 0.85 * MM,
} as const;

/** Rough device extents incl. knobs, for camera framing. */
export const DEVICE_BOUNDS = {
  halfW: KNOB_MOUNT.wallX + KNOB_MOUNT.gap + KNOB_MOUNT.thickness,
  height: ENCLOSURE.size[1],
  halfD: ENCLOSURE.size[2] / 2,
  center: [0, ENCLOSURE.size[1] * 0.5, 0] as [number, number, number],
} as const;
