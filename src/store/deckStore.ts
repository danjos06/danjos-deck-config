import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bitmapToBase64 } from '@/core/bitmap/pack';
import { FontNotReadyError, renderKeyBitmap, whenIconFontReady } from '@/core/bitmap/render';
import { KEYS_PER_PAGE, MAX_PAGES } from '@/core/constants';
import { normalizeConfig } from '@/core/configIO';
import {
  createDefaultAppearance,
  createDefaultConfig,
  createEmptyKey,
  createPage,
  iconAppearance,
  newId,
} from '@/core/defaults';
import type {
  Action,
  DeckConfig,
  EncoderFn,
  HardwareConfig,
  ImageSource,
  KeyAppearance,
  KeyConfig,
  NetworkConfig,
  Page,
  PinId,
} from '@/core/types';

/** Partial update of a key appearance; nested objects are merged, `image: null` removes the image. */
export type KeyAppearancePatch = Partial<Omit<KeyAppearance, 'icon' | 'label' | 'image'>> & {
  icon?: Partial<KeyAppearance['icon']>;
  label?: Partial<KeyAppearance['label']>;
  image?: Partial<ImageSource> | null;
};

interface DeckState {
  config: DeckConfig;

  setConfig: (cfg: DeckConfig) => void;
  renameDeck: (name: string) => void;
  /** Adds a page (folder pages get a "back" key). Returns the new page id, or null when MAX_PAGES is reached. */
  addPage: (isFolder?: boolean, parentId?: string) => string | null;
  /** Duplicates a page right after the original. Returns the new id, or null at MAX_PAGES / unknown id. */
  duplicatePage: (id: string) => string | null;
  renamePage: (id: string, name: string) => void;
  /** Deletes a page (never the root), cleaning folder actions and parent references. Returns success. */
  deletePage: (id: string) => boolean;
  /** Moves a page to `toIndex` (the root stays first). */
  movePage: (id: string, toIndex: number) => void;
  updateKey: (pageId: string, index: number, patch: Partial<Omit<KeyConfig, 'id'>>) => void;
  /** Merges an appearance patch and re-renders the bitmap asynchronously (stale renders are discarded). */
  updateKeyAppearance: (pageId: string, index: number, patch: KeyAppearancePatch) => Promise<void>;
  /** Batch version of updateKeyAppearance: one state update, then every bitmap is re-rendered. */
  updateKeysAppearance: (pageId: string, indices: readonly number[], patch: KeyAppearancePatch) => Promise<void>;
  setKeyAction: (pageId: string, index: number, action: Action) => void;
  /** Sets the same action on several keys in one state update. */
  setKeysAction: (pageId: string, indices: readonly number[], action: Action) => void;
  clearKey: (pageId: string, index: number) => void;
  swapKeys: (pageId: string, a: number, b: number) => void;
  /** Encoders cannot use folder/back: those are stored as 'none'. */
  setEncoderAction: (enc: 0 | 1, fn: EncoderFn, action: Action) => void;
  /** Sets a pin GPIO (-1 disables it). */
  setPin: (id: PinId, gpio: number) => void;
  setHardware: (patch: Partial<HardwareConfig>) => void;
  setNetwork: (patch: Partial<NetworkConfig>) => void;
  resetConfig: () => void;
  /** Renders every key whose `bitmap` is '' (idempotent; safe to call often). */
  ensureBitmaps: () => Promise<void>;
}

/** Per-key render token: only the latest render of a key may write its bitmap. */
const renderTokens = new Map<string, number>();
let tokenCounter = 0;
const nextToken = (keyId: string): number => {
  const t = ++tokenCounter;
  renderTokens.set(keyId, t);
  return t;
};

