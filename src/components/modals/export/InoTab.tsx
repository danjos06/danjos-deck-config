import { useDeferredValue, useEffect, useState } from 'react';
import { copyText, downloadText } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { Button, Field, IconButton, Input, Icon, toast } from '../../ui';
import { CodeView } from './CodeView';

type GenModule = typeof import('@/core/firmware/generate');

function useFirmware(open: boolean): { code: string | null; error: string | null; filename: string } {
  const config = useDeckStore((s) => s.config);
  const deferred = useDeferredValue(config);
  const [mod, setMod] = useState<GenModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mod) return;
    import('@/core/firmware/generate')
      .then(setMod)
      .catch(() => setError('Não foi possível carregar o gerador de firmware.'));
  }, [open, mod]);

  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !mod) return;
    try {
      setCode(mod.generateFirmware(deferred));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar o firmware.');
    }
  }, [open, mod, deferred]);

  return { code, error, filename: mod?.FIRMWARE_FILENAME ?? 'danjos_deck_firmware.ino' };
}

export function InoTab({ open }: { open: boolean }) {
  const net = useDeckStore((s) => s.config.network);
  const setNetwork = useDeckStore((s) => s.setNetwork);
  const { code, error, filename } = useFirmware(open);
  const [showPw, setShowPw] = useState(false);

  const lines = code ? code.split('\n').length : 0;
  const kb = code ? (new Blob([code]).size / 1024).toFixed(1) : '0';

  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="rounded-xl border border-white/[0.06] bg-ink-950/60 p-3">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">Rede (gravada no firmware)</h3>
          <div className="space-y-3">
            <Field label="Wi-Fi (SSID)">
              {(id) => <Input id={id} value={net.wifiSsid} autoComplete="off" placeholder="Nome da rede" onChange={(e) => setNetwork({ wifiSsid: e.target.value })} />}
            </Field>
            <Field label="Senha do Wi-Fi">
              {(id) => (
                <div className="relative">
                  <Input id={id} type={showPw ? 'text' : 'password'} autoComplete="off" value={net.wifiPassword} className="pr-9" onChange={(e) => setNetwork({ wifiPassword: e.target.value })} />
                  <IconButton
                    size="sm"
                    noTooltip
                    icon={showPw ? 'visibility_off' : 'visibility'}
                    label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPw((v) => !v)}
                  />
                </div>
              )}
            </Field>
            <Field label="Hostname (mDNS)" hint="Acesse por hostname.local (firmware v2).">
              {(id) => <Input id={id} mono value={net.hostname} placeholder="danjos-deck" onChange={(e) => setNetwork({ hostname: e.target.value.replace(/[^a-zA-Z0-9-]/g, '') })} />}
            </Field>
            <Field label="IP do PC (opcional)" hint="Apaga as telas quando o PC está offline.">
              {(id) => <Input id={id} mono value={net.pcIp} placeholder="192.168.0.10" onChange={(e) => setNetwork({ pcIp: e.target.value.trim() })} />}
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            icon="content_copy"
            disabled={!code}
            onClick={async () => {
              if (code && (await copyText(code))) toast.success('Código .ino copiado.');
              else toast.error('Não foi possível copiar o código.');
            }}
          >
            Copiar
          </Button>
          <Button
            className="flex-1"
            variant="primary"
            icon="download"
            disabled={!code}
            onClick={() => {
              if (!code) return;
              downloadText(filename, code, 'text/x-arduino');
              toast.success(`${filename} baixado.`);
            }}
          >
            Baixar .ino
          </Button>
        </div>
        <ol className="space-y-1.5 text-[11.5px] leading-snug text-fg-dim">
          <li>1. Arduino IDE com core ESP32 3.x, placa ESP32-S3, USB Mode: USB-OTG (TinyUSB).</li>
          <li>2. Abra o .ino baixado, compile e grave.</li>
          <li>3. Depois use Sincronizar para enviar ícones e ações sem regravar.</li>
        </ol>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-[11px] text-fg-dim">
          <span className="truncate font-mono">{filename}</span>
          <span>
            {lines.toLocaleString('pt-BR')} linhas · {kb} KB
          </span>
        </div>
        <div className="max-h-[min(62dvh,640px)] min-h-[260px] overflow-auto rounded-xl border border-white/[0.06] bg-ink-950">
          {error ? (
            <p className="flex items-center gap-2 p-4 text-sm text-danger">
              <Icon name="error" size={18} /> {error}
            </p>
          ) : code ? (
            <CodeView code={code} />
          ) : (
            <div className="flex h-60 items-center justify-center gap-2 text-sm text-fg-dim">
              <Icon name="progress_activity" className="animate-spin" size={18} /> Gerando firmware…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
