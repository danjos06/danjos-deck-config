import { create } from 'zustand';
import { KEYS_PER_PAGE } from '@/core/constants';
import type { SyncProgress } from '@/core/protocol/sync';
import type { ProbeResult } from '@/core/protocol/wifi';
import type { EncoderFn } from '@/core/types';

export type Selection =
  | { kind: 'key'; index: number }
  /** Only used with 2+ keys selected; a single key collapses to 'key'. Sorted ascending. */
  | { kind: 'keys'; indices: number[] }
  | { kind: 'encoder'; enc: 0 | 1; fn: EncoderFn }
  | null;

/** Builds a Selection from key indices: none -> null, one -> 'key', 2+ -> 'keys' (sorted, deduped, 0..5). */
export function selectionFromIndices(indices: readonly number[]): Selection {
  const uniq = [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < KEYS_PER_PAGE).sort((a, b) => a - b);
  if (uniq.length === 0) return null;
  if (uniq.length === 1) return { kind: 'key', index: uniq[0] };
  return { kind: 'keys', indices: uniq };
}

export type InspectorTab = 'appearance' | 'action';
export type ModalId = 'pinout' | 'export' | 'sync' | null;
export type SyncPhase = 'idle' | 'testing' | 'syncing' | 'success' | 'error';
export type SyncTransportKind = 'wifi' | 'serial';

export interface SyncLogEntry {
  at: number;
  level: 'info' | 'error' | 'tx' | 'rx';
  text: string;
}

export interface SyncState {
  status: SyncPhase;
  transport: SyncTransportKind;
  progress: SyncProgress | null;
  log: SyncLogEntry[];
  lastProbe: ProbeResult | null;
  error: string | null;
}

const MAX_LOG = 500;

const TRANSPORT_KEY = 'danjos_deck_v2.syncTransport';

function readTransport(): SyncTransportKind {
  try {
    return window.localStorage.getItem(TRANSPORT_KEY) === 'serial' ? 'serial' : 'wifi';
  } catch {
    return 'wifi';
  }
}

function writeTransport(t: SyncTransportKind): void {
  try {
    window.localStorage.setItem(TRANSPORT_KEY, t);
  } catch {
    /* private mode / blocked storage: keep in memory only */
  }
}

const initialSync = (transport: SyncTransportKind = 'wifi'): SyncState => ({
  status: 'idle',
  transport,
  progress: null,
  log: [],
  lastProbe: null,
  error: null,
});

interface UiState {
  currentPageId: string;
  /** -1 = moved to an earlier page, 1 = later page, 0 = no animation hint. */
  navDirection: -1 | 0 | 1;
  selection: Selection;
  inspectorTab: InspectorTab;
  modal: ModalId;
  sync: SyncState;

  /** Switches page. `direction` drives the slide animation; selection is cleared. */
  setCurrentPage: (id: string, direction?: -1 | 0 | 1) => void;
  select: (s: Selection) => void;
  setInspectorTab: (t: InspectorTab) => void;
  /** Opening 'sync' while no sync is running resets the sync view to the fresh screen (keeps IP, probe and transport). */
  openModal: (m: Exclude<ModalId, null>) => void;
  closeModal: () => void;

  setSyncTransport: (t: SyncTransportKind) => void;
  /** idle|success|error -> testing. Ignored while syncing. */
  beginTest: () => void;
  /** testing -> idle (probe ok) or error (probe failed). */
  finishTest: (probe: ProbeResult) => void;
  /** idle|success|error|testing -> syncing (clears progress/error; keeps the log). Ignored while syncing. */
  beginSync: () => void;
  setSyncProgress: (p: SyncProgress) => void;
  /** syncing -> success. */
  syncSuccess: () => void;
  /** testing|syncing -> error. */
  syncError: (message: string) => void;
  pushSyncLog: (level: SyncLogEntry['level'], text: string) => void;
  /** Back to idle (keeps transport and lastProbe, clears log/progress/error). Ignored while syncing. */
  resetSync: () => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  currentPageId: '',
  navDirection: 0,
  selection: null,
  inspectorTab: 'appearance',
  modal: null,
  sync: initialSync(readTransport()),

  setCurrentPage: (id, direction = 0) =>
    set((s) => (s.currentPageId === id ? s : { currentPageId: id, navDirection: direction, selection: null })),
  select: (selection) =>
    set({ selection: selection?.kind === 'keys' ? selectionFromIndices(selection.indices) : selection }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  openModal: (modal) =>
    set((s) =>
      modal === 'sync' && s.sync.status !== 'syncing'
        ? { modal, sync: { ...initialSync(s.sync.transport), lastProbe: s.sync.lastProbe } }
        : { modal },
    ),
  closeModal: () => set({ modal: null }),

  setSyncTransport: (transport) => {
    if (get().sync.status === 'syncing') return;
    writeTransport(transport);
    set((s) => ({ sync: { ...s.sync, transport } }));
  },
  beginTest: () =>
    set((s) => (s.sync.status === 'syncing' ? s : { sync: { ...s.sync, status: 'testing', error: null } })),
  finishTest: (probe) =>
    set((s) =>
      s.sync.status !== 'testing'
        ? s
        : {
            sync: {
              ...s.sync,
              status: probe.ok ? 'idle' : 'error',
              lastProbe: probe,
              error: probe.ok ? null : (probe.error ?? 'Falha ao conectar.'),
            },
          },
    ),
  beginSync: () =>
    set((s) => (s.sync.status === 'syncing' ? s : { sync: { ...s.sync, status: 'syncing', progress: null, error: null } })),
  setSyncProgress: (progress) =>
    set((s) => (s.sync.status === 'syncing' ? { sync: { ...s.sync, progress } } : s)),
  syncSuccess: () => set((s) => (s.sync.status === 'syncing' ? { sync: { ...s.sync, status: 'success', error: null } } : s)),
  syncError: (message) =>
    set((s) =>
      s.sync.status === 'syncing' || s.sync.status === 'testing'
        ? { sync: { ...s.sync, status: 'error', error: message } }
        : s,
    ),
  pushSyncLog: (level, text) => {
    const entry: SyncLogEntry = { at: Date.now(), level, text };
    const log = [...get().sync.log, entry];
    set((s) => ({ sync: { ...s.sync, log: log.length > MAX_LOG ? log.slice(-MAX_LOG) : log } }));
  },
  resetSync: () =>
    set((s) =>
      s.sync.status === 'syncing'
        ? s
        : { sync: { ...initialSync(s.sync.transport), lastProbe: s.sync.lastProbe } },
    ),
}));
