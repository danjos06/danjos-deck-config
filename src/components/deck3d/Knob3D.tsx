import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import type { Group, Mesh } from 'three';
import type { EncoderFn } from '@/core/types';
import { useFocusStore } from './focusStore';
import { KNOB_MOUNT, MM } from './layout';
import { createHaloMaterial, type DeckResources } from './resources';
import { useSpring1D } from './useSpring1D';

export const KNOB_URL = `${import.meta.env.BASE_URL}models/knob.glb`;

const DETENT = (Math.PI * 2) / 20; // 20 detents per turn
const DRAG_RAD_PER_PX = 0.014;
const WHEEL_PX_PER_DETENT = 40;
/** Hover affordance: halo strength, pulse depth and scale-up. */
const HOVER = { halo: 0.5, pulse: 0.16, scale: 0.02, haloScale: 1.05 };

interface Knob3DProps {
  res: DeckResources;
  enc: 0 | 1;
  disabled: boolean;
  swEnabled: boolean;
  reducedMotion: boolean;
  onTurn: (enc: 0 | 1, fn: EncoderFn) => void;
  onPush: (enc: 0 | 1) => void;
  onDisabledClick: () => void;
}

/**
 * Knurled knob mounted on a side wall (axis = +-X). Wheel or vertical drag turns it with inertia and
 * 20 detents; each detent reports CW/CCW. A click without dragging pushes it (SW).
 */
export const Knob3D = memo(function Knob3D({ res, enc, disabled, swEnabled, reducedMotion, onTurn, onPush, onDisabledClick }: Knob3DProps) {
  const { nodes } = useGLTF(KNOB_URL, false, true);
  const node = nodes.Knob as Mesh;
  const side = enc === 0 ? -1 : 1;
  const spin = useRef<Group>(null);
  const axial = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [hovered, setHovered] = useState(false);
  const legendHover = useFocusStore((s) => s.hoverKnob === enc);
  const halo = useMemo(() => createHaloMaterial(res), [res]);
  useEffect(() => () => halo.dispose(), [halo]);
  const glowTarget = hovered || legendHover ? 1 : 0;
  const glow = useRef(0);
  useEffect(() => invalidate(), [glowTarget, invalidate]);
  const setActive = useFocusStore((s) => s.setActiveKnob);
  const m = useRef({ angle: 0, target: 0, lastIdx: 0, wheelAcc: 0, restAt: 0 });
  const drag = useRef<{ lastY: number; moved: number; lastT: number; vel: number } | null>(null);

  const push = useSpring1D(
    (v) => {
      if (axial.current) axial.current.position.y = -v * 1.6 * MM;
    },
    { stiffness: 900, damping: 24, reduced: reducedMotion },
  );

  useFrame((state, delta) => {
    // Soft cyan rim pulse + ~2% scale-up, eased in and out (no camera movement involved).
    const gs = { v: glow.current };
    const moving = easing.damp(gs, 'v', glowTarget, reducedMotion ? 0.01 : 0.14, delta);
    glow.current = gs.v;
    const pulse = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 4.2) * HOVER.pulse;
    halo.opacity = glow.current * (HOVER.halo * (1 - HOVER.pulse) + HOVER.halo * pulse);
    axial.current?.scale.setScalar(1 + HOVER.scale * glow.current);
    if (moving || (glowTarget > 0 && !reducedMotion)) invalidate();

    const s = m.current;
    const dt = Math.min(delta, 1 / 30);
    if (!drag.current) {
      const diff = s.target - s.angle;
      if (Math.abs(diff) > 1e-4) {
        s.angle = reducedMotion ? s.target : s.angle + diff * (1 - Math.exp(-dt * 16));
        invalidate();
      } else if (s.angle !== s.target) {
        s.angle = s.target;
      }
    }
    const idx = Math.round(s.angle / DETENT);
    if (idx !== s.lastIdx) {
      onTurn(enc, idx > s.lastIdx ? 'cw' : 'ccw');
      s.lastIdx = idx;
      s.restAt = performance.now();
    }
    if (spin.current) spin.current.rotation.y = -s.angle;
    if (useFocusStore.getState().activeKnob === enc && !drag.current && Math.abs(s.target - s.angle) < 1e-3 && performance.now() - s.restAt > 700) {
      setActive(null);
    }
  });

  const begin = () => {
    setActive(enc);
    m.current.restAt = performance.now();
    invalidate();
  };

  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    if (disabled) return;
    const s = m.current;
    s.wheelAcc += e.deltaY;
    const steps = Math.trunc(s.wheelAcc / WHEEL_PX_PER_DETENT) || (Math.abs(e.deltaY) >= 1 && Math.abs(s.wheelAcc) >= 4 ? Math.sign(s.wheelAcc) : 0);
    if (!steps) return;
    s.wheelAcc = 0;
    s.target = Math.round(s.target / DETENT) * DETENT + steps * DETENT;
    begin();
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (disabled) return;
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    drag.current = { lastY: e.clientY, moved: 0, lastT: performance.now(), vel: 0 };
    begin();
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.lastY;
    const now = performance.now();
    const da = -side * dy * DRAG_RAD_PER_PX;
    d.vel = da / Math.max((now - d.lastT) / 1000, 1 / 240);
    d.lastY = e.clientY;
    d.lastT = now;
    d.moved += Math.abs(dy);
    m.current.angle += da;
    m.current.target = m.current.angle;
    m.current.restAt = now;
    invalidate();
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    if (d.moved < 4) {
      m.current.target = Math.round(m.current.angle / DETENT) * DETENT;
      push.kick(16);
      if (swEnabled) onPush(enc);
      else onTurn(enc, 'cw');
      return;
    }
    const carry = reducedMotion || performance.now() - d.lastT > 80 ? 0 : d.vel * 0.16;
    m.current.target = Math.round((m.current.angle + carry) / DETENT) * DETENT;
    invalidate();
  };

  const x = side * (KNOB_MOUNT.wallX + KNOB_MOUNT.gap);
  return (
    <group position={[x, KNOB_MOUNT.axisY, KNOB_MOUNT.axisZ]} rotation-z={-side * (Math.PI / 2)}>
      {/* shaft + nut visible in the gap between wall and knob */}
      <mesh position-y={-KNOB_MOUNT.gap / 2} material={res.mat.shaft} raycast={() => null}>
        <cylinderGeometry args={[KNOB_MOUNT.shaftR, KNOB_MOUNT.shaftR, KNOB_MOUNT.gap + 0.4 * MM, 20]} />
      </mesh>
      <mesh position-y={-KNOB_MOUNT.gap + 0.9 * MM} material={res.mat.shaft} raycast={() => null}>
        <cylinderGeometry args={[KNOB_MOUNT.shaftR * 2.1, KNOB_MOUNT.shaftR * 2.1, 1.8 * MM, 6]} />
      </mesh>
      <group ref={axial}>
        <group
          ref={spin}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = disabled ? 'pointer' : 'grab';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = '';
          }}
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) onDisabledClick();
          }}
        >
          <mesh
            geometry={node.geometry}
            position={node.position}
            quaternion={node.quaternion}
            scale={node.scale}
            material={disabled ? res.mat.knobDisabled : res.mat.knob}
            castShadow
          />
          <mesh
            geometry={node.geometry}
            position={node.position}
            quaternion={node.quaternion}
            scale={node.scale.clone().multiplyScalar(HOVER.haloScale)}
            material={halo}
            raycast={() => null}
          />
        </group>
      </group>
    </group>
  );
});

useGLTF.preload(KNOB_URL, false, true);
