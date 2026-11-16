import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { type StageMode, useStageMode } from '@/hooks/useStageMode';
import { hasWebGL } from '@/lib/ui/webgl';
import { useUiStore } from '@/store/uiStore';
import { type ViewLock, useFocusStore } from '../deck3d/focusStore';
import { SegmentedControl } from '../ui';
import { Device2DStage } from './Device2DStage';
import { StageErrorBoundary } from './StageErrorBoundary';
import { StageSkeleton } from './StageSkeleton';

const Deck3DStage = lazy(() => import('../deck3d/Deck3DStage'));

function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

/**
 * Centre stage: real-time 3D deck (lazy chunk) or the classic 2D drawing. Falls back to 2D
 * automatically when WebGL is missing or the 3D stage throws. "Vista" locks the 3D camera to the front (F).
 */
export function DeckStage() {
  const [mode, setMode] = useStageMode();
  const webgl = useMemo(hasWebGL, []);
  const [failed, setFailed] = useState(false);
  const viewLock = useFocusStore((s) => s.viewLock);
  const setViewLock = useFocusStore((s) => s.setViewLock);
  const can3d = webgl && !failed;
  const show3d = mode === '3d' && can3d;

  useEffect(() => {
    if (!show3d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (useUiStore.getState().modal || document.querySelector('[data-overlay]')) return;
      const s = useFocusStore.getState();
      s.setViewLock(s.viewLock === 'front' ? 'free' : 'front');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show3d]);

  return (
    <div className="bg-stage relative h-full min-h-0 w-full min-w-0 overflow-hidden">
      {show3d ? (
        <StageErrorBoundary onError={() => setFailed(true)}>
          <Suspense fallback={<StageSkeleton />}>
            <Deck3DStage />
          </Suspense>
        </StageErrorBoundary>
      ) : (
        <Device2DStage />
      )}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center justify-end gap-2">
        {mode === '3d' && !can3d && (
          <span className="rounded-md bg-ink-900/80 px-2 py-1 text-[11px] text-fg-dim" role="note">
            3D indisponível neste navegador
          </span>
        )}
        {show3d && (
          <div className="flex items-center gap-1.5 rounded-lg bg-ink-950/70 pl-2 backdrop-blur">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">Vista</span>
            <SegmentedControl<ViewLock>
              label="Vista da câmera (atalho F)"
              size="sm"
              className="!w-[120px] bg-transparent"
              value={viewLock}
              onChange={setViewLock}
              options={[
                { value: 'free', label: 'Livre', title: 'Câmera livre: vista 3/4; foca ao selecionar teclas ou knobs (F)' },
                { value: 'front', label: 'Frente', title: 'Travar a vista frontal reta e centralizada (F)' },
              ]}
            />
          </div>
        )}
        <SegmentedControl<StageMode>
          label="Visualização do dispositivo"
          size="sm"
          className="!w-[96px] bg-ink-950/80 backdrop-blur"
          value={show3d ? '3d' : '2d'}
          onChange={setMode}
          options={[
            { value: '3d', label: '3D', disabled: !can3d, title: can3d ? 'Modelo 3D em tempo real' : 'WebGL indisponível' },
            { value: '2d', label: '2D', title: 'Desenho 2D clássico' },
          ]}
        />
      </div>
    </div>
  );
}
