import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useCursor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import type { Group } from 'three';
import { MM, NAV, PLATE } from './layout';
import { createGlowMaterial, type DeckResources } from './resources';
import { useSpring1D } from './useSpring1D';

interface NavKey3DProps {
  res: DeckResources;
  dir: 1 | -1;
  x: number;
  y: number;
  disabled: boolean;
  reducedMotion: boolean;
  onPress: (dir: 1 | -1) => void;
}

/** Small square nav key with a round domed top and a printed chevron ("<" prev, ">" next). */
export const NavKey3D = memo(function NavKey3D({ res, dir, x, y, disabled, reducedMotion, onPress }: NavKey3DProps) {
  const press = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  useCursor(hovered && !disabled);
  const glow = useMemo(() => createGlowMaterial(res), [res]);
  useEffect(() => () => glow.dispose(), [glow]);

  const spring = useSpring1D(
    (v) => {
      if (press.current) press.current.position.z = -v * NAV.travel;
    },
    { stiffness: 1000, damping: 26, reduced: reducedMotion },
  );

  const target = hovered && !disabled ? 0.28 : 0;
  useEffect(() => invalidate(), [target, invalidate]);
  useFrame((_, dt) => {
    if (easing.damp(glow, 'opacity', target, reducedMotion ? 0.01 : 0.1, dt)) invalidate();
  });

  return (
    <group position={[x, y, PLATE.top]}>
      <mesh geometry={res.geo.glow} material={glow} position-z={0.05 * MM} scale={0.62} raycast={() => null} />
      <group
        ref={press}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          spring.set(0);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) spring.set(1);
        }}
        onPointerUp={() => spring.set(0)}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (spring.state.current.x < 0.4) spring.kick(16);
          spring.set(0);
          onPress(dir);
        }}
      >
        <mesh geometry={res.geo.navBase} material={res.mat.key} castShadow />
        <mesh geometry={res.geo.navDome} material={res.mat.key} position-z={NAV.height} castShadow />
        <mesh
          geometry={dir === 1 ? res.geo.chevronR : res.geo.chevronL}
          material={res.mat.chevron}
          position-z={NAV.height + NAV.domeH + 0.15 * MM}
          raycast={() => null}
        />
      </group>
    </group>
  );
});
