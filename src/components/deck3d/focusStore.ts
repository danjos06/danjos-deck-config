import { create } from 'zustand';

export type ViewLock = 'free' | 'front';
const VIEW_KEY = 'danjos_deck_v2.view';

function readLock(): ViewLock {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'front' ? 'front' : 'free';
  } catch {
    return 'free';
  }
}

/**
 * UI-only 3D interaction state (knob activity, idle tracking, view lock). Not part of the deck config.
 * Hovering never moves the camera: `hoverKnob` only drives the knob glow affordance.
 */
interface FocusState {
  /** Knob highlighted from the legend (glow only, no camera move). */
  hoverKnob: 0 | 1 | null;
  /** Knob being dragged/scrolled, null when none (turns the camera towards it). */
  activeKnob: 0 | 1 | null;
  /** "Vista": free (hero + selection views) or locked to the straight frontal framing. Persisted. */
  viewLock: ViewLock;
  /** performance.now() of the last user interaction with the stage. */
  lastInteraction: number;
  setHoverKnob: (k: 0 | 1 | null) => void;
  setActiveKnob: (k: 0 | 1 | null) => void;
  setViewLock: (v: ViewLock) => void;
  ping: () => void;
}

export const useFocusStore = create<FocusState>()((set) => ({
  hoverKnob: null,
  activeKnob: null,
  viewLock: readLock(),
  lastInteraction: 0,
  setHoverKnob: (hoverKnob) => set({ hoverKnob }),
  setActiveKnob: (activeKnob) => set({ activeKnob, lastInteraction: performance.now() }),
  setViewLock: (viewLock) => {
    set({ viewLock, lastInteraction: performance.now() });
    try {
      window.localStorage.setItem(VIEW_KEY, viewLock);
    } catch {
      /* storage blocked: keep in memory */
    }
  },
  ping: () => set({ lastInteraction: performance.now() }),
}));
