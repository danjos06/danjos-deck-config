import type { Action, KeyConfig } from '@/core/types';
import { useDeckStore } from '@/store/deckStore';
import { ActionTab } from '../action/ActionTab';
import { commonValue, isMixed, jsonEquals } from '../commonValue';

const NEUTRAL: Action = { type: 'none' };

/** Same action on every selected key. When their actions differ the editor starts neutral ("Misto"). */
export function BulkActionTab({ pageId, indices, keys }: { pageId: string; indices: number[]; keys: KeyConfig[] }) {
  const setKeysAction = useDeckStore((s) => s.setKeysAction);
  const common = commonValue(keys.map((k) => k.action), jsonEquals);
  const mixed = isMixed(common);
  return <ActionTab action={mixed ? NEUTRAL : common} mixed={mixed} encoder={false} onChange={(a) => setKeysAction(pageId, indices, a)} />;
}
