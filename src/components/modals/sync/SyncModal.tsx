import { useRef } from 'react';
import { isAbortError } from '@/core/protocol/transport';
import { isSerialSupported, SerialTransport } from '@/core/protocol/serial';
import { runSync } from '@/core/protocol/sync';
import type { Transport } from '@/core/protocol/transport';
import { isMixedContentBlocked, normalizeIp, probeDevice, WifiTransport } from '@/core/protocol/wifi';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore, type SyncTransportKind } from '@/store/uiStore';
import { Badge, Button, Field, Icon, Input, Modal, PanelSwitch, SegmentedControl, toast } from '../../ui';
import { StepList, SuccessMark, SyncLog } from './SyncProgressView';

function Notice({ tone, icon, children }: { tone: 'warn' | 'info' | 'danger'; icon: string; children: React.ReactNode }) {
  const cls = { warn: 'border-warn/30 bg-warn/10 text-warn', info: 'border-sky-300/20 bg-sky-300/10 text-sky-200', danger: 'border-danger/30 bg-danger/10 text-danger' }[tone];
  return (
    <p className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-snug ${cls}`}>
      <Icon name={icon} size={16} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

export function SyncModal() {
  const open = useUiStore((s) => s.modal === 'sync');
  const close = useUiStore((s) => s.closeModal);
  const sync = useUiStore((s) => s.sync);
  const ui = useUiStore;
  const ip = useDeckStore((s) => s.config.network.deviceIp);
  const setNetwork = useDeckStore((s) => s.setNetwork);
  const abort = useRef<AbortController | null>(null);

  const serialOk = isSerialSupported();
  const wifi = sync.transport === 'wifi';
  const normalized = normalizeIp(ip);
  const ipError = wifi && ip.trim() !== '' && !normalized ? 'Endereço inválido. Use algo como 192.168.0.50 ou danjos-deck.local.' : null;
  const busy = sync.status === 'syncing';
  const showForm = sync.status === 'idle' || sync.status === 'testing' || (sync.status === 'error' && sync.progress === null);

  const test = async () => {
    const s = ui.getState();
    s.beginTest();
    s.pushSyncLog('info', `Testando ${normalized}…`);
    const probe = await probeDevice(ip);
    ui.getState().finishTest(probe);
    ui.getState().pushSyncLog(probe.ok ? 'rx' : 'error', probe.ok ? `Dispositivo respondeu em ${probe.latencyMs} ms (firmware ${probe.firmware}).` : (probe.error ?? 'Sem resposta.'));
  };

  const start = async () => {
    const s = ui.getState();
    const ctrl = new AbortController();
    abort.current = ctrl;
    s.beginSync();
    let transport: Transport | null = null;
    try {
      if (wifi) {
        if (!normalized) throw new Error('Informe um IP válido do dispositivo.');
        transport = new WifiTransport(normalized);
        ui.getState().pushSyncLog('info', `Conectando por Wi-Fi em ${normalized}…`);
      } else {
        ui.getState().pushSyncLog('info', 'Escolha a porta serial na janela do navegador…');
        const st = await SerialTransport.request();
        st.onLog = (dir, line) => ui.getState().pushSyncLog(dir, line);
        transport = st;
      }
      await runSync(
        useDeckStore.getState().config,
        transport,
        (p) => {
          ui.getState().setSyncProgress(p);
          if (wifi || p.phase === 'done') ui.getState().pushSyncLog('info', p.label);
        },
        ctrl.signal,
      );
      ui.getState().syncSuccess();
      toast.success('Deck sincronizado com sucesso.');
    } catch (e) {
      const msg = isAbortError(e) ? 'Sincronização cancelada.' : e instanceof Error ? e.message : 'Falha desconhecida na sincronização.';
      ui.getState().pushSyncLog('error', msg);
      ui.getState().syncError(msg);
    } finally {
      try {
        await transport?.close?.();
      } catch {
        /* ignore */
      }
      abort.current = null;
    }
  };

  const probe = sync.lastProbe;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Sincronizar com o deck"
      subtitle="Envia ícones, ações e pinos para o dispositivo"
      className="[--w:620px]"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {busy ? (
            <Button variant="danger" icon="stop_circle" onClick={() => abort.current?.abort()}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Fechar
              </Button>
              {sync.status === 'success' ? (
                <Button icon="replay" onClick={() => ui.getState().resetSync()}>
                  Nova sincronização
                </Button>
              ) : (
                <Button variant="primary" icon={sync.status === 'error' && sync.progress ? 'replay' : 'sync'} disabled={sync.status === 'testing' || (wifi && !normalized)} onClick={() => void start()}>
                  {sync.status === 'error' && sync.progress ? 'Tentar novamente' : 'Iniciar sincronização'}
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        {showForm && (
          <>
            <SegmentedControl<SyncTransportKind>
              label="Meio de conexão"
              value={sync.transport}
              onChange={(t) => ui.getState().setSyncTransport(t)}
              options={[
                { value: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
                { value: 'serial', label: 'USB Serial', icon: 'usb', disabled: !serialOk, title: serialOk ? undefined : 'Seu navegador não suporta Web Serial. Use Chrome ou Edge.' },
              ]}
            />
            {!serialOk && <p className="-mt-2 text-[11px] text-fg-dim">USB Serial indisponível: este navegador não suporta Web Serial (use Chrome ou Edge).</p>}

            <PanelSwitch panelKey={sync.transport}>
            {wifi ? (
              <>
                <Field label="IP ou hostname do dispositivo" error={ipError} hint="Aparece no monitor serial ao ligar o deck, ou use hostname.local no firmware v2.">
                  {(id) => (
                    <div className="flex gap-2">
                      <Input id={id} mono invalid={!!ipError} inputMode="url" placeholder="192.168.0.50" value={ip} onChange={(e) => setNetwork({ deviceIp: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && normalized && void test()} />
                      <Button icon="network_check" loading={sync.status === 'testing'} disabled={!normalized} onClick={() => void test()}>
                        Testar conexão
                      </Button>
                    </div>
                  )}
                </Field>
                {isMixedContentBlocked() && (
                  <Notice tone="warn" icon="https">
                    Esta página está em HTTPS e o navegador bloqueia requisições HTTP para o dispositivo (conteúdo misto). Abra o configurador por HTTP/localhost ou use USB Serial.
                  </Notice>
                )}
                {probe && sync.status !== 'testing' && (
                  <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm ${probe.ok ? 'border-ok/25 bg-ok/10' : 'border-danger/30 bg-danger/10'}`}>
                    <Icon name={probe.ok ? 'check_circle' : 'error'} fill size={18} className={probe.ok ? 'text-ok' : 'text-danger'} />
                    {probe.ok ? (
                      <>
                        <span className="text-fg">Conectado</span>
                        <Badge tone="neutral">{probe.latencyMs} ms</Badge>
                        <Badge tone={probe.firmware === 'v2' ? 'accent' : 'warn'}>{probe.firmware === 'v2' ? 'Firmware v2' : 'Firmware antigo'}</Badge>
                        {probe.firmware === 'legacy' && <span className="w-full text-xs text-fg-muted">No firmware antigo, os endereços I2C e canais do multiplexador não são aplicados.</span>}
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 text-xs text-danger">{probe.error}</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <Notice tone="info" icon="usb">
                Conecte o ESP32-S3 por USB. Ao iniciar, o navegador pedirá para escolher a porta serial. Feche o monitor serial do Arduino IDE antes.
              </Notice>
            )}
            </PanelSwitch>
            {sync.status === 'error' && sync.error && !probe && <Notice tone="danger" icon="error">{sync.error}</Notice>}
          </>
        )}

        {!showForm && (
          <>
            {sync.status === 'success' && (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <SuccessMark />
                <p className="text-base font-semibold text-fg">Deck atualizado</p>
                <p className="text-xs text-fg-muted">Tudo foi gravado na memória do dispositivo.</p>
              </div>
            )}
            {sync.status === 'error' && sync.error && <Notice tone="danger" icon="error">{sync.error}</Notice>}
            <StepList progress={sync.progress} status={sync.status === 'success' ? 'success' : sync.status === 'error' ? 'error' : 'syncing'} />
          </>
        )}

        <details open={!showForm} className="group">
          <summary className="mb-2 cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim hover:text-fg-muted">Registro</summary>
          <SyncLog />
        </details>
      </div>
    </Modal>
  );
}