function mapPage(cfg: DeckConfig, pageId: string, fn: (p: Page) => Page): DeckConfig {
  return { ...cfg, pages: cfg.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

function mapKey(cfg: DeckConfig, pageId: string, index: number, fn: (k: KeyConfig) => KeyConfig): DeckConfig {
  if (index < 0 || index >= KEYS_PER_PAGE) return cfg;
  return mapPage(cfg, pageId, (p) => ({ ...p, keys: p.keys.map((k, i) => (i === index ? fn(k) : k)) }));
}

function mergeAppearance(cur: KeyAppearance, patch: KeyAppearancePatch): KeyAppearance {
  const { icon, label, image, ...rest } = patch;
  let nextImage: ImageSource | null = cur.image;
  if (image === null) nextImage = null;
  else if (image) {
    const base = cur.image;
    const dataUrl = image.dataUrl ?? base?.dataUrl;
    nextImage = dataUrl
      ? { fit: 'contain', zoom: 1, offsetX: 0, offsetY: 0, ...(base ?? {}), ...image, dataUrl }
      : base;
  }
  return {
    ...cur,
    ...rest,
    icon: { ...cur.icon, ...icon },
    label: { ...cur.label, ...label },
    image: nextImage,
  };
}

function backKeyFor(): KeyConfig {
  const k = createEmptyKey();
  k.name = 'Voltar';
  k.appearance = iconAppearance('arrow_back', 'Voltar');
  k.action = { type: 'back' };
  return k;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => {
      /** True while an ensureBitmaps retry (waiting for the icon font) is already scheduled. */
      let ensureRetryPending = false;

      /**
       * Renders `keyId` and stores the result if no newer render started meanwhile.
       * On FontNotReadyError the previous bitmap is kept and `onFontNotReady(token)` is called instead.
       */
      const renderInto = async (
        keyId: string,
        appearance: KeyAppearance,
        onFontNotReady?: (token: number) => void,
      ): Promise<void> => {
        const token = nextToken(keyId);
        try {
          const b64 = bitmapToBase64(await renderKeyBitmap(appearance));
          if (renderTokens.get(keyId) !== token) return;
          set((s) => {
            let hit = false;
            const pages = s.config.pages.map((p) =>
              p.keys.some((k) => k.id === keyId)
                ? {
                    ...p,
                    keys: p.keys.map((k) => {
                      if (k.id !== keyId) return k;
                      hit = true;
                      return { ...k, bitmap: b64 };
                    }),
                  }
                : p,
            );
            return hit ? { config: { ...s.config, pages } } : s;
          });
        } catch (e) {
          if (e instanceof FontNotReadyError) {
            if (renderTokens.get(keyId) === token) onFontNotReady?.(token);
            return;
          }
          console.warn('Falha ao renderizar bitmap da tecla', e);
        }
      };

      /** Renders a key; if the icon font is not ready, keeps the old bitmap and retries once it is. */
      const renderWithRetry = (keyId: string, appearance: KeyAppearance): Promise<void> =>
        renderInto(keyId, appearance, (token) => {
          void whenIconFontReady().then((ok) => {
            if (ok && renderTokens.get(keyId) === token) void renderInto(keyId, appearance);
          });
        });

      return {
        config: createDefaultConfig(),

        setConfig: (cfg) => {
          set({ config: cfg });
          void get().ensureBitmaps();
        },

        renameDeck: (name) => set((s) => ({ config: { ...s.config, name } })),

        addPage: (isFolder = false, parentId) => {
          const { config } = get();
          if (config.pages.length >= MAX_PAGES) return null;
          const root = config.pages[0];
          const folders = config.pages.filter((p) => p.isFolder).length;
          const page = createPage(isFolder ? `Pasta ${folders + 1}` : `Página ${config.pages.length - folders + 1}`, {
            isFolder,
            parentId: isFolder ? (parentId && config.pages.some((p) => p.id === parentId) ? parentId : root.id) : parentId ?? null,
          });
          if (isFolder) page.keys[0] = backKeyFor();
          set({ config: { ...config, pages: [...config.pages, page] } });
          void get().ensureBitmaps();
          return page.id;
        },

        duplicatePage: (id) => {
          const { config } = get();
          if (config.pages.length >= MAX_PAGES) return null;
          const idx = config.pages.findIndex((p) => p.id === id);
          if (idx < 0) return null;
          const src = config.pages[idx];
          const copy: Page = {
            ...structuredClone(src),
            id: newId('page'),
            name: `${src.name} (cópia)`,
            parentId: idx === 0 ? null : src.parentId,
            isFolder: idx === 0 ? false : src.isFolder,
          };
          copy.keys = copy.keys.map((k) => ({ ...k, id: newId('key') }));
          const pages = [...config.pages];
          pages.splice(idx + 1, 0, copy);
          set({ config: { ...config, pages } });
          return copy.id;
        },

        renamePage: (id, name) => set((s) => ({ config: mapPage(s.config, id, (p) => ({ ...p, name })) })),

        deletePage: (id) => {
          const { config } = get();
          const idx = config.pages.findIndex((p) => p.id === id);
          if (idx <= 0) return false; // unknown or root
          const removed = config.pages[idx];
          const rootId = config.pages[0].id;
          const fixAction = (a: Action): Action =>
            a.type === 'folder' && a.targetPageId === id ? { type: 'none' } : a;
          const pages = config.pages
            .filter((p) => p.id !== id)
            .map((p) => ({
              ...p,
              parentId: p.parentId === id ? (removed.parentId ?? rootId) : p.parentId,
              keys: p.keys.map((k) => {
                const action = fixAction(k.action);
                return action === k.action ? k : { ...k, action };
              }),
            }));
          const enc = (e: DeckConfig['encoders'][number]) => ({ cw: fixAction(e.cw), ccw: fixAction(e.ccw), sw: fixAction(e.sw) });
          set({ config: { ...config, pages, encoders: [enc(config.encoders[0]), enc(config.encoders[1])] } });
          return true;
        },

        movePage: (id, toIndex) =>
          set((s) => {
            const from = s.config.pages.findIndex((p) => p.id === id);
            if (from <= 0) return s; // unknown or root
            const to = Math.min(s.config.pages.length - 1, Math.max(1, Math.trunc(toIndex)));
            if (to === from) return s;
            const pages = [...s.config.pages];
            const [p] = pages.splice(from, 1);
            pages.splice(to, 0, p);
            return { config: { ...s.config, pages } };
          }),

        updateKey: (pageId, index, patch) =>
          set((s) => ({ config: mapKey(s.config, pageId, index, (k) => ({ ...k, ...patch })) })),

        updateKeyAppearance: async (pageId, index, patch) => {
          const key = get().config.pages.find((p) => p.id === pageId)?.keys[index];
          if (!key) return;
          const appearance = mergeAppearance(key.appearance, patch);
          set((s) => ({ config: mapKey(s.config, pageId, index, (k) => ({ ...k, appearance })) }));
          await renderWithRetry(key.id, appearance);
        },

        updateKeysAppearance: async (pageId, indices, patch) => {
          const page = get().config.pages.find((p) => p.id === pageId);
          if (!page) return;
          const targets = [...new Set(indices)].filter((i) => i >= 0 && i < KEYS_PER_PAGE && page.keys[i]);
          if (targets.length === 0) return;
          const next = new Map<number, KeyAppearance>(targets.map((i) => [i, mergeAppearance(page.keys[i].appearance, patch)]));
          set((s) => ({
            config: mapPage(s.config, pageId, (p) => ({
              ...p,
              keys: p.keys.map((k, i) => {
                const appearance = next.get(i);
                return appearance ? { ...k, appearance } : k;
              }),
            })),
          }));
          await Promise.all([...next].map(([i, appearance]) => renderWithRetry(page.keys[i].id, appearance)));
        },

        setKeyAction: (pageId, index, action) =>
          set((s) => ({ config: mapKey(s.config, pageId, index, (k) => ({ ...k, action })) })),

        setKeysAction: (pageId, indices, action) =>
          set((s) => {
            const wanted = new Set(indices);
            return { config: mapPage(s.config, pageId, (p) => ({ ...p, keys: p.keys.map((k, i) => (wanted.has(i) ? { ...k, action } : k)) })) };
          }),

        clearKey: (pageId, index) => {
          const key = get().config.pages.find((p) => p.id === pageId)?.keys[index];
          if (!key) return;
          const appearance = createDefaultAppearance();
          set((s) =>
            ({ config: mapKey(s.config, pageId, index, (k) => ({ ...k, name: '', appearance, action: { type: 'none' } as Action })) }),
          );
          void renderInto(key.id, appearance);
        },

        swapKeys: (pageId, a, b) =>
          set((s) => {
            if (a === b || a < 0 || b < 0 || a >= KEYS_PER_PAGE || b >= KEYS_PER_PAGE) return s;
            return {
              config: mapPage(s.config, pageId, (p) => {
                const keys = [...p.keys];
                [keys[a], keys[b]] = [keys[b], keys[a]];
                return { ...p, keys };
              }),
            };
          }),

        setEncoderAction: (enc, fn, action) =>
          set((s) => {
            const safe: Action = action.type === 'folder' || action.type === 'back' ? { type: 'none' } : action;
            const encoders: DeckConfig['encoders'] = [s.config.encoders[0], s.config.encoders[1]];
            encoders[enc] = { ...encoders[enc], [fn]: safe };
            return { config: { ...s.config, encoders } };
          }),

        setPin: (id, gpio) =>
          set((s) => ({
            config: {
              ...s.config,
              hardware: { ...s.config.hardware, pins: { ...s.config.hardware.pins, [id]: Math.trunc(gpio) } },
            },
          })),

        setHardware: (patch) =>
          set((s) => ({ config: { ...s.config, hardware: { ...s.config.hardware, ...patch } } })),

        setNetwork: (patch) =>
          set((s) => ({ config: { ...s.config, network: { ...s.config.network, ...patch } } })),

        resetConfig: () => {
          renderTokens.clear();
          set({ config: createDefaultConfig() });
          void get().ensureBitmaps();
        },

        ensureBitmaps: async () => {
          const jobs: { id: string; appearance: KeyAppearance }[] = [];
          for (const p of get().config.pages) {
            for (const k of p.keys) if (k.bitmap === '') jobs.push({ id: k.id, appearance: k.appearance });
          }
          let fontNotReady = false;
          await Promise.all(jobs.map((j) => renderInto(j.id, j.appearance, () => (fontNotReady = true))));
          // Keys stay '' while the icon font is missing; retry once it becomes ready.
          if (fontNotReady && !ensureRetryPending) {
            ensureRetryPending = true;
            void whenIconFontReady().then((ok) => {
              ensureRetryPending = false;
              if (ok) void get().ensureBitmaps();
            });
          }
        },
      };
    },
    {
      name: 'danjos_deck_v2',
      version: 1,
      partialize: (s) => ({ config: s.config }),
      merge: (persisted, current) => {
        const raw = (persisted as { config?: unknown } | undefined)?.config;
        if (!raw) return current;
        try {
          return { ...current, config: normalizeConfig(raw) };
        } catch {
          return current;
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) void state.ensureBitmaps();
      },
    },
  ),
);
