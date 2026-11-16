import { useRef, useState } from 'react';
import { exportConfigJson, importConfigJson, readLegacyLocalStorage } from '@/core/configIO';
import type { DeckConfig } from '@/core/types';
import { downloadText } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { Button, Icon, Switch, toast } from '../../ui';

function Card({ icon, title, text, children }: { icon: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/[0.06] bg-ink-950/60 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 text-accent">
          <Icon name={icon} size={20} />
        </span>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">{text}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function BackupTab() {
  const config = useDeckStore((s) => s.config);
  const setConfig = useDeckStore((s) => s.setConfig);
  const [secrets, setSecrets] = useState(false);
  const [pending, setPending] = useState<{ cfg: DeckConfig; source: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const cfg = importConfigJson(await file.text());
      setPending({ cfg, source: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.');
    }
  };

  const importLegacy = () => {
    const cfg = readLegacyLocalStorage();
    if (!cfg) toast.error('Nenhuma configuração antiga encontrada neste navegador (localStorage).');
    else setPending({ cfg, source: 'configuração antiga (localStorage)' });
  };

  const apply = () => {
    if (!pending) return;
    setConfig(pending.cfg);
    toast.success('Configuração importada.');
    setPending(null);
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card icon="download" title="Exportar backup" text="Salva toda a configuração (páginas, ícones, ações, pinos) em um arquivo JSON que você pode restaurar depois.">
          <Button
            variant="primary"
            icon="download"
            onClick={() => {
              downloadText('danjos-deck-backup.json', exportConfigJson(config, { includeSecrets: secrets }), 'application/json');
              toast.success('Backup baixado.');
            }}
          >
            Baixar JSON
          </Button>
          <Switch checked={secrets} onChange={setSecrets} label="Incluir senha do Wi-Fi" />
        </Card>
        <Card icon="upload_file" title="Importar backup" text="Carrega um arquivo JSON (v2 ou da versão antiga). A configuração atual será substituída após confirmação.">
          <Button icon="upload_file" onClick={() => input.current?.click()}>
            Escolher arquivo…
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Arquivo de backup JSON"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Card>
        <Card icon="history" title="Config antiga" text="Se você usava a versão anterior do configurador neste navegador, traga suas páginas e botões de volta.">
          <Button icon="history" onClick={importLegacy}>
            Importar (localStorage)
          </Button>
        </Card>
      </div>

      {pending && (
        <div role="alertdialog" aria-label="Confirmar importação" className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4">
          <Icon name="warning" size={20} className="text-warn" />
          <p className="min-w-0 flex-1 text-sm text-fg">
            Substituir a configuração atual por “{pending.cfg.name}” ({pending.cfg.pages.length} {pending.cfg.pages.length === 1 ? 'página' : 'páginas'}) vinda de {pending.source}? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button variant="primary" icon="check" onClick={apply}>
              Substituir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
