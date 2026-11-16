import type { GpioTag, PinId } from '../types';

/** GPIO numbers that exist on the ESP32-S3: 0-21 and 26-48 (22-25 do not exist). */
export function gpioExists(gpio: number): boolean {
  return Number.isInteger(gpio) && ((gpio >= 0 && gpio <= 21) || (gpio >= 26 && gpio <= 48));
}

/** All existing GPIO numbers in ascending order. */
export const ESP32S3_GPIOS: readonly number[] = Array.from({ length: 49 }, (_, i) => i).filter(gpioExists);

export const GPIO_TAG_LABELS: Readonly<Record<GpioTag, string>> = {
  strapping: 'Strapping',
  usb: 'USB D-/D+',
  flash: 'Flash SPI',
  psram: 'PSRAM octal',
  jtag: 'JTAG',
  uart: 'UART0',
  adc: 'ADC',
  touch: 'Touch',
};

/** pt-BR display names of each configurable pin. */
export const PIN_LABELS: Readonly<Record<PinId, string>> = {
  btn0: 'Tecla 1', btn1: 'Tecla 2', btn2: 'Tecla 3', btn3: 'Tecla 4', btn4: 'Tecla 5', btn5: 'Tecla 6',
  prev: 'Página anterior', next: 'Próxima página',
  enc1Clk: 'Encoder 1 CLK', enc1Dt: 'Encoder 1 DT', enc1Sw: 'Encoder 1 botão',
  enc2Clk: 'Encoder 2 CLK', enc2Dt: 'Encoder 2 DT', enc2Sw: 'Encoder 2 botão',
  sda: 'I2C SDA', scl: 'I2C SCL',
};

const STRAPPING = new Set([0, 3, 45, 46]);
const UART0 = new Set([43, 44]);

/** Describes the capabilities / hazards of a GPIO. */
export function describeGpio(gpio: number): { exists: boolean; tags: GpioTag[]; note?: string } {
  if (!gpioExists(gpio)) {
    return { exists: false, tags: [], note: 'Este GPIO não existe no ESP32-S3 (22-25 são inexistentes).' };
  }
  const tags: GpioTag[] = [];
  const notes: string[] = [];
  if (STRAPPING.has(gpio)) {
    tags.push('strapping');
    notes.push('Pino de strapping: define o modo de boot; evite ligar algo que force nível durante o reset.');
  }
  if (gpio === 19 || gpio === 20) {
    tags.push('usb');
    notes.push('USB nativo (D-/D+): usado pelo HID do firmware.');
  }
  if (gpio >= 26 && gpio <= 32) {
    tags.push('flash');
    notes.push('Reservado para a flash SPI (e PSRAM quad).');
  }
  if (gpio >= 33 && gpio <= 37) {
    tags.push('psram');
    notes.push('Usado pela PSRAM octal em módulos R8/N8R8.');
  }
  if (gpio >= 39 && gpio <= 42) {
    tags.push('jtag');
    notes.push('Pino JTAG (MTCK/MTDO/MTDI/MTMS).');
  }
  if (UART0.has(gpio)) {
    tags.push('uart');
    notes.push('UART0 TX/RX: conflita com o log serial.');
  }
  if (gpio >= 1 && gpio <= 20) tags.push('adc');
  if (gpio >= 1 && gpio <= 14) tags.push('touch');
  return { exists: true, tags, note: notes.length ? notes.join(' ') : undefined };
}
