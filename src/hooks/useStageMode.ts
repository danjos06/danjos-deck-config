import { useCallback, useState } from 'react';

export type StageMode = '3d' | '2d';
const KEY = 'danjos_deck_v2.stage';

function read(): StageMode {
  try {
    return window.localStorage.getItem(KEY) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}

/** UI-only preference: 3D stage or the classic 2D drawing. Persisted in localStorage (best effort). */
export function useStageMode(): [StageMode, (m: StageMode) => void] {
  const [mode, setMode] = useState<StageMode>(read);
  const set = useCallback((m: StageMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(KEY, m);
    } catch {
      /* private mode / blocked storage: keep in memory only */
    }
  }, []);
  return [mode, set];
}
