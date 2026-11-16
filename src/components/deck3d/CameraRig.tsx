import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type PerspectiveCamera, Vector3 } from 'three';
import { useUiStore } from '@/store/uiStore';
import { type Box3Half, DEG, type Damper, fitBox, fitDistance, smoothDamp, type Viewport } from './cameraMath';
import { useFocusStore } from './focusStore';
import { DEVICE_BOUNDS, FACE, KEY, KEY_POSITIONS, KNOB_MOUNT, NAV, NAV_ROW_Y, PLATE } from './layout';
import type { DeckResources } from './resources';

/** Hero: yaw only (no roll, level horizon), slightly above, looking at the device centre. */
const HERO = { yaw: 24 * DEG, pitch: 11 * DEG, margin: 1.16 };
/** Knob side turns: more yaw towards that knob, low pitch. */
const SIDE = { yaw: 46 * DEG, pitch: 9 * DEG, margin: 1.16, shift: 0.1 };
/** Overlay chrome (view / 2D-3D toggles) at the top of the stage that the framing keeps clear. */
const TOP_RESERVE_PX = 46;
/** Spring rate: critically damped, ~98% settled in ~700 ms. */
const OMEGA = 8.4;
const IDLE_AFTER_MS = 2600;
const IDLE_YAW = 1.1 * DEG;

export type CameraMode = 'hero' | 'focus' | 'encoder-left' | 'encoder-right';

const N = new Vector3(0, -Math.sin(FACE.tiltX), Math.cos(FACE.tiltX));
const UP = new Vector3(0, Math.cos(FACE.tiltX), Math.sin(FACE.tiltX));
const FACE_EL = Math.asin(N.y);
const ORIGIN = new Vector3(...FACE.origin);
const facePoint = (y: number, z: number) => ORIGIN.clone().addScaledVector(UP, y).addScaledVector(N, z);

/** What the straight frontal view must frame: 6 OLED keys + both nav keys (face-local metres). */
const FRAME_TOP = KEY_POSITIONS[0][1] + KEY.h / 2;
const FRAME_BOTTOM = NAV_ROW_Y - NAV.size / 2;
const FRAME_CY = (FRAME_TOP + FRAME_BOTTOM) / 2;
const FRAME_HALF = { w: Math.max(KEY.pitchX + KEY.w / 2, NAV.x + NAV.size / 2), h: (FRAME_TOP - FRAME_BOTTOM) / 2 };
const FOCUS_MARGIN = { w: 1.32, h: 1.26 };
const KNOB_MARGIN = 1.08;

const DEVICE_BOX: Box3Half = { w: DEVICE_BOUNDS.halfW, h: DEVICE_BOUNDS.height / 2, d: DEVICE_BOUNDS.halfD };

/** The one place that decides the camera mode: selection / knob activity, never hover. */
function resolveMode(): CameraMode {
  const f = useFocusStore.getState();
  const sel = useUiStore.getState().selection;
  const k = f.activeKnob ?? (sel?.kind === 'encoder' ? sel.enc : null);
  if (k !== null) return k === 0 ? 'encoder-left' : 'encoder-right';
  if (sel?.kind === 'key' || sel?.kind === 'keys') return 'focus';
  if (f.viewLock === 'front') return 'focus';
  return 'hero';
}

interface Goal {
  yaw: number;
  pitch: number;
  dist: number;
  target: Vector3;
}

function computeGoal(mode: CameraMode, vp: Viewport, out: Goal): void {
  if (mode === 'focus') {
    // Straight frontal: camera on the face normal, through the centre of the keys + nav row. No yaw, no bias.
    out.yaw = 0;
    out.pitch = FACE_EL;
    // Width also keeps both knobs in frame (they stick out past the keys), so the whole device is visible.
    const hw = Math.max(FRAME_HALF.w * FOCUS_MARGIN.w, DEVICE_BOUNDS.halfW * KNOB_MARGIN);
    out.dist = fitDistance(vp, hw, FRAME_HALF.h * FOCUS_MARGIN.h) + KEY.height;
    out.target.copy(facePoint(FRAME_CY, PLATE.top + KEY.height));
  } else if (mode === 'hero') {
    out.yaw = HERO.yaw;
    out.pitch = HERO.pitch;
    out.dist = fitBox(vp, DEVICE_BOX, HERO.yaw, HERO.pitch, HERO.margin);
    out.target.set(...DEVICE_BOUNDS.center);
  } else {
    const side = mode === 'encoder-left' ? -1 : 1;
    const shift = side * SIDE.shift * DEVICE_BOUNDS.halfW;
    out.yaw = side * SIDE.yaw;
    out.pitch = SIDE.pitch;
    out.dist = fitBox(vp, DEVICE_BOX, out.yaw, SIDE.pitch, SIDE.margin, shift);
    out.target.set(shift, Math.min(DEVICE_BOUNDS.center[1], KNOB_MOUNT.axisY * 1.2), 0);
  }
}

const DAMPERS = ['yaw', 'pitch', 'dist', 'x', 'y', 'z'] as const;
type DamperKey = (typeof DAMPERS)[number];

