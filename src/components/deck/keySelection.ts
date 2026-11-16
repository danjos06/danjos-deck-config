import { KEYS_PER_PAGE } from '@/core/constants';
import { selectionFromIndices, useUiStore, type Selection } from '@/store/uiStore';

export { selectionFromIndices };

export interface ClickMods {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Last plain/toggle-clicked key; the origin of Shift ranges. */
let anchor: number | null = null;

/** Test helper: forgets the Shift-range anchor. */
export function resetKeyAnchor(): void {
  anchor = null;
}

export function selectedKeyIndices(sel: Selection): number[] {
  if (!sel) return [];
  if (sel.kind === 'key') return [sel.index];
  if (sel.kind === 'keys') return sel.indices;
  return [];
}

export function isKeySelected(sel: Selection, index: number): boolean {
  return selectedKeyIndices(sel).includes(index);
}

/** Selects every key of the page. */
export function selectAllKeys(): void {
  anchor = 0;
  useUiStore.getState().select(selectionFromIndices(Array.from({ length: KEYS_PER_PAGE }, (_, i) => i)));
}

/** Plain click = single; Ctrl/Cmd click = toggle; Shift click = row-major range from the anchor. */
export function handleKeyClick(index: number, mods: ClickMods): void {
  const ui = useUiStore.getState();
  const current = selectedKeyIndices(ui.selection);
  if (mods.shiftKey && anchor !== null) {
    const [lo, hi] = anchor <= index ? [anchor, index] : [index, anchor];
    ui.select(selectionFromIndices(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)));
    return;
  }
  if (mods.ctrlKey || mods.metaKey) {
    anchor = index;
    const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index];
    ui.select(selectionFromIndices(next));
    return;
  }
  anchor = index;
  ui.select({ kind: 'key', index });
}
