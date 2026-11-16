import { MAX_PAGES } from '@/core/constants';
import type { Action, Page } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { ACTION_TYPE_LABELS } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Field, Icon, Select, Textarea } from '../../ui';
import { Section } from '../Section';
import { ConsumerPicker } from './ConsumerPicker';
import { KeystrokeEditor } from './KeystrokeEditor';
import { MacroEditor } from './MacroEditor';
import { MouseEditor } from './MouseEditor';

const TYPE_ICONS: Record<Action['type'], string> = {
  none: 'block',
  keyboard: 'keyboard',
  consumer: 'music_note',
  mouse: 'mouse',
  macro: 'playlist_play',
  text: 'text_fields',
  cpp: 'code',
  folder: 'folder',
  back: 'undo',
};

const TYPES: Action['type'][] = ['none', 'keyboard', 'consumer', 'mouse', 'macro', 'text', 'cpp', 'folder', 'back'];

function Warning({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-2.5 text-[11.5px] leading-snug text-warn">
      <Icon name="warning" size={15} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

function FolderEditor({ action, pages, currentPageId, onChange }: { action: Extract<Action, { type: 'folder' }>; pages: Page[]; currentPageId: string; onChange: (a: Action) => void }) {
  const addPage = useDeckStore((s) => s.addPage);
  const folders = pages.filter((p) => p.isFolder && p.id !== currentPageId);
  const atLimit = pages.length >= MAX_PAGES;
  return (
    <div className="space-y-2">
      <Field label="Pasta de destino" hint="Ao pressionar a tecla, o deck abre essa pasta. Ela traz uma tecla “Voltar” pronta.">
        {(id) => (
          <Select
            id={id}
            value={action.targetPageId}
            onChange={(e) => {
              if (e.target.value === '__new') {
                const nid = addPage(true, currentPageId);
                if (nid) onChange({ type: 'folder', targetPageId: nid });
              } else onChange({ type: 'folder', targetPageId: e.target.value });
            }}
          >
            <option value="" disabled>
              Escolha uma pasta…
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="__new" disabled={atLimit}>
              + Criar nova pasta{atLimit ? ' (limite de 8 páginas)' : ''}
            </option>
          </Select>
        )}
      </Field>
    </div>
  );
}

interface ActionTabProps {
  action: Action;
  encoder: boolean;
  /** Bulk editing: the selected keys have different actions, so no type is highlighted. */
  mixed?: boolean;
  onChange: (a: Action) => void;
}

export function ActionTab({ action, encoder, mixed = false, onChange }: ActionTabProps) {
  const pages = useDeckStore((s) => s.config.pages);
  const currentPageId = useUiStore((s) => s.currentPageId);
  const types = encoder ? TYPES.filter((t) => t !== 'folder' && t !== 'back') : TYPES;

  const setType = (t: Action['type']) => {
    if (t === action.type && !mixed) return;
    switch (t) {
      case 'none':
      case 'back':
        return onChange({ type: t });
      case 'keyboard':
        return onChange({ type: t, key: '', modifiers: 0 });
      case 'consumer':
        return onChange({ type: t, code: 'PLAY_PAUSE' });
      case 'mouse':
        return onChange({ type: t, mouse: { kind: 'left' } });
      case 'macro':
        return onChange({ type: t, steps: [] });
      case 'text':
        return onChange({ type: t, text: '' });
      case 'cpp':
        return onChange({ type: t, code: '' });
      case 'folder':
        return onChange({ type: t, targetPageId: pages.find((p) => p.isFolder && p.id !== currentPageId)?.id ?? '' });
    }
  };

  return (
    <div>
      <Section title="Tipo de ação">
        <div role="radiogroup" aria-label="Tipo de ação" className="grid grid-cols-3 gap-1.5">
          {types.map((t) => {
            const on = !mixed && action.type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t)}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                  on ? 'border-accent/60 bg-accent/10 text-fg' : 'border-white/[0.07] bg-ink-950 text-fg-muted hover:border-white/15 hover:text-fg',
                )}
              >
                <Icon name={TYPE_ICONS[t]} size={20} className={on ? 'text-accent' : ''} />
                <span className="max-w-full truncate">{ACTION_TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Configuração">
        {mixed && (
          <p className="rounded-lg border border-white/[0.07] bg-ink-950 p-3 text-xs leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">Misto.</span> As teclas selecionadas têm ações diferentes. Escolha um tipo acima para aplicar a mesma ação a todas.
          </p>
        )}
        {!mixed && action.type === 'none' && <p className="text-xs text-fg-dim">Esta tecla não faz nada. Escolha um tipo de ação acima.</p>}
        {!mixed && action.type === 'keyboard' && (
          <KeystrokeEditor keyName={action.key} modifiers={action.modifiers} onChange={(key, modifiers) => onChange({ type: 'keyboard', key, modifiers })} />
        )}
        {!mixed && action.type === 'consumer' && <ConsumerPicker value={action.code} onPick={(code) => onChange({ type: 'consumer', code })} />}
        {!mixed && action.type === 'mouse' && <MouseEditor value={action.mouse} onChange={(mouse) => onChange({ type: 'mouse', mouse })} />}
        {!mixed && action.type === 'macro' && <MacroEditor steps={action.steps} onChange={(steps) => onChange({ type: 'macro', steps })} />}
        {!mixed && action.type === 'text' && (
          <>
            <Field label="Texto a digitar">
              {(id) => <Textarea id={id} rows={5} value={action.text} placeholder="Texto digitado pelo teclado USB" onChange={(e) => onChange({ type: 'text', text: e.target.value })} />}
            </Field>
            <Warning>Este texto é gravado no firmware: é preciso exportar o .ino e gravar no ESP32 para que valha (a sincronização não o envia).</Warning>
          </>
        )}
        {!mixed && action.type === 'cpp' && (
          <>
            <Field label="Código C++" hint="Executado dentro do firmware quando a ação dispara. Use a API Keyboard / Consumer / Mouse do Arduino.">
              {(id) => (
                <Textarea id={id} mono rows={8} spellCheck={false} value={action.code} placeholder={'Keyboard.print("olá");'} onChange={(e) => onChange({ type: 'cpp', code: e.target.value })} />
              )}
            </Field>
            <Warning>Este código é gravado no firmware: é preciso exportar o .ino e gravar no ESP32 para que valha (a sincronização não o envia).</Warning>
          </>
        )}
        {!mixed && action.type === 'folder' && <FolderEditor action={action} pages={pages} currentPageId={currentPageId} onChange={onChange} />}
        {!mixed && action.type === 'back' && (
          <p className="flex items-start gap-2 rounded-lg bg-ink-950 p-3 text-xs leading-relaxed text-fg-muted">
            <Icon name="info" size={16} className="mt-px text-sky-300" />
            Volta para a página-mãe da pasta atual (no firmware antigo, volta para a primeira página). Use dentro de pastas.
          </p>
        )}
      </Section>
    </div>
  );
}
