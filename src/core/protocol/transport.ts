/** Abstraction over the two ways of talking to the deck (HTTP over Wi-Fi, Web Serial). */
export interface Transport {
  readonly kind: 'wifi' | 'serial';
  /** Sends one protocol line (no trailing newline) and resolves when the device acknowledged it. */
  sendCommand(line: string, signal?: AbortSignal): Promise<void>;
  /** Uploads a 1024-byte bitmap for button `button` of page `page`. */
  sendBitmap(button: number, page: number, data: Uint8Array, signal?: AbortSignal): Promise<void>;
  close?(): Promise<void>;
}

/** Creates an AbortError with a pt-BR message. */
export function abortError(message = 'Operação cancelada.'): DOMException {
  return new DOMException(message, 'AbortError');
}

/** True when the error is an AbortError (user cancel). */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
