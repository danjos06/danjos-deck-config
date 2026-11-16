import { useState } from 'react';
import type { KeyConfig } from '@/core/types';
import { useDeckStore } from '@/store/deckStore';
import { Button, Field, Select, toast } from '../../ui';
import { Section } from '../Section';

interface Props {
  pageId: string;
  indices: number[];
  keys: KeyConfig[];
}

/** Bulk utilities: clear all selected keys (with confirmation) and copy one key's look to the others. */
export function BulkUtilities({ pageId, indices, keys }: Props) {
  const clearKey = useDeckStore((s) => s.clearKey);
  const updateKeysAppearance = useDeckStore((s) => s.updateKeysAppearance);
  const [confirming, setConfirming] = useState(false);

  const clearAll = () => {
    indices.forEach((i) => clearKey(pageId, i));
    setConfirming(false);
    toast.success(`${indices.length} teclas limpas.`);
  };

  const copyFrom = (source: number) => {
    const src = keys[indices.indexOf(source)]?.appearance;
    if (!src) return;
    const others = indices.filter((i) => i !== source);
    void updateKeysAppearance(pageId, others, { ...src, icon: { ...src.icon }, label: { ...src.label }, image: src.image ? { ...src.image } : null });
    toast.success(`Aparência da tecla ${source + 1} copiada para ${others.length} ${others.length === 1 ? 'tecla' : 'teclas'}.`);
  };

  return (
    <Section title="Utilitários">
      <Field label="Copiar aparência" hint="Aplica modo, ícone, texto e conversão da tecla escolhida às demais selecionadas.">
        {(id) => (
          <Select id={id} value="" onChange={(e) => e.target.value !== '' && copyFrom(Number(e.target.value))}>
            <option value="" disabled>
              Escolha a tecla de origem…
            </option>
            {indices.map((i) => (
              <option key={i} value={i}>
                Copiar aparência da tecla {i + 1} para as demais
              </option>
            ))}
          </Select>
        )}
      </Field>
      {confirming ? (
        <div role="alertdialog" aria-label="Confirmar limpeza" className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5">
          <span className="min-w-0 flex-1 text-xs text-danger">Limpar aparência e ação de {indices.length} teclas?</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button size="sm" variant="danger" icon="delete_sweep" onClick={clearAll}>
            Limpar
          </Button>
        </div>
      ) : (
        <Button variant="danger" icon="delete_sweep" onClick={() => setConfirming(true)}>
          Limpar teclas
        </Button>
      )}
    </Section>
  );
}
