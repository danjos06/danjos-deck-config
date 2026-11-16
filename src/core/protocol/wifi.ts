import { BITMAP_BYTES } from '../bitmap/pack';
import { abortError, isAbortError, type Transport } from './transport';

export interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  firmware: 'legacy' | 'v2' | 'unknown';
  info?: Record<string, unknown>;
  error?: string;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Normalises user input into `host` or `host:port`. Accepts '192.168.0.10', 'http://192.168.0.10/',
 * 'host.local'. Returns null when it is neither a valid IPv4 address nor a valid hostname.
 */
export function normalizeIp(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0];
  let port = '';
  const m = /^(.*):(\d{1,5})$/.exec(s);
  if (m) {
    s = m[1];
    const p = Number(m[2]);
    if (p < 1 || p > 65535) return null;
    port = `:${p}`;
  }
  const v4 = IPV4.exec(s);
  if (v4) {
    const ok = v4.slice(1).every((o) => Number(o) <= 255);
    return ok ? `${v4.slice(1).map(Number).join('.')}${port}` : null;
  }
  if (/^[\d.]+$/.test(s)) return null; // looks like an IP but is malformed
  return HOSTNAME.test(s) ? `${s}${port}` : null;
}

/** True when the page is served over HTTPS: browsers block plain-HTTP requests to the device (mixed content). */
export function isMixedContentBlocked(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'https:';
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

class TimeoutError extends Error {}

async function fetchTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw abortError();
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (timedOut) throw new TimeoutError(`Tempo esgotado (${timeoutMs} ms) ao falar com o dispositivo.`);
    if (signal?.aborted) throw abortError();
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Probes the device: GET /info (v2 firmware JSON), falling back to GET / containing 'Danjos Deck' (legacy).
 */
export async function probeDevice(ip: string, timeoutMs = 4000): Promise<ProbeResult> {
  const host = normalizeIp(ip);
  if (!host) return { ok: false, latencyMs: 0, firmware: 'unknown', error: 'Endereço IP/host inválido.' };
  const base = `http://${host}`;
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);
  try {
    const res = await fetchTimeout(`${base}/info`, { method: 'GET' }, timeoutMs);
    if (res.ok) {
      try {
        const info = (await res.json()) as Record<string, unknown>;
        if (info && typeof info === 'object') return { ok: true, latencyMs: elapsed(), firmware: 'v2', info };
      } catch {
        /* not JSON: fall through to legacy probe */
      }
    }
    const res2 = await fetchTimeout(`${base}/`, { method: 'GET' }, timeoutMs);
    const text = await res2.text();
    if (res2.ok && text.includes('Danjos Deck')) return { ok: true, latencyMs: elapsed(), firmware: 'legacy' };
    return { ok: false, latencyMs: elapsed(), firmware: 'unknown', error: 'O dispositivo respondeu, mas não parece um Danjos Deck.' };
  } catch (e) {
    const msg =
      e instanceof TimeoutError
        ? e.message
        : isMixedContentBlocked()
          ? 'Falha de rede. Esta página usa HTTPS e o navegador bloqueia requisições HTTP ao dispositivo (conteúdo misto).'
          : 'Não foi possível conectar. Verifique o IP e se o dispositivo está na mesma rede.';
    return { ok: false, latencyMs: elapsed(), firmware: 'unknown', error: msg };
  }
}

/** HTTP transport over Wi-Fi: POST /command (text/plain, no CORS preflight) and POST /upload (multipart). */
export class WifiTransport implements Transport {
  readonly kind = 'wifi' as const;
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(ip: string, opts: { timeoutMs?: number; retries?: number } = {}) {
    const host = normalizeIp(ip);
    if (!host) throw new Error('Endereço IP/host inválido.');
    this.base = `http://${host}`;
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.retries = opts.retries ?? 2;
  }

  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetchTimeout(`${this.base}${path}`, init, this.timeoutMs, signal);
        if (!res.ok) throw new Error(`O dispositivo respondeu com erro HTTP ${res.status}.`);
        return res;
      } catch (e) {
        if (isAbortError(e) || (e instanceof Error && e.message.startsWith('O dispositivo respondeu'))) throw e;
        if (attempt >= this.retries) {
          if (e instanceof TimeoutError) throw e;
          throw new Error(
            isMixedContentBlocked()
              ? 'Falha de rede: o navegador bloqueia HTTP a partir de uma página HTTPS (conteúdo misto).'
              : 'Falha de rede ao falar com o dispositivo.',
          );
        }
        attempt++;
        await sleep(300 * 3 ** (attempt - 1), signal);
      }
    }
  }

  async sendCommand(line: string, signal?: AbortSignal): Promise<void> {
    if (/[\r\n]/.test(line)) throw new Error('Comando inválido: contém quebra de linha.');
    await this.request('/command', { method: 'POST', body: line, headers: { 'Content-Type': 'text/plain' } }, signal);
  }

  async sendBitmap(button: number, page: number, data: Uint8Array, signal?: AbortSignal): Promise<void> {
    if (data.length !== BITMAP_BYTES) throw new Error(`Bitmap inválido: esperado ${BITMAP_BYTES} bytes.`);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)], { type: 'application/octet-stream' }), `b_${button}_${page}.bin`);
    await this.request('/upload', { method: 'POST', body: form }, signal);
  }
}
