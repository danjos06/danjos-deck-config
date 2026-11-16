import type { DeckConfig } from '../types';
import {
  actionsSection,
  bitmapsSection,
  configSection,
  defaultsSection,
  displaySection,
  headerSection,
  includesSection,
  inputSection,
  mainSection,
  networkSection,
  protocolSection,
  prototypesSection,
  stateSection,
  storageSection,
} from './template';

export { escapeCString } from './template';

export const FIRMWARE_FILENAME = 'danjos_deck_firmware.ino';

/**
 * Generates the complete Arduino-ESP32 (core 3.x, ESP32-S3) sketch for `cfg`.
 * `opts.now` only exists to make the generation timestamp deterministic in tests.
 */
export function generateFirmware(cfg: DeckConfig, opts: { now?: Date } = {}): string {
  return [
    headerSection(cfg, opts.now ?? new Date()),
    includesSection(),
    configSection(cfg),
    bitmapsSection(cfg),
    stateSection(),
    prototypesSection(),
    displaySection(),
    defaultsSection(cfg),
    storageSection(),
    actionsSection(cfg),
    protocolSection(),
    networkSection(),
    inputSection(),
    mainSection(),
  ].join('\n');
}
