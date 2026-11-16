import { useRef, useState } from 'react';
import { loadImageFile } from '@/core/bitmap/render';
import type { FitMode, KeyAppearance } from '@/core/types';
import { cn } from '@/lib/ui/cn';
import type { KeyAppearancePatch } from '@/store/deckStore';
import { Button, Icon, SegmentedControl, toast } from '../ui';
import { LiveSlider } from './LiveSlider';

const FIT: { value: FitMode; label: string }[] = [
  { value: 'contain', label: 'Conter' },
  { value: 'cover', label: 'Cobrir' },
  { value: 'stretch', label: 'Esticar' },
];

interface ImageControlsProps {
  appearance: KeyAppearance;
  onPatch: (p: KeyAppearancePatch) => void;
}

/** Upload (click or drag&drop) + fit / zoom / offset controls. */
export function ImageControls({ appearance, onPatch }: ImageControlsProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const img = appearance.image;

  const load = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type) && !/\.(png|jpe?g|svg|webp)$/i.test(file.name)) {
      toast.error('Formato não suportado. Use PNG, JPG, SVG ou WebP.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await loadImageFile(file);
      onPatch({ mode: 'image', image: { dataUrl, fit: 'contain', zoom: 1, offsetX: 0, offsetY: 0 } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void load(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
          over ? 'border-accent bg-accent/10' : 'border-white/15 bg-ink-950/50',
        )}
      >
        {img ? (
          <img src={img.dataUrl} alt="Imagem enviada" className="h-16 max-w-full rounded-md bg-white/10 object-contain" />
        ) : (
          <Icon name="add_photo_alternate" size={30} className="text-fg-dim" />
        )}
        <p className="text-xs text-fg-muted">{img ? 'Arraste outra imagem para substituir' : 'Arraste uma imagem aqui'}</p>
        <p className="text-[11px] text-fg-dim">PNG, JPG, SVG ou WebP · reduzida para 512 px</p>
        <div className="flex gap-2">
          <Button size="sm" icon="upload" loading={busy} onClick={() => input.current?.click()}>
            {img ? 'Trocar' : 'Escolher arquivo'}
          </Button>
          {img && (
            <Button size="sm" variant="ghost" icon="delete" onClick={() => onPatch({ image: null })}>
              Remover
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          aria-label="Enviar imagem"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {img && (
        <>
          <SegmentedControl label="Ajuste da imagem" size="sm" value={img.fit} options={FIT} onChange={(fit) => onPatch({ image: { fit } })} />
          <LiveSlider label="Zoom" value={img.zoom} min={0.25} max={4} step={0.05} unit="×" onCommit={(zoom) => onPatch({ image: { zoom } })} />
          <div className="grid grid-cols-2 gap-3">
            <LiveSlider label="Deslocamento X" value={img.offsetX} min={-128} max={128} onCommit={(offsetX) => onPatch({ image: { offsetX } })} />
            <LiveSlider label="Deslocamento Y" value={img.offsetY} min={-64} max={64} onCommit={(offsetY) => onPatch({ image: { offsetY } })} />
          </div>
        </>
      )}
    </div>
  );
}
