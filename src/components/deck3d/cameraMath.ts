/** Pure camera helpers (no three.js), unit-testable. */

export const DEG = Math.PI / 180;

export interface Damper {
  value: number;
  velocity: number;
}

/**
 * Exact critically damped spring step (no overshoot from rest, velocity is kept when the goal changes,
 * so rapid retargeting stays smooth). Returns true while still moving.
 */
export function smoothDamp(d: Damper, target: number, omega: number, dt: number): boolean {
  const x = d.value - target;
  const e = Math.exp(-omega * dt);
  const tmp = (d.velocity + omega * x) * dt;
  d.velocity = (d.velocity - omega * tmp) * e;
  d.value = target + (x + tmp) * e;
  if (Math.abs(d.value - target) < 1e-4 && Math.abs(d.velocity) < 1e-3) {
    d.value = target;
    d.velocity = 0;
    return false;
  }
  return true;
}

export interface Viewport {
  /** Vertical field of view in degrees. */
  fov: number;
  /** Canvas width / height. */
  aspect: number;
  /** Fraction of the canvas height not covered by overlay chrome (0..1]. */
  usableH: number;
}

/** Distance at which a flat box of half extents (hw, hh), facing the camera, fits the usable canvas rect. */
export function fitDistance(v: Viewport, hw: number, hh: number): number {
  const tanV = Math.tan((v.fov * DEG) / 2);
  return Math.max(hw / (tanV * v.aspect), hh / (tanV * v.usableH));
}

export interface Box3Half {
  w: number;
  h: number;
  d: number;
}

/**
 * Distance to frame a box (half extents) seen with `yaw` and `pitch` (radians): projected silhouette
 * half extents plus the half depth along the view axis, so the nearest face still fits.
 */
export function fitBox(v: Viewport, box: Box3Half, yaw: number, pitch: number, margin: number, shiftX = 0): number {
  const cy = Math.abs(Math.cos(yaw));
  const sy = Math.abs(Math.sin(yaw));
  const cp = Math.abs(Math.cos(pitch));
  const sp = Math.abs(Math.sin(pitch));
  const hw = box.w * cy + box.d * sy + Math.abs(shiftX) * cy;
  const depth = box.w * sy + box.d * cy;
  const hh = box.h * cp + depth * sp;
  return fitDistance(v, hw * margin, hh * margin) + depth * cp;
}
