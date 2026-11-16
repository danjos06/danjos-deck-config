import { lazy, Suspense, useEffect, useState } from 'react';
import { useUiStore, type ModalId } from '@/store/uiStore';

const PinoutModal = lazy(() => import('./pinout/PinoutModal').then((m) => ({ default: m.PinoutModal })));
const ExportModal = lazy(() => import('./export/ExportModal').then((m) => ({ default: m.ExportModal })));
const SyncModal = lazy(() => import('./sync/SyncModal').then((m) => ({ default: m.SyncModal })));

/** Mounts each modal on first open (code-split) and keeps it mounted so exit animations play. */
export function ModalHost() {
  const modal = useUiStore((s) => s.modal);
  const [seen, setSeen] = useState<Set<Exclude<ModalId, null>>>(new Set());

  useEffect(() => {
    if (modal && !seen.has(modal)) setSeen((s) => new Set(s).add(modal));
  }, [modal, seen]);

  return (
    <Suspense fallback={null}>
      {seen.has('pinout') && <PinoutModal />}
      {seen.has('export') && <ExportModal />}
      {seen.has('sync') && <SyncModal />}
    </Suspense>
  );
}
