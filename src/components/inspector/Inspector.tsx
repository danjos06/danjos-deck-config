import type { ReactNode } from 'react';
import type { Action, EncoderFn } from '@/core/types';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore, type InspectorTab, type Selection } from '@/store/uiStore';
import { selectedKeyIndices } from '../deck/keySelection';
import { Icon, IconButton, Tabs } from '../ui';
import { ActionTab } from './action/ActionTab';
import { AppearanceTab } from './AppearanceTab';
import { BulkActionTab } from './bulk/BulkActionTab';
import { BulkAppearanceTab } from './bulk/BulkAppearanceTab';
import { BulkHeader } from './bulk/BulkHeader';

const FN_NAMES: Record<EncoderFn, string> = { cw: 'giro horário', ccw: 'giro anti-horário', sw: 'clique' };

const TABS = [
  { value: 'appearance', label: 'Aparência', icon: 'palette' },
  { value: 'action', label: 'Ação', icon: 'bolt' },
] as const satisfies readonly { value: InspectorTab; label: string; icon: string }[];

function describeSelection(sel: Selection): string {
  if (!sel) return 'Nenhuma seleção.';
  if (sel.kind === 'key') return `Tecla ${sel.index + 1} selecionada.`;
  if (sel.kind === 'keys') return `${sel.indices.length} teclas selecionadas: ${sel.indices.map((i) => i + 1).join(', ')}.`;
  return `Encoder ${sel.enc + 1}, ${FN_NAMES[sel.fn]}, selecionado.`;
}

/** Visually hidden live region that announces selection changes to screen readers. */
function SelectionAnnouncer({ selection }: { selection: Selection }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {describeSelection(selection)}
    </div>
  );
}

export function InspectorEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-fg-dim">
        <Icon name="touch_app" size={28} />
      </div>
      <p className="text-sm font-medium text-fg">Nenhuma tecla selecionada</p>
      <p className="max-w-[230px] text-xs leading-relaxed text-fg-dim">
        Clique em uma tecla ou em uma função do encoder no deck para editar aparência e ação. Use Ctrl/Shift + clique para editar várias teclas.
      </p>
    </div>
  );
}

/** Inspector body for the current selection (used in the right column and in the drawer). */
export function Inspector({ onClose }: { onClose?: () => void }) {
  const selection = useUiStore((s) => s.selection);
  const tab = useUiStore((s) => s.inspectorTab);
  const setTab = useUiStore((s) => s.setInspectorTab);
  const select = useUiStore((s) => s.select);
  const pageId = useUiStore((s) => s.currentPageId);
  const page = useDeckStore((s) => s.config.pages.find((p) => p.id === pageId));
  const encoders = useDeckStore((s) => s.config.encoders);
  const setKeyAction = useDeckStore((s) => s.setKeyAction);
  const setEncoderAction = useDeckStore((s) => s.setEncoderAction);
  const clearKey = useDeckStore((s) => s.clearKey);

  if (!selection || !page) {
    return (
      <>
        <SelectionAnnouncer selection={null} />
        <InspectorEmpty />
      </>
    );
  }

  const indices = selectedKeyIndices(selection);
  const keys = indices.flatMap((i) => (page.keys[i] ? [page.keys[i]] : []));
  const single = selection.kind === 'key' ? page.keys[selection.index] : undefined;
  const isEncoder = selection.kind === 'encoder';
  const activeTab: InspectorTab = isEncoder ? 'action' : tab;
  const close = () => (onClose ? onClose() : select(null));

  // Identity of the visible panel: switching keys / encoder functions re-keys (and fades in) the body.
  const bodyKey = isEncoder ? `enc${selection.enc}${selection.fn}` : `${single?.id ?? 'multi'}-${activeTab}`;

  let body: ReactNode = null;
  if (selection.kind === 'encoder') {
    const { enc, fn } = selection;
    body = <ActionTab action={encoders[enc][fn]} encoder onChange={(a: Action) => setEncoderAction(enc, fn, a)} />;
  } else if (selection.kind === 'key' && single) {
    body =
      activeTab === 'appearance' ? (
        <AppearanceTab pageId={page.id} index={selection.index} keyConfig={single} />
      ) : (
        <ActionTab action={single.action} encoder={false} onChange={(a: Action) => setKeyAction(page.id, selection.index, a)} />
      );
  } else if (selection.kind === 'keys' && keys.length > 1) {
    body =
      activeTab === 'appearance' ? (
        <BulkAppearanceTab pageId={page.id} indices={indices} keys={keys} />
      ) : (
        <BulkActionTab pageId={page.id} indices={indices} keys={keys} />
      );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionAnnouncer selection={selection} />
      <div className="flex shrink-0 items-start gap-2 border-b border-white/[0.06] px-4 py-3">
        {selection.kind === 'keys' ? (
          <BulkHeader indices={indices} />
        ) : (
          <div className="min-w-0 flex-1 self-center">
            <h2 className="truncate text-sm font-semibold text-fg">{selection.kind === 'key' ? `Tecla ${selection.index + 1}` : `Encoder ${selection.enc + 1}`}</h2>
            <p className="truncate text-xs text-fg-muted">{selection.kind === 'key' ? page.name : FN_NAMES[selection.fn]}</p>
          </div>
        )}
        {selection.kind === 'key' && <IconButton icon="delete_sweep" label="Limpar tecla (Delete)" tone="danger" onClick={() => clearKey(page.id, selection.index)} />}
        <IconButton icon="close" label="Fechar inspetor (Esc)" onClick={close} />
      </div>
      {!isEncoder && <Tabs label="Seções do inspetor" value={tab} onChange={setTab} items={TABS} className="shrink-0 px-2" />}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div key={bodyKey} className="panel-fade-in">
          {body}
        </div>
      </div>
    </div>
  );
}
