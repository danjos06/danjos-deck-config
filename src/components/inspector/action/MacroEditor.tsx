import { useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { CONSUMER_INFO, MAX_MACRO_STEPS } from '@/core/constants';
import { newId } from '@/core/defaults';
import type { MacroStep } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import { stepText } from '@/lib/ui/format';
import { Button, Icon, IconButton, Select } from '../../ui';
import { ConsumerPicker } from './ConsumerPicker';
import { KeystrokeEditor } from './KeystrokeEditor';
import { MouseEditor } from './MouseEditor';

const STEP_META: Record<MacroStep['type'], { label: string; icon: string }> = {
  keyboard: { label: 'Tecla / atalho', icon: 'keyboard' },
  consumer: { label: 'Mídia', icon: 'music_note' },
  mouse: { label: 'Mouse', icon: 'mouse' },
  delay: { label: 'Esperar', icon: 'timer' },
};

function makeStep(type: MacroStep['type']): MacroStep {
  const id = newId('step');
  switch (type) {
    case 'keyboard':
      return { id, type, key: '', modifiers: 0, delayMs: 50 };
    case 'consumer':
      return { id, type, code: 'PLAY_PAUSE', delayMs: 50 };
    case 'mouse':
      return { id, type, mouse: { kind: 'left' }, delayMs: 50 };
    case 'delay':
      return { id, type, delayMs: 250 };
  }
}

function StepBody({ step, onChange }: { step: MacroStep; onChange: (s: MacroStep) => void }) {
  switch (step.type) {
    case 'keyboard':
      return <KeystrokeEditor keyName={step.key} modifiers={step.modifiers} onChange={(key, modifiers) => onChange({ ...step, key, modifiers })} />;
    case 'consumer':
      return <ConsumerPicker value={step.code} onPick={(code) => onChange({ ...step, code })} />;
    case 'mouse':
      return <MouseEditor value={step.mouse} onChange={(mouse) => onChange({ ...step, mouse })} />;
    case 'delay':
      return null;
  }
}

function StepRow({ step, index, onChange, onRemove }: { step: MacroStep; index: number; onChange: (s: MacroStep) => void; onRemove: () => void }) {
  const controls = useDragControls();
  const [open, setOpen] = useState(false);
  const meta = STEP_META[step.type];
  return (
    <Reorder.Item
      value={step}
      dragListener={false}
      dragControls={controls}
      className="list-none overflow-hidden rounded-xl border border-white/[0.07] bg-ink-950"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 28px rgba(0,0,0,0.6)', zIndex: 10 }}
    >
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          aria-label={`Reordenar passo ${index + 1}`}
          onPointerDown={(e) => controls.start(e)}
          className="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-fg-dim hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <Icon name="drag_indicator" size={16} />
        </button>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-700 font-mono text-[10px] text-fg-muted">{index + 1}</span>
          <Icon name={meta.icon} size={16} className="text-fg-muted" />
          <span className="min-w-0 truncate text-xs font-medium text-fg">{stepText(step)}</span>
          <Icon name="expand_more" size={16} className={cn('ml-auto text-fg-dim transition-transform', open && 'rotate-180')} />
        </button>
        <label className="flex shrink-0 items-center gap-1 rounded-md bg-ink-800 px-1.5">
          <span className="sr-only">Atraso em milissegundos após o passo {index + 1}</span>
          <Icon name="timer" size={12} className="text-fg-dim" />
          <input
            type="number"
            min={0}
            max={65535}
            value={step.delayMs}
            onChange={(e) => onChange({ ...step, delayMs: Math.min(65535, Math.max(0, Math.trunc(Number(e.target.value) || 0))) })}
            className="h-7 w-14 bg-transparent text-right font-mono text-[11px] text-fg outline-none focus:text-accent"
          />
          <span className="text-[10px] text-fg-dim">ms</span>
        </label>
        <IconButton size="sm" icon="close" label={`Remover passo ${index + 1}`} tone="danger" onClick={onRemove} />
      </div>
      <AnimatePresence initial={false}>
        {open && step.type !== 'delay' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-white/[0.06] p-3">
              <StepBody step={step} onChange={onChange} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

interface MacroEditorProps {
  steps: MacroStep[];
  onChange: (steps: MacroStep[]) => void;
}

export function MacroEditor({ steps, onChange }: MacroEditorProps) {
  const full = steps.length >= MAX_MACRO_STEPS;
  const [adding, setAdding] = useState<MacroStep['type']>('keyboard');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fg-muted">Sequência executada em ordem, com atraso após cada passo.</p>
        <span className={cn('rounded-md bg-ink-950 px-1.5 py-0.5 font-mono text-[11px]', full ? 'text-warn' : 'text-fg-muted')}>
          {steps.length}/{MAX_MACRO_STEPS}
        </span>
      </div>
      {steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-fg-dim">Nenhum passo ainda. Adicione o primeiro abaixo.</p>
      ) : (
        <Reorder.Group axis="y" values={steps} onReorder={onChange} className="flex flex-col gap-1.5">
          {steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              index={i}
              onChange={(ns) => onChange(steps.map((x) => (x.id === s.id ? ns : x)))}
              onRemove={() => onChange(steps.filter((x) => x.id !== s.id))}
            />
          ))}
        </Reorder.Group>
      )}
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select aria-label="Tipo do novo passo" value={adding} onChange={(e) => setAdding(e.target.value as MacroStep['type'])}>
            {(Object.keys(STEP_META) as MacroStep['type'][]).map((t) => (
              <option key={t} value={t}>
                {STEP_META[t].label}
              </option>
            ))}
          </Select>
        </div>
        <Button icon="add" disabled={full} onClick={() => onChange([...steps, makeStep(adding)])} title={full ? 'Limite de 10 passos atingido' : undefined}>
          Adicionar
        </Button>
      </div>
      {steps.some((s) => s.type === 'consumer') && (
        <p className="text-[11px] text-fg-dim">Dica: {CONSUMER_INFO.PLAY_PAUSE.label} e outros controles de mídia funcionam como passos.</p>
      )}
    </div>
  );
}