/**
 * Camera rig: one critically damped spring (yaw, pitch, distance, target) for every view change, so
 * moves take a consistent ~700 ms, never overshoot and keep their velocity on quick re-targeting.
 * The camera only ever yaws and pitches around a level target (up = +Y), so there is never any roll.
 * Hover does not move it: only selection, knob activity and the view lock do.
 */
export function CameraRig({ res, reducedMotion }: { res: DeckResources; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const d = useRef<Record<DamperKey, Damper>>({
    yaw: { value: HERO.yaw, velocity: 0 },
    pitch: { value: HERO.pitch, velocity: 0 },
    dist: { value: 3, velocity: 0 },
    x: { value: DEVICE_BOUNDS.center[0], velocity: 0 },
    y: { value: DEVICE_BOUNDS.center[1], velocity: 0 },
    z: { value: DEVICE_BOUNDS.center[2], velocity: 0 },
  });
  const goal = useRef<Goal>({ yaw: 0, pitch: 0, dist: 3, target: new Vector3() });
  const idleW = useRef<Damper>({ value: 0, velocity: 0 });
  const frontness = useRef<Damper>({ value: 0, velocity: 0 });
  const first = useRef(true);
  const lookAt = useRef(new Vector3());

  // Lens + the strip of the canvas kept free for the overlay controls.
  const usableH = Math.max(0.5, 1 - TOP_RESERVE_PX / Math.max(size.height, 1));
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    camera.fov = aspect < 1 ? 36 : aspect < 1.5 ? 30 : 27;
    camera.near = 0.05;
    camera.far = 50;
    camera.up.set(0, 1, 0);
    camera.aspect = aspect;
    // Shift the picture down by half the reserved strip so the usable rect (below it) is the framed one.
    const shift = (size.height * (1 - usableH)) / 2;
    camera.setViewOffset(size.width, size.height, 0, -shift, size.width, size.height);
    camera.updateProjectionMatrix();
    first.current = true;
    invalidate();
  }, [size.width, size.height, usableH, camera, invalidate]);

  useEffect(() => () => camera.clearViewOffset(), [camera]);

  // Wake the demand frameloop on state changes, and once the idle period has elapsed.
  useEffect(() => {
    let timer = window.setTimeout(invalidate, IDLE_AFTER_MS + 50);
    const a = useUiStore.subscribe(() => invalidate());
    const b = useFocusStore.subscribe(() => {
      invalidate();
      window.clearTimeout(timer);
      timer = window.setTimeout(invalidate, IDLE_AFTER_MS + 50);
    });
    return () => {
      a();
      b();
      window.clearTimeout(timer);
    };
  }, [invalidate]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const mode = resolveMode();
    const g = goal.current;
    const vp: Viewport = { fov: camera.fov, aspect: size.width / Math.max(size.height, 1), usableH };
    computeGoal(mode, vp, g);

    const s = d.current;
    if (first.current) {
      first.current = false;
      s.yaw.value = g.yaw;
      s.pitch.value = g.pitch;
      s.dist.value = g.dist;
      s.x.value = g.target.x;
      s.y.value = g.target.y;
      s.z.value = g.target.z;
      for (const k of DAMPERS) s[k].velocity = 0;
    }
    const w = reducedMotion ? 400 : OMEGA;
    const moving = [
      smoothDamp(s.yaw, g.yaw, w, dt),
      smoothDamp(s.pitch, g.pitch, w, dt),
      smoothDamp(s.dist, g.dist, w, dt),
      smoothDamp(s.x, g.target.x, w, dt),
      smoothDamp(s.y, g.target.y, w, dt),
      smoothDamp(s.z, g.target.z, w, dt),
    ].some(Boolean);

    // Readability: no glass reflections and calmer face specular when looking straight at the keys.
    const fm = smoothDamp(frontness.current, mode === 'focus' ? 1 : 0, reducedMotion ? 400 : 10, dt);
    const f = frontness.current.value;
    res.mat.glassLayer.opacity = 0.14 * (1 - f);
    res.mat.glassLayer.visible = f < 0.99;
    res.mat.plate.envMapIntensity = 0.9 - 0.45 * f;
    res.mat.key.envMapIntensity = 0.85 - 0.45 * f;

    // Idle breathing (hero only, yaw only, tiny): fades in after a quiet period; never with reduced motion.
    const quiet = performance.now() - useFocusStore.getState().lastInteraction > IDLE_AFTER_MS;
    const wantIdle = !reducedMotion && mode === 'hero' && quiet && !moving;
    const im = smoothDamp(idleW.current, wantIdle ? 1 : 0, wantIdle ? 1.4 : 6, dt);
    const iw = idleW.current.value;
    const yaw = s.yaw.value + iw * Math.sin(state.clock.elapsedTime * 0.3) * IDLE_YAW;
    const pitch = s.pitch.value;
    const dist = s.dist.value;

    lookAt.current.set(s.x.value, s.y.value, s.z.value);
    camera.up.set(0, 1, 0);
    camera.position.set(
      lookAt.current.x + dist * Math.cos(pitch) * Math.sin(yaw),
      lookAt.current.y + dist * Math.sin(pitch),
      lookAt.current.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(lookAt.current);
    if (moving || fm || im || iw > 0.001 || wantIdle) invalidate();
  });

  return null;
}
