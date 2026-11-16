import { useEffect } from 'react';
import { useDeckStore } from '@/store/deckStore';
import { selectAllKeys, selectedKeyIndices } from '@/components/deck/keySelection';
import { useUiStore } from '@/store/uiStore';

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

/** Global keyboard shortcuts: arrows = pages, Ctrl+A = select all keys, Delete = clear selected keys, Esc = deselect, Ctrl+S sync, Ctrl+E export. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        ui.openModal('sync');
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        ui.openModal('export');
        return;
      }
      if (e.altKey || e.defaultPrevented) return;
      if (ui.modal || isTyping(e.target) || document.querySelector('[data-overlay]')) return;
      if (mod && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAllKeys();
        return;
      }
      if (mod) return;

      if (e.key === 'Escape') {
        if (ui.selection) ui.select(null);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const pages = useDeckStore.getState().config.pages.filter((p) => !p.isFolder);
        const idx = pages.findIndex((p) => p.id === ui.currentPageId);
        if (idx < 0 || pages.length < 2) return;
        const step = e.key === 'ArrowRight' ? 1 : -1;
        e.preventDefault();
        ui.setCurrentPage(pages[(idx + step + pages.length) % pages.length].id, step);
        return;
      }
      if (e.key === 'Delete') {
        const indices = selectedKeyIndices(ui.selection);
        if (indices.length === 0) return;
        e.preventDefault();
        for (const i of indices) useDeckStore.getState().clearKey(ui.currentPageId, i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
