import { BITMAP_BYTES } from '../bitmap/pack';
import { abortError, type Transport } from './transport';

/** True when the browser supports the Web Serial API (Chromium-based browsers over HTTPS/localhost). */
export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

interface Waiter {
  expected: string;
  resolve: () => void;
  reject: (e: Error) => void;
  cleanup: () => void;
}

/** Reply timeout per command (CONTRACT §6.3). */
function commandTimeout(line: string): number {
  if (line === 'CLEAR') return 10000;
  if (line === 'SAVE') return 5000;
  return 2000;
}

/**
 * Web Serial transport (115200 8N1 by default). A persistent reader loop splits incoming data into lines;
 * `waitFor` consumes them from a queue that is reset before every command. Bitmaps follow the
 * BITMAP -> READY -> 1024 raw bytes -> OK flow. Pins are never sent as a single line.
 */
export class SerialTransport implements Transport {
  readonly kind = 'serial' as const;
  /** Optional hook to log traffic (tx = sent line, rx = received line). */
  onLog?: (dir: 'tx' | 'rx', line: string) => void;

  private readonly port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private inbox: string[] = [];
  private waiters: Waiter[] = [];
  private closed = false;
  private readLoop: Promise<void> = Promise.resolve();

  private constructor(port: SerialPort) {
    this.port = port;
  }

  /** Prompts the user to pick a serial port, opens it and starts the reader loop. */
  static async request(baud = 115200): Promise<SerialTransport> {
    if (!isSerialSupported()) throw new Error('Este navegador não suporta Web Serial. Use Chrome ou Edge.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baud });
    const t = new SerialTransport(port);
    t.readLoop = t.startReader();
    return t;
  }

  private async startReader(): Promise<void> {
    const readable = this.port.readable;
    if (!readable) return;
    this.reader = readable.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) this.handleLine(line);
        }
      }
    } catch {
      /* port closed or device unplugged */
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      this.failWaiters(new Error('Conexão serial encerrada (dispositivo desconectado?).'));
    }
  }

  private handleLine(line: string): void {
    this.onLog?.('rx', line);
    const w = this.waiters[0];
    if (w) {
      if (line === w.expected) {
        w.cleanup();
        w.resolve();
        return;
      }
      if (line === 'ERROR') {
        w.cleanup();
        w.reject(new Error('O dispositivo respondeu ERROR.'));
        return;
      }
    }
    this.inbox.push(line);
    if (this.inbox.length > 200) this.inbox.shift();
  }

  private failWaiters(err: Error): void {
    for (const w of [...this.waiters]) {
      w.cleanup();
      w.reject(err);
    }
  }

  /**
   * Resolves when a line equal to `expected` arrives (checking lines already queued first).
   * Rejects on `ERROR`, timeout, abort or disconnect. Unrelated lines (boot logs) are ignored.
   */
  waitFor(expected: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    const queued = this.inbox.indexOf(expected);
    if (queued >= 0) {
      this.inbox.splice(0, queued + 1);
      return Promise.resolve();
    }
    if (this.inbox.includes('ERROR')) {
      this.inbox.length = 0;
      return Promise.reject(new Error('O dispositivo respondeu ERROR.'));
    }
    if (this.closed) return Promise.reject(new Error('Conexão serial encerrada.'));
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        w.cleanup();
        reject(new Error(`Tempo esgotado aguardando "${expected}" do dispositivo (${timeoutMs} ms).`));
      }, timeoutMs);
      const onAbort = () => {
        w.cleanup();
        reject(abortError());
      };
      const w: Waiter = {
        expected,
        resolve,
        reject,
        cleanup: () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          this.waiters = this.waiters.filter((x) => x !== w);
        },
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(w);
    });
  }

  private async write(data: Uint8Array): Promise<void> {
    const writable = this.port.writable;
    if (!writable || this.closed) throw new Error('Porta serial não está aberta.');
    const writer = writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async sendCommand(line: string, signal?: AbortSignal): Promise<void> {
    const cmd = line.trim();
    if (!cmd || /[\r\n]/.test(cmd)) throw new Error('Comando inválido.');
    this.inbox.length = 0;
    const wait = this.waitFor('OK', commandTimeout(cmd), signal);
    wait.catch(() => undefined);
    this.onLog?.('tx', cmd);
    await this.write(new TextEncoder().encode(`${cmd}\n`));
    await wait;
  }

  async sendBitmap(button: number, page: number, data: Uint8Array, signal?: AbortSignal): Promise<void> {
    if (data.length !== BITMAP_BYTES) throw new Error(`Bitmap inválido: esperado ${BITMAP_BYTES} bytes.`);
    const cmd = `BITMAP ${button} ${page}`;
    this.inbox.length = 0;
    const ready = this.waitFor('READY', 2000, signal);
    ready.catch(() => undefined);
    this.onLog?.('tx', cmd);
    await this.write(new TextEncoder().encode(`${cmd}\n`));
    await ready;
    const ok = this.waitFor('OK', 5000, signal);
    ok.catch(() => undefined);
    this.onLog?.('tx', `<${BITMAP_BYTES} bytes>`);
    await this.write(data);
    await ok;
  }

  /** Cancels the reader and closes the port. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    await this.readLoop;
    try {
      await this.port.close();
    } catch {
      /* ignore */
    }
  }
}
