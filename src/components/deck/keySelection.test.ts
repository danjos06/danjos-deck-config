import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/store/uiStore';
import { handleKeyClick, isKeySelected, resetKeyAnchor, selectAllKeys, selectedKeyIndices } from './keySelection';

const none = { shiftKey: false, ctrlKey: false, metaKey: false };
const ctrl = { ...none, ctrlKey: true };
const shift = { ...none, shiftKey: true };
const sel = () => useUiStore.getState().selection;

beforeEach(() => {
  useUiStore.setState({ selection: null });
  resetKeyAnchor();
});

describe('keySelection', () => {
  it('plain click selects a single key and replaces a multi-selection', () => {
    handleKeyClick(2, none);
    expect(sel()).toEqual({ kind: 'key', index: 2 });
    handleKeyClick(1, ctrl);
    handleKeyClick(4, none);
    expect(sel()).toEqual({ kind: 'key', index: 4 });
  });

  it('ctrl/meta click toggles; a key selection becomes keys', () => {
    handleKeyClick(0, none);
    handleKeyClick(3, ctrl);
    expect(sel()).toEqual({ kind: 'keys', indices: [0, 3] });
    handleKeyClick(1, { ...none, metaKey: true });
    expect(sel()).toEqual({ kind: 'keys', indices: [0, 1, 3] });
  });

  it('collapses to a single key (and to null) when toggling down', () => {
    handleKeyClick(0, none);
    handleKeyClick(1, ctrl);
    handleKeyClick(0, ctrl);
    expect(sel()).toEqual({ kind: 'key', index: 1 });
    handleKeyClick(1, ctrl);
    expect(sel()).toBeNull();
  });

  it('ctrl click from nothing / from an encoder starts a selection', () => {
    handleKeyClick(5, ctrl);
    expect(sel()).toEqual({ kind: 'key', index: 5 });
    useUiStore.setState({ selection: { kind: 'encoder', enc: 0, fn: 'cw' } });
    handleKeyClick(2, ctrl);
    expect(sel()).toEqual({ kind: 'key', index: 2 });
  });

  it('shift click selects a row-major range from the anchor, in either direction', () => {
    handleKeyClick(1, none);
    handleKeyClick(4, shift);
    expect(sel()).toEqual({ kind: 'keys', indices: [1, 2, 3, 4] });
    handleKeyClick(0, shift);
    expect(sel()).toEqual({ kind: 'keys', indices: [0, 1] });
    handleKeyClick(1, shift);
    expect(sel()).toEqual({ kind: 'key', index: 1 });
  });

  it('shift click without an anchor behaves like a plain click', () => {
    handleKeyClick(3, shift);
    expect(sel()).toEqual({ kind: 'key', index: 3 });
  });

  it('selectAllKeys selects the 6 keys', () => {
    selectAllKeys();
    expect(sel()).toEqual({ kind: 'keys', indices: [0, 1, 2, 3, 4, 5] });
  });

  it('select() normalizes keys selections', () => {
    useUiStore.getState().select({ kind: 'keys', indices: [3, 3] });
    expect(sel()).toEqual({ kind: 'key', index: 3 });
    useUiStore.getState().select({ kind: 'keys', indices: [] });
    expect(sel()).toBeNull();
    useUiStore.getState().select({ kind: 'keys', indices: [4, 1, 9] });
    expect(sel()).toEqual({ kind: 'keys', indices: [1, 4] });
  });

  it('isKeySelected / selectedKeyIndices cover every selection kind', () => {
    expect(selectedKeyIndices(null)).toEqual([]);
    expect(selectedKeyIndices({ kind: 'encoder', enc: 1, fn: 'sw' })).toEqual([]);
    expect(selectedKeyIndices({ kind: 'key', index: 2 })).toEqual([2]);
    expect(isKeySelected({ kind: 'keys', indices: [0, 5] }, 5)).toBe(true);
    expect(isKeySelected({ kind: 'keys', indices: [0, 5] }, 4)).toBe(false);
    expect(isKeySelected(null, 0)).toBe(false);
  });
});

describe('sync reopen logic', () => {
  it('openModal("sync") resets a finished sync but keeps probe and transport; leaves a running sync alone', () => {
    const probe = { ok: false as const, error: 'x' };
    useUiStore.setState({ sync: { status: 'error', transport: 'serial', progress: null, log: [{ at: 1, level: 'error', text: 'x' }], lastProbe: probe as never, error: 'x' } });
    useUiStore.getState().openModal('sync');
    const s = useUiStore.getState().sync;
    expect(s.status).toBe('idle');
    expect(s.transport).toBe('serial');
    expect(s.lastProbe).toBe(probe);
    expect(s.log).toEqual([]);
    useUiStore.setState({ sync: { ...s, status: 'syncing' } });
    useUiStore.getState().openModal('sync');
    expect(useUiStore.getState().sync.status).toBe('syncing');
  });
});
