import { useCallback, useMemo } from 'react';
import type { DitherMode, FitMode, IconLayout, KeyAppearance, KeyConfig } from '@/core/types';
import { useDeckStore, type KeyAppearancePatch } from '@/store/deckStore';
import { Field, Input, SegmentedControl, Select, Switch } from '../../ui';
import { commonValue, isMixed } from '../commonValue';
import { IconPicker } from '../IconPicker';
import { LiveSlider } from '../LiveSlider';
import { Section } from '../Section';
import { BulkUtilities } from './BulkUtilities';

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

const FITS: { value: FitMode; label: string }[] = [
  { value: 'contain', label: 'Conter' },
  { value: 'cover', label: 'Cobrir' },
  { value: 'stretch', label: 'Esticar' },
];

const DITHERS: { value: DitherMode; label: string }[] = [
  { value: 'none', label: 'Nenhum (limiar)' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'bayer', label: 'Bayer (ordenado)' },
];

interface Props {
  pageId: string;
  indices: number[];
  keys: KeyConfig[];
}

/** Appearance controls that make sense for several keys at once; differing values show as "Misto". */
export function BulkAppearanceTab({ pageId, indices, keys }: Props) {
  const updateKeysAppearance = useDeckStore((s) => s.updateKeysAppearance);
  const patch = useCallback((p: KeyAppearancePatch) => void updateKeysAppearance(pageId, indices, p), [updateKeysAppearance, pageId, indices]);

  const c = useMemo(() => {
    const of = <T,>(fn: (a: KeyAppearance) => T) => commonValue(keys.map((k) => fn(k.appearance)));
    return {
      mode: of((a) => a.mode),
      layout: of((a) => a.layout),
      icon: of((a) => a.icon.name),
      iconSize: of((a) => a.icon.size),
      text: of((a) => a.label.text),
      labelSize: of((a) => a.label.size),
      border: of((a) => a.border),
      invert: of((a) => a.invert),
      threshold: of((a) => a.threshold),
      dither: of((a) => a.dither),
      fit: commonValue(keys.map((k) => k.appearance.image?.fit)),
      zoom: commonValue(keys.map((k) => k.appearance.image?.zoom)),
      allImages: keys.every((k) => k.appearance.mode === 'image' && k.appearance.image !== null),
    };
  }, [keys]);

  const first = keys[0].appearance;

  return (
    <div>
      <Section title="Tipo de conteúdo">
        <SegmentedControl label="Modo" value={isMixed(c.mode) ? null : c.mode} options={MODES} onChange={(mode) => patch({ mode })} />
        <SegmentedControl label="Layout" size="sm" iconOnly value={isMixed(c.layout) ? null : c.layout} options={LAYOUTS} onChange={(layout) => patch({ layout })} />
        {(isMixed(c.mode) || isMixed(c.layout)) && <p className="text-[11px] text-fg-dim">Misto: escolher aqui aplica o mesmo valor a todas as teclas.</p>}
      </Section>

      <Section title="Ícone">
        <IconPicker value={isMixed(c.icon) ? '' : c.icon} onPick={(name) => patch({ icon: { name } })} />
        <LiveSlider label="Tamanho do ícone" value={first.icon.size} mixed={isMixed(c.iconSize)} min={8} max={56} unit=" px" onCommit={(size) => patch({ icon: { size } })} />
      </Section>

      <Section title="Texto">
        <Field label="Rótulo">
          {(id) => (
            <Input
              id={id}
              value={isMixed(c.text) ? '' : c.text}
              maxLength={40}
              placeholder={isMixed(c.text) ? 'Vários valores' : 'Texto na tela'}
              onChange={(e) => patch({ label: { text: e.target.value } })}
            />
          )}
        </Field>
        <LiveSlider label="Tamanho do texto" value={first.label.size} mixed={isMixed(c.labelSize)} min={6} max={28} unit=" px" onCommit={(size) => patch({ label: { size } })} />
      </Section>

      {c.allImages && (
        <Section title="Imagem">
          <SegmentedControl label="Ajuste da imagem" size="sm" value={isMixed(c.fit) || c.fit === undefined ? null : c.fit} options={FITS} onChange={(fit) => patch({ image: { fit } })} />
          <LiveSlider label="Zoom" value={first.image?.zoom ?? 1} mixed={isMixed(c.zoom)} min={0.25} max={4} step={0.05} unit="×" onCommit={(zoom) => patch({ image: { zoom } })} />
        </Section>
      )}

      <Section title="Conversão 1-bit">
        <LiveSlider label="Limiar (threshold)" value={first.threshold} mixed={isMixed(c.threshold)} min={0} max={255} onCommit={(threshold) => patch({ threshold })} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Switch checked={!isMixed(c.border) && c.border} mixed={isMixed(c.border)} onChange={(border) => patch({ border })} label="Borda" />
          <Switch checked={!isMixed(c.invert) && c.invert} mixed={isMixed(c.invert)} onChange={(invert) => patch({ invert })} label="Inverter" />
        </div>
        <Field label="Pontilhado (dither)">
          {(id) => (
            <Select id={id} value={isMixed(c.dither) ? '' : c.dither} onChange={(e) => patch({ dither: e.target.value as DitherMode })}>
              {isMixed(c.dither) && (
                <option value="" disabled>
                  Misto
                </option>
              )}
              {DITHERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>

      <BulkUtilities pageId={pageId} indices={indices} keys={keys} />
    </div>
  );
}
