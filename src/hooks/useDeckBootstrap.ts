import { useEffect } from 'react';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';

/** Initialises the current page, repairs it when the page disappears, renders missing bitmaps. */
export function useDeckBootstrap(): void {
  useEffect(() => {
    const fix = () => {
      const pages = useDeckStore.getState().config.pages;
      const ui = useUiStore.getState();
      if (!pages.some((p) => p.id === ui.currentPageId)) ui.setCurrentPage(pages[0].id, 0);
    };
    fix();
    void useDeckStore.getState().ensureBitmaps();
    return useDeckStore.subscribe(fix);
  }, []);
}
