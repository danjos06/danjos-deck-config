import { useCallback, useEffect, useRef } from 'react';

/** Returns a stable function that coalesces calls to once per animation frame (latest args win). */
export function useRafThrottle<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const raf = useRef(0);
  const last = useRef<A | null>(null);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return useCallback((...args: A) => {
    last.current = args;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const a = last.current;
      last.current = null;
      if (a) fnRef.current(...a);
    });
  }, []);
}
