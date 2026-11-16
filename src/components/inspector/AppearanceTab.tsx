import { useCallback } from 'react';
import type { DitherMode, IconLayout, KeyConfig } from '@/core/types';
import { useDeckStore, type KeyAppearancePatch } from '@/store/deckStore';
import { Field, Input, SegmentedControl, Select, Switch } from '../ui';
import { IconPicker } from './IconPicker';
import { ImageControls } from './ImageControls';
import { LiveSlider } from './LiveSlider';
import { PreviewPanel } from './PreviewPanel';
import { Section } from './Section';

const MODES = [
  { value: 'icon', label: 'Ícone', icon: 'interests' },
  { value: 'image', label: 'Imagem', icon: 'image' },
  { value: 'blank', label: 'Vazio', icon: 'crop_square' },
] as const;

const LAYOUTS: { value: IconLayout; label: string; icon: string }[] = [
  { value: 'icon-only', label: 'Só ícone', icon: 'crop_square' },
  { value: 'icon-text-below', label: 'Texto abaixo', icon: 'vertical_split' },
  { value: 'icon-text-side', label: 'Texto ao lado', icon: 'view_sidebar' },
  { value: 'text-only', label: 'Só texto', icon: 'title' },
];

const DITHERS: { value: DitherMode; label: string }[] = [
  { value: 'none', label: 'Nenhum (limiar)' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'bayer', label: 'Bayer (ordenado)' },
];

interface AppearanceTabProps {
  pageId: string;
  index: number;
  keyConfig: KeyConfig;
}

export function AppearanceTab({ pageId, index, keyConfig }: AppearanceTabProps) {
  const updateKeyAppearance = useDeckStore((s) => s.updateKeyAppearance);
  const updateKey = useDeckStore((s) => s.updateKey);
  const a = keyConfig.appearance;
  const patch = useCallback((p: KeyAppearancePatch) => void updateKeyAppearance(pageId, index, p), [updateKeyAppearance, pageId, index]);
  const showIcon = a.mode === 'icon' && a.layout !== 'text-only';
  const showLabel = a.mode !== 'icon' || a.layout !== 'icon-only';

  return (
    <div>
      <Section title="Pré-visualização">
        <PreviewPanel appearance={a} bitmap={keyConfig.bitmap} symbol={`bmp_${pageId}_${index}`} />
      </Section>

      <Section title="Tipo de conteúdo">
        <Field label="Nome da tecla (apenas na interface)">
          {(id) => <Input id={id} value={keyConfig.name} maxLength={32} placeholder="Ex.: Abrir OBS" onChange={(e) => updateKey(pageId, index, { name: e.target.value })} />}
        </Field>
        <SegmentedControl label="Modo" value={a.mode} options={MODES} onChange={(mode) => patch({ mode })} />
        {a.mode === 'icon' && (
          <SegmentedControl label="Layout" size="sm" value={a.layout} options={LAYOUTS} iconOnly onChange={(layout) => patch({ layout })} />
        )}
        {a.mode === 'blank' && <p className="text-xs text-fg-dim">A tela fica apagada. Use o texto abaixo, se quiser escrever algo.</p>}
      </Section>

      {a.mode === 'icon' && showIcon && (
        <Section title="Ícone">
          <IconPicker value={a.icon.name} onPick={(name) => patch({ icon: { name } })} />
          <LiveSlider label="Tamanho" value={a.icon.size} min={8} max={56} unit=" px" onCommit={(size) => patch({ icon: { size } })} />
          <div className="grid grid-cols-2 gap-3">
            <LiveSlider label="Posição X" value={a.icon.x} min={-64} max={64} onCommit={(x) => patch({ icon: { x } })} />
            <LiveSlider label="Posição Y" value={a.icon.y} min={-32} max={32} onCommit={(y) => patch({ icon: { y } })} />
          </div>
          <LiveSlider label="Espessura do traço" value={a.icon.weight} min={100} max={700} step={100} onCommit={(weight) => patch({ icon: { weight } })} />
          <Switch checked={a.icon.fill} onChange={(fill) => patch({ icon: { fill } })} label="Ícone preenchido" />
        </Section>
      )}

      {a.mode === 'image' && (
        <Section title="Imagem">
          <ImageControls appearance={a} onPatch={patch} />
        </Section>
      )}

      {showLabel && (
        <Section title="Texto">
          <Field label="Rótulo">
            {(id) => (
              <Input id={id} value={a.label.text} maxLength={40} placeholder="Texto na tela" onChange={(e) => patch({ label: { text: e.target.value } })} />
            )}
          </Field>
          <LiveSlider label="Tamanho do texto" value={a.label.size} min={6} max={28} unit=" px" onCommit={(size) => patch({ label: { size } })} />
          <div className="grid grid-cols-2 gap-3">
            <LiveSlider label="Posição X" value={a.label.x} min={-64} max={64} onCommit={(x) => patch({ label: { x } })} />
            <LiveSlider label="Posição Y" value={a.label.y} min={-32} max={32} onCommit={(y) => patch({ label: { y } })} />
          </div>
          <Switch checked={a.label.bold} onChange={(bold) => patch({ label: { bold } })} label="Negrito" />
        </Section>
      )}

      <Section title="Conversão 1-bit">
        <LiveSlider label="Limiar (threshold)" value={a.threshold} min={0} max={255} onCommit={(threshold) => patch({ threshold })} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Switch checked={a.border} onChange={(border) => patch({ border })} label="Borda" />
          <Switch checked={a.invert} onChange={(invert) => patch({ invert })} label="Inverter" />
        </div>
        <Field label="Pontilhado (dither)">
          {(id) => (
            <Select id={id} value={a.dither} onChange={(e) => patch({ dither: e.target.value as DitherMode })}>
              {DITHERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>
    </div>
  );
}
