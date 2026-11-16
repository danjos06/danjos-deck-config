import { useEffect, useRef, useState } from 'react';
import { OLED_H, OLED_W, base64ToBitmap } from '@/core/bitmap/pack';
import { toCppArray } from '@/core/bitmap/cpp';
import { renderPreviewRGBA } from '@/core/bitmap/render';
import type { KeyAppearance } from '@/core/types';
import { copyText } from '@/lib/ui/format';
import { OledCanvas } from '../deck/OledCanvas';
import { Button, Switch, toast } from '../ui';

function SourcePreview({ appearance }: { appearance: KeyAppearance }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      renderPreviewRGBA(appearance)
        .then((img) => {
          if (alive) ref.current?.getContext('2d')?.putImageData(img, 0, 0);
        })
        .catch(() => undefined);
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [appearance]);
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden bg-black">
      <canvas ref={ref} width={OLED_W} height={OLED_H} className="pixelated absolute inset-0 h-full w-full" />
    </div>
  );
}

interface PreviewPanelProps {
  appearance: KeyAppearance;
  bitmap: string;
  symbol: string;
}

/** "Fonte" (pre-threshold) vs "OLED 1-bit" previews, with optional pixel grid and C++ export. */
export function PreviewPanel({ appearance, bitmap, symbol }: PreviewPanelProps) {
  const [grid, setGrid] = useState(false);

  const copy = async () => {
    const ok = await copyText(toCppArray(symbol, base64ToBitmap(bitmap)));
    if (ok) toast.success('Array C++ copiado para a área de transferência.');
    else toast.error('Não foi possível copiar. Verifique as permissões do navegador.');
  };

  return (
    <section aria-label="Pré-visualização" className="rounded-xl border border-white/[0.06] bg-ink-950/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <figure className="min-w-0">
          <div className="overflow-hidden rounded-lg ring-1 ring-white/10">
            <SourcePreview appearance={appearance} />
          </div>
          <figcaption className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-fg-dim">Fonte</figcaption>
        </figure>
        <figure className="min-w-0">
          <div className="overflow-hidden rounded-lg ring-1 ring-accent/30">
            <OledCanvas bitmap={bitmap} grid={grid} />
          </div>
          <figcaption className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-accent">OLED 1-bit</figcaption>
        </figure>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Switch checked={grid} onChange={setGrid} label="Grade de pixels" />
        <Button size="sm" icon="data_array" onClick={copy}>
          Copiar array C++
        </Button>
      </div>
    </section>
  );
}
