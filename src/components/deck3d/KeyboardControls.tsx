import { actionSummary } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { handleKeyClick, isKeySelected } from '../deck/keySelection';
import { canNavigate, navTarget } from '../deck/pageNav';

/**
 * Keyboard / screen-reader access to the 3D deck (the canvas itself is not focusable).
 * Visually hidden until one of its buttons receives focus.
 */
export function KeyboardControls() {
  const pages = useDeckStore((s) => s.config.pages);
  const currentId = useUiStore((s) => s.currentPageId);
  const selection = useUiStore((s) => s.selection);
  const setPage = useUiStore((s) => s.setCurrentPage);
  const page = pages.find((p) => p.id === currentId) ?? pages[0];
  const go = (step: 1 | -1) => {
    const t = navTarget(pages, currentId, step);
    if (t) setPage(t.id, step);
  };
  const btn =
    'rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-[11px] text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 aria-pressed:border-accent/60 aria-pressed:text-fg';
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-3 focus-within:top-3 focus-within:z-20 focus-within:flex focus-within:max-w-[calc(100%-1.5rem)] focus-within:flex-wrap focus-within:gap-1 focus-within:rounded-lg focus-within:bg-ink-900/90 focus-within:p-1.5 focus-within:shadow-pop">
      <button type="button" className={btn} disabled={!canNavigate(pages, currentId)} onClick={() => go(-1)}>
        ‹ Página anterior
      </button>
      {page?.keys.map((k, i) => (
        <button
          key={k.id}
          type="button"
          className={btn}
          aria-pressed={isKeySelected(selection, i)}
          onClick={(e) => handleKeyClick(i, e)}
        >
          Tecla {i + 1}: {k.name || actionSummary(k.action, pages)}
        </button>
      ))}
      <button type="button" className={btn} disabled={!canNavigate(pages, currentId)} onClick={() => go(1)}>
        Próxima página ›
      </button>
    </div>
  );
}
