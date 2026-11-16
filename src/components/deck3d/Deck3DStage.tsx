import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useElementSize } from '@/hooks/useElementSize';
import { cn } from '@/lib/ui/cn';
import { useUiStore } from '@/store/uiStore';
import { StageSkeleton } from '../deck/StageSkeleton';
import { DeckModel } from './DeckModel';
import { EncoderLegend } from './EncoderLegend';
import { useFocusStore } from './focusStore';
import { KeyboardControls } from './KeyboardControls';
import { createPalette } from './palette';
import { StudioLighting } from './StudioLighting';

/** Stage width from which the encoder legends dock at the sides instead of below the canvas. */
const SIDE_LEGENDS_MIN_W = 1080;

/** Real-time 3D centre stage (lazy chunk). Encoder legends are docked HTML so they never overlap the model. */
export default function Deck3DStage() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const reduced = useReducedMotion() ?? false;
  const [ready, setReady] = useState(false);
  const select = useUiStore((s) => s.select);
  const ping = useFocusStore((s) => s.ping);
  const palette = useMemo(createPalette, []);
  const lastPing = useRef(0);
  const onReady = useCallback(() => setReady(true), []);
  const sideLegends = size.width >= SIDE_LEGENDS_MIN_W;
  /** Below the canvas, chips go side by side only when each legend has room for readable summaries. */
  const rowChips = !sideLegends && size.width >= 880;

  const onActivity = () => {
    const now = performance.now();
    if (now - lastPing.current > 250) {
      lastPing.current = now;
      ping();
    }
  };

  const canvas = (
    <div className="relative z-0 h-full min-h-0 min-w-0 self-stretch overflow-hidden [grid-area:c]" onPointerMove={onActivity} onPointerDown={onActivity} onWheel={onActivity}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, position: [0.6, 0.7, 3.2] }}
        className="touch-none"
        role="img"
        aria-label="Modelo 3D do Danjos Deck: clique nas teclas para editar, gire os knobs com a roda do mouse"
        onPointerMissed={() => {
          // A knob drag released outside the knob also produces a "missed" click: ignore it.
          if (useFocusStore.getState().activeKnob === null) select(null);
        }}
      >
        <Suspense fallback={null}>
          <StudioLighting palette={palette} />
          <DeckModel onReady={onReady} />
        </Suspense>
      </Canvas>
      <AnimatePresence>
        {!ready && (
          <motion.div key="skeleton" className="absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.4 } }}>
            <StageSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
      <KeyboardControls />
    </div>
  );

  // Fixed child order (canvas first) + grid areas, so switching layouts never remounts the WebGL canvas.
  return (
    <div
      ref={ref}
      style={{
        gridTemplateAreas: sideLegends ? '"l c r"' : '"c c" "l r"',
        gridTemplateColumns: sideLegends ? 'clamp(170px,15%,220px) minmax(0,1fr) clamp(170px,15%,220px)' : 'minmax(0,1fr) minmax(0,1fr)',
        gridTemplateRows: sideLegends ? 'minmax(0,1fr)' : 'minmax(0,1fr) auto',
      }}
      className={cn('grid h-full min-h-0 w-full min-w-0', sideLegends ? 'items-center gap-x-2 px-4' : 'gap-x-3 px-3 pb-3')}
    >
      {canvas}
      <EncoderLegend enc={0} row={rowChips} className="[grid-area:l]" />
      <EncoderLegend enc={1} row={rowChips} className="[grid-area:r]" />
    </div>
  );
}
