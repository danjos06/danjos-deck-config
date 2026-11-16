import { CONSUMER_INFO, MODIFIER_BITS, keyLabel } from '@/core/constants';
import type { Action, MacroStep, MouseAction, Page } from '@/core/types';

/** "Ctrl + Shift + K" style summary for a key + modifier mask. */
export function shortcutParts(key: string, modifiers: number): string[] {
  const parts: string[] = MODIFIER_BITS.filter((m) => (modifiers & m.bit) !== 0).map((m) => m.short);
  if (key !== '') parts.push(keyLabel(key));
  return parts;
}

export function shortcutText(key: string, modifiers: number): string {
  const p = shortcutParts(key, modifiers);
  return p.length ? p.join(' + ') : 'Nenhuma tecla';
}

export function mouseText(m: MouseAction): string {
  switch (m.kind) {
    case 'left':
      return 'Clique esquerdo';
    case 'right':
      return 'Clique direito';
    case 'middle':
      return 'Clique do meio';
    case 'move':
      return `Mover (${m.x}, ${m.y})`;
    case 'scroll':
      return `Rolar ${m.amount > 0 ? '+' : ''}${m.amount}`;
  }
}

export function stepText(s: MacroStep): string {
  switch (s.type) {
    case 'keyboard':
      return shortcutText(s.key, s.modifiers);
    case 'consumer':
      return CONSUMER_INFO[s.code]?.label ?? s.code;
    case 'mouse':
      return mouseText(s.mouse);
    case 'delay':
      return `Aguardar ${s.delayMs} ms`;
  }
}

export const ACTION_TYPE_LABELS: Record<Action['type'], string> = {
  none: 'Nenhuma',
  keyboard: 'Tecla',
  consumer: 'Mídia',
  mouse: 'Mouse',
  macro: 'Macro',
  text: 'Texto',
  cpp: 'C++',
  folder: 'Pasta',
  back: 'Voltar',
};

/** One-line human summary of an action. */
export function actionSummary(a: Action, pages: Page[]): string {
  switch (a.type) {
    case 'none':
      return 'Sem ação';
    case 'keyboard':
      return shortcutText(a.key, a.modifiers);
    case 'consumer':
      return CONSUMER_INFO[a.code]?.label ?? a.code;
    case 'mouse':
      return mouseText(a.mouse);
    case 'macro':
      return `Macro · ${a.steps.length} ${a.steps.length === 1 ? 'passo' : 'passos'}`;
    case 'text': {
      const t = a.text.replace(/\s+/g, ' ').trim();
      return t ? `Texto “${t.length > 24 ? `${t.slice(0, 24)}…` : t}”` : 'Texto vazio';
    }
    case 'cpp':
      return 'Código C++';
    case 'folder':
      return `Pasta → ${pages.find((p) => p.id === a.targetPageId)?.name ?? '?'}`;
    case 'back':
      return 'Voltar';
  }
}

/** Triggers a browser download of text content. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const hex = (n: number, pad = 2): string => `0x${n.toString(16).toUpperCase().padStart(pad, '0')}`;
