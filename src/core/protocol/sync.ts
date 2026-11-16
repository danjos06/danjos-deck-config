import type { DeckConfig } from '../types';
import { buildCommandPlan, type SyncStep } from './encode';
import { abortError, type Transport } from './transport';

export interface SyncProgress {
  index: number;
  total: number;
  label: string;
  phase: 'clear' | 'pins' | 'actions' | 'bitmaps' | 'save' | 'done';
}

function phaseOf(step: SyncStep): SyncProgress['phase'] {
  if (step.kind === 'bitmap') return 'bitmaps';
  const cmd = step.line.split(' ', 1)[0];
  switch (cmd) {
    case 'CLEAR':
      return 'clear';
    case 'SAVE':
      return 'save';
    case 'ACT':
    case 'SEQ':
      return 'actions';
    default:
      return 'pins'; // PAGES, FOLDER, P, PCIP: device/layout setup
  }
}

/**
 * Runs the full sync: sends the plan from `buildCommandPlan` over the transport, reporting progress.
 * Honours `signal`. If anything fails after CLEAR was sent, makes a best-effort `SAVE` so the device
 * leaves the syncing state, then rethrows the original error.
 */
export async function runSync(
  cfg: DeckConfig,
  t: Transport,
  onProgress: (p: SyncProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const plan = buildCommandPlan(cfg);
  const total = plan.length;
  let cleared = false;
  let saved = false;
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw abortError('Sincronização cancelada.');
      const step = plan[i];
      onProgress({ index: i, total, label: step.label, phase: phaseOf(step) });
      if (step.kind === 'bitmap') {
        await t.sendBitmap(step.button, step.page, step.data, signal);
      } else {
        if (step.line === 'CLEAR') cleared = true;
        await t.sendCommand(step.line, signal);
        if (step.line === 'SAVE') saved = true;
      }
    }
    onProgress({ index: total, total, label: 'Sincronização concluída', phase: 'done' });
  } catch (e) {
    if (cleared && !saved) {
      try {
        await t.sendCommand('SAVE');
      } catch {
        /* best effort: the original error is what matters */
      }
    }
    throw e;
  }
}
