import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface Spring1D {
  x: number;
  v: number;
  target: number;
}

/**
 * Tiny critically-damped-ish spring driven by useFrame. Calls `apply(x)` every frame while moving and
 * keeps invalidating the demand frameloop until it settles. `reduced` snaps instantly.
 */
export function useSpring1D(apply: (x: number) => void, opts: { stiffness?: number; damping?: number; reduced?: boolean } = {}) {
  const s = useRef<Spring1D>({ x: 0, v: 0, target: 0 });
  const invalidate = useThree((st) => st.invalidate);
  const k = opts.stiffness ?? 700;
  const c = opts.damping ?? 26;
  useFrame((_, delta) => {
    const sp = s.current;
    if (Math.abs(sp.x - sp.target) < 1e-4 && Math.abs(sp.v) < 1e-3) {
      if (sp.x !== sp.target) {
        sp.x = sp.target;
        sp.v = 0;
        apply(sp.x);
      }
      return;
    }
    if (opts.reduced) {
      sp.x = sp.target;
      sp.v = 0;
    } else {
      const dt = Math.min(delta, 1 / 30);
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const h = dt / steps;
        const a = -k * (sp.x - sp.target) - c * sp.v;
        sp.v += a * h;
        sp.x += sp.v * h;
      }
    }
    apply(sp.x);
    invalidate();
  });
  return {
    set(target: number) {
      s.current.target = target;
      invalidate();
    },
    kick(velocity: number) {
      s.current.v += velocity;
      invalidate();
    },
    state: s,
  };
}
