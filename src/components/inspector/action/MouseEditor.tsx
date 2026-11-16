import type { MouseAction } from '@/core/types';
import { Field, Select, Slider } from '../../ui';

const KINDS: { value: MouseAction['kind']; label: string }[] = [
  { value: 'left', label: 'Clique esquerdo' },
  { value: 'right', label: 'Clique direito' },
  { value: 'middle', label: 'Clique do meio' },
  { value: 'move', label: 'Mover cursor' },
  { value: 'scroll', label: 'Rolar (scroll)' },
];

export function MouseEditor({ value, onChange }: { value: MouseAction; onChange: (m: MouseAction) => void }) {
  const setKind = (kind: MouseAction['kind']) => {
    if (kind === 'move') onChange({ kind, x: 10, y: 0 });
    else if (kind === 'scroll') onChange({ kind, amount: 3 });
    else onChange({ kind });
  };
  return (
    <div className="space-y-3">
      <Field label="Ação do mouse">
        {(id) => (
          <Select id={id} value={value.kind} onChange={(e) => setKind(e.target.value as MouseAction['kind'])}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {value.kind === 'move' && (
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Horizontal (x)" value={value.x} min={-127} max={127} onChange={(x) => onChange({ ...value, x })} />
          <Slider label="Vertical (y)" value={value.y} min={-127} max={127} onChange={(y) => onChange({ ...value, y })} />
        </div>
      )}
      {value.kind === 'scroll' && (
        <Slider label="Quantidade (negativo = para baixo)" value={value.amount} min={-127} max={127} onChange={(amount) => onChange({ ...value, amount })} />
      )}
    </div>
  );
}
