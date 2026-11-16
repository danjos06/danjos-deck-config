import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useCursor } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import type { Group } from 'three';
import type { ClickMods } from '../deck/keySelection';
import { KEY, MM, PLATE } from './layout';
import { OledScreen } from './OledScreen';
import { createGlowMaterial, createRingMaterial, type DeckResources } from './resources';
import { useSpring1D } from './useSpring1D';

interface Keycap3DProps {
  res: DeckResources;
  index: number;
  x: number;
  y: number;
  bitmap: string;
  pageKey: string;
  direction: -1 | 0 | 1;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (index: number, mods: ClickMods) => void;
}

/** One raised keycap: PLA cap with recessed window, glass + OLED, hover glow, cyan rim when selected. */
export const Keycap3D = memo(function Keycap3D(p: Keycap3DProps) {
  const { res, index, selected, reducedMotion } = p;
  const press = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  useCursor(hovered);

  const ring = useMemo(() => createRingMaterial(res), [res]);
  const glow = useMemo(() => createGlowMaterial(res), [res]);
  useEffect(() => () => (ring.dispose(), glow.dispose()), [ring, glow]);

  const spring = useSpring1D(
    (v) => {
      if (press.current) press.current.position.z = -v * KEY.travel;
    },
    { stiffness: 900, damping: 24, reduced: reducedMotion },
  );

  const ringTarget = selected ? 0.95 : hovered ? 0.3 : 0;
  const glowTarget = selected ? 0.5 : hovered ? 0.16 : 0;
  useEffect(() => invalidate(), [ringTarget, glowTarget, invalidate]);
  useFrame((_, dt) => {
    const st = reducedMotion ? 0.01 : 0.12;
    const a = easing.damp(ring, 'opacity', ringTarget, st, dt);
    const b = easing.damp(glow, 'opacity', glowTarget, st, dt);
    if (a || b) invalidate();
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    spring.set(1);
  };
  const up = () => spring.set(0);

  return (
    <group position={[p.x, p.y, PLATE.top]}>
      <mesh geometry={res.geo.glow} material={glow} position-z={0.05 * MM} raycast={() => null} />
      <mesh geometry={res.geo.ring} material={ring} position-z={0.08 * MM} raycast={() => null} />
      <group
        ref={press}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          up();
        }}
        onPointerDown={down}
        onPointerUp={up}
        onClick={(e) => {
          e.stopPropagation();
          if (spring.state.current.x < 0.4) spring.kick(14);
          spring.set(0);
          p.onSelect(index, { shiftKey: e.nativeEvent.shiftKey, ctrlKey: e.nativeEvent.ctrlKey, metaKey: e.nativeEvent.metaKey });
        }}
      >
        <mesh geometry={res.geo.keycap} material={res.mat.key} castShadow />
        <group position={[0, KEY.windowY, KEY.height - KEY.glassDepth]}>
          <mesh geometry={res.geo.glass} material={res.mat.glass} />
          <OledScreen
            geometry={res.geo.oled}
            bitmap={p.bitmap}
            pageKey={p.pageKey}
            direction={p.direction}
            hovered={hovered || selected}
            reducedMotion={reducedMotion}
            z={0.06 * MM}
          />
          <mesh geometry={res.geo.glass} material={res.mat.glassLayer} position-z={0.35 * MM} raycast={() => null} />
        </group>
      </group>
    </group>
  );
});
