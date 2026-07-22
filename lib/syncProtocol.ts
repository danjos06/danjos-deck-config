import { DanjosDeckConfig, ButtonAction } from './types';
import { getKeyCode, getKeyName } from './keyMap';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function syncConfigViaWiFi(
  ipAddress: string,
  config: DanjosDeckConfig,
  onProgress: (msg: string, progress: number) => void
) {
  const baseUrl = `http://${ipAddress}`;

  const sendCommand = async (cmd: string) => {
    const res = await fetch(`${baseUrl}/command`, {
      method: 'POST',
      body: cmd,
      headers: { 'Content-Type': 'text/plain' }
    });
    if (!res.ok) throw new Error(`Command failed: ${cmd}`);
  };

  const uploadFile = async (filename: string, data: Uint8Array) => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
    formData.append('file', blob, filename);
    const res = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(`Upload failed: ${filename}`);
  };

  onProgress('Starting WiFi sync...', 0);
  await sendCommand('CLEAR');

  onProgress('Setting pages...', 10);
  await sendCommand(`PAGES ${config.pages.length}`);

  // Helper to send actions
  const sendAction = async (btnIdx: number, pageIdx: number, action: ButtonAction) => {
    let type = 0;
    let mod = 0;
    let key = 0;
    let v1 = 0;
    let v2 = 0;

    if (action.type === 'keyboard' && action.keyboard) {
      type = 1;
      if (action.keyboard.modifiers) {
        if (action.keyboard.modifiers.leftCtrl) mod |= 1;
        if (action.keyboard.modifiers.leftShift) mod |= 2;
        if (action.keyboard.modifiers.leftAlt) mod |= 4;
        if (action.keyboard.modifiers.leftGui) mod |= 8;
        if (action.keyboard.modifiers.rightCtrl) mod |= 16;
        if (action.keyboard.modifiers.rightShift) mod |= 32;
        if (action.keyboard.modifiers.rightAlt) mod |= 64;
      }
      key = getKeyCode(action.keyboard.key || '');
    } else if (action.type === 'consumer' && action.consumer) {
      type = 2;
      key = getKeyCode(action.consumer || '');
    } else if (action.type === 'mouse' && action.mouse) {
      type = 3;
      if (action.mouse.actionType === 'click') {
        key = action.mouse.button === 'left' ? 1 : action.mouse.button === 'right' ? 2 : 3;
      } else if (action.mouse.actionType === 'move') {
        key = 4;
        v1 = action.mouse.x || 0;
        v2 = action.mouse.y || 0;
      } else if (action.mouse.actionType === 'scroll') {
        key = 5;
        v1 = action.mouse.amount || 0;
      }
    } else if (action.type === 'folder') {
      type = 5;
      const targetPageId = action.folder?.targetPageId;
      const targetIdx = config.pages.findIndex(p => p.id === targetPageId);
      key = targetIdx !== -1 ? targetIdx : (action.folder?.targetPageIndex ?? 0);
    } else if (action.type === 'back') {
      type = 6;
      key = 255;
    } else if (action.type === 'sequence' && action.sequence) {
      type = 4;
      for (let i = 0; i < action.sequence.length; i++) {
        const step = action.sequence[i];
        let st = 0, sm = 0, sk = 0, sv1 = 0, sv2 = 0, sd = step.delayMs || 0;
        if (step.type === 'keyboard' && step.keyboard) {
          st = 1;
          if (step.keyboard.modifiers) {
            if (step.keyboard.modifiers.leftCtrl) sm |= 1;
            if (step.keyboard.modifiers.leftShift) sm |= 2;
            if (step.keyboard.modifiers.leftAlt) sm |= 4;
            if (step.keyboard.modifiers.leftGui) sm |= 8;
            if (step.keyboard.modifiers.rightCtrl) sm |= 16;
            if (step.keyboard.modifiers.rightShift) sm |= 32;
            if (step.keyboard.modifiers.rightAlt) sm |= 64;
          }
          sk = getKeyCode(step.keyboard.key || '');
        } else if (step.type === 'consumer' && step.consumer) {
          st = 2;
          sk = getKeyCode(step.consumer || '');
        } else if (step.type === 'mouse' && step.mouse) {
          st = 3;
          if (step.mouse.actionType === 'click') {
            sk = step.mouse.button === 'left' ? 1 : step.mouse.button === 'right' ? 2 : 3;
          } else if (step.mouse.actionType === 'move') {
            sk = 4;
            sv1 = step.mouse.x || 0;
            sv2 = step.mouse.y || 0;
          } else if (step.mouse.actionType === 'scroll') {
            sk = 5;
            sv1 = step.mouse.amount || 0;
          }
        } else if (step.type === 'delay') {
          st = 4;
        }
        await sendCommand(`SEQ ${btnIdx} ${pageIdx} ${i} ${st} ${sm} ${sk} ${sv1} ${sv2} ${sd}`);
      }
    }

    await sendCommand(`ACT ${btnIdx} ${pageIdx} ${type} ${mod} ${key} ${v1} ${v2}`);
  };

  let totalButtons = config.pages.length * 6;
  let processedButtons = 0;

  // Sync Pins
  if (config.pins) {
    const pins = [
      config.pins.btn1, config.pins.btn2, config.pins.btn3, config.pins.btn4, config.pins.btn5, config.pins.btn6,
      config.pins.btnPrev, config.pins.btnNext, config.pins.enc1Clk, config.pins.enc1Dt, config.pins.enc1Btn,
      config.pins.enc2Clk, config.pins.enc2Dt, config.pins.enc2Btn, config.pins.sda, config.pins.scl
    ];
    for (let i = 0; i < pins.length; i++) {
      await sendCommand(`P ${i} ${pins[i]}`);
    }
  }

  // Sync PC IP
  if (config.pcIp !== undefined) {
    await sendCommand(`PCIP ${config.pcIp}`);
  }

  for (let p = 0; p < config.pages.length; p++) {
    const page = config.pages[p];
    for (let b = 0; b < 6; b++) {
      const btn = page.buttons[b];
      if (!btn) continue;
      
      const action = btn.action;
      if (action) {
        await sendAction(b, p, action);
      }

      // Send bitmap
      if (btn.bitmap && btn.bitmap.length === 1024) {
        onProgress(`Sending image for Page ${p + 1}, Button ${b + 1}...`, 10 + (processedButtons / totalButtons) * 80);
        
        const bytes = new Uint8Array(btn.bitmap);
        await uploadFile(`b_${b}_${p}.bin`, bytes);
      }
      processedButtons++;
    }
  }

  onProgress('Sending encoder settings...', 95);
  await sendAction(6, 0, config.encoder1.cwAction);
  await sendAction(7, 0, config.encoder1.ccwAction);
  await sendAction(8, 0, config.encoder1.btnAction);
  
  await sendAction(9, 0, config.encoder2.cwAction);
  await sendAction(10, 0, config.encoder2.ccwAction);
  await sendAction(11, 0, config.encoder2.btnAction);

  onProgress('Saving configuration...', 98);
  await sendCommand('SAVE');

  onProgress('Sync complete!', 100);
}

export async function syncConfigToDevice(
  config: DanjosDeckConfig,
  writeText: (text: string) => Promise<void>,
  writeBinary: (data: Uint8Array) => Promise<void>,
  setOnLineReceived: (callback: ((line: string) => void) | null) => void,
  onProgress: (msg: string, progress: number) => void
) {
  const waitForResponse = (expected: string, timeoutMs: number = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        setOnLineReceived(null);
        reject(new Error(`Timeout waiting for ${expected}`));
      }, timeoutMs);

      setOnLineReceived((line) => {
        if (line === expected) {
          clearTimeout(timeout);
          setOnLineReceived(null);
          resolve();
        }
      });
    });
  };

  try {
    onProgress('Starting sync...', 0);
    
    // 1. Clear existing configuration
    await writeText('CLEAR');
    await waitForResponse('OK', 10000); // Format might take longer

    // 2. Set number of pages
    onProgress('Setting pages...', 10);
    await writeText(`PAGES ${config.pages.length}`);
    await waitForResponse('OK', 2000);

    // Send PC IP config
    onProgress('Sending PC IP configuration...', 12);
    if (config.pcIp !== undefined) {
      await writeText(`PCIP ${config.pcIp}`);
      await waitForResponse('OK', 2000);
    }

    // Helper to send actions
    const sendAction = async (btnIdx: number, pageIdx: number, action: ButtonAction) => {
      let type = 0;
      let mod = 0;
      let key = 0;
      let v1 = 0;
      let v2 = 0;

      if (action.type === 'keyboard' && action.keyboard) {
        type = 1;
        if (action.keyboard.modifiers) {
          if (action.keyboard.modifiers.leftCtrl) mod |= 1;
          if (action.keyboard.modifiers.leftShift) mod |= 2;
          if (action.keyboard.modifiers.leftAlt) mod |= 4;
          if (action.keyboard.modifiers.leftGui) mod |= 8;
          if (action.keyboard.modifiers.rightCtrl) mod |= 16;
          if (action.keyboard.modifiers.rightShift) mod |= 32;
          if (action.keyboard.modifiers.rightAlt) mod |= 64;
        }
        key = getKeyCode(action.keyboard.key || '');
      } else if (action.type === 'consumer' && action.consumer) {
        type = 2;
        key = getKeyCode(action.consumer || '');
      } else if (action.type === 'mouse' && action.mouse) {
        type = 3;
        if (action.mouse.actionType === 'click') {
          key = action.mouse.button === 'left' ? 1 : action.mouse.button === 'right' ? 2 : 3;
        } else if (action.mouse.actionType === 'move') {
          key = 4;
          v1 = action.mouse.x || 0;
          v2 = action.mouse.y || 0;
        } else if (action.mouse.actionType === 'scroll') {
          key = 5;
          v1 = action.mouse.amount || 0;
        }
      } else if (action.type === 'folder') {
        type = 5;
        const targetPageId = action.folder?.targetPageId;
        const targetIdx = config.pages.findIndex(p => p.id === targetPageId);
        key = targetIdx !== -1 ? targetIdx : (action.folder?.targetPageIndex ?? 0);
      } else if (action.type === 'back') {
        type = 6;
        key = 255;
      } else if (action.type === 'sequence' && action.sequence) {
        type = 4;
        for (let i = 0; i < action.sequence.length; i++) {
          const step = action.sequence[i];
          let st = 0, sm = 0, sk = 0, sv1 = 0, sv2 = 0, sd = step.delayMs || 0;
          if (step.type === 'keyboard' && step.keyboard) {
            st = 1;
            if (step.keyboard.modifiers) {
              if (step.keyboard.modifiers.leftCtrl) sm |= 1;
              if (step.keyboard.modifiers.leftShift) sm |= 2;
              if (step.keyboard.modifiers.leftAlt) sm |= 4;
              if (step.keyboard.modifiers.leftGui) sm |= 8;
              if (step.keyboard.modifiers.rightCtrl) sm |= 16;
              if (step.keyboard.modifiers.rightShift) sm |= 32;
              if (step.keyboard.modifiers.rightAlt) sm |= 64;
            }
            sk = getKeyCode(step.keyboard.key || '');
          } else if (step.type === 'consumer' && step.consumer) {
            st = 2;
            sk = getKeyCode(step.consumer || '');
          } else if (step.type === 'mouse' && step.mouse) {
            st = 3;
            if (step.mouse.actionType === 'click') {
              sk = step.mouse.button === 'left' ? 1 : step.mouse.button === 'right' ? 2 : 3;
            } else if (step.mouse.actionType === 'move') {
              sk = 4;
              sv1 = step.mouse.x || 0;
              sv2 = step.mouse.y || 0;
            } else if (step.mouse.actionType === 'scroll') {
              sk = 5;
              sv1 = step.mouse.amount || 0;
            }
          } else if (step.type === 'delay') {
            st = 4;
          }
          await writeText(`SEQ ${btnIdx} ${pageIdx} ${i} ${st} ${sm} ${sk} ${sv1} ${sv2} ${sd}`);
          await waitForResponse('OK', 2000);
        }
      }

      await writeText(`ACT ${btnIdx} ${pageIdx} ${type} ${mod} ${key} ${v1} ${v2}`);
      await waitForResponse('OK', 2000);
    };

    // 3. Send pins
    onProgress('Sending pin configuration...', 5);
    if (config.pins) {
      const pins = config.pins;
      await writeText(`P ${pins.btn1} ${pins.btn2} ${pins.btn3} ${pins.btn4} ${pins.btn5} ${pins.btn6} ${pins.btnPrev} ${pins.btnNext} ${pins.enc1Clk} ${pins.enc1Dt} ${pins.enc1Btn} ${pins.enc2Clk} ${pins.enc2Dt} ${pins.enc2Btn} ${pins.sda} ${pins.scl}`);
      await waitForResponse('OK', 2000);
    }

    // 3. Send button actions and bitmaps
    let totalButtons = config.pages.length * 6;
    let processedButtons = 0;

    for (let p = 0; p < config.pages.length; p++) {
      const page = config.pages[p];
      for (let b = 0; b < 6; b++) {
        const btn = page.buttons[b];
        if (!btn) continue;
        
        const action = btn.action;
        if (action) {
          await sendAction(b, p, action);
        }

        // Send bitmap
        if (btn.bitmap && btn.bitmap.length === 1024) {
          onProgress(`Sending image for Page ${p + 1}, Button ${b + 1}...`, 10 + (processedButtons / totalButtons) * 80);
          
          const bytes = new Uint8Array(btn.bitmap);

          await writeText(`BITMAP ${b} ${p}`);
          await waitForResponse('READY', 2000);
          await writeBinary(bytes);
          await waitForResponse('OK', 5000);
        }
        processedButtons++;
      }
    }

    // 4. Send encoder actions
    onProgress('Sending encoder settings...', 95);
    // Encoder 1 (slots 6, 7, 8)
    await sendAction(6, 0, config.encoder1.cwAction);
    await sendAction(7, 0, config.encoder1.ccwAction);
    await sendAction(8, 0, config.encoder1.btnAction);
    // Encoder 2 (slots 9, 10, 11)
    await sendAction(9, 0, config.encoder2.cwAction);
    await sendAction(10, 0, config.encoder2.ccwAction);
    await sendAction(11, 0, config.encoder2.btnAction);

    // 5. Commit and reload
    onProgress('Finalizing...', 99);
    await writeText('SAVE');
    await waitForResponse('OK', 5000);

    onProgress('Sync complete!', 100);
  } catch (error: any) {
    setOnLineReceived(null);
    onProgress(`Sync failed: ${error.message}`, 0);
    throw error;
  }
}

export async function importConfigFromDevice(
  writeText: (text: string) => Promise<void>,
  setOnLineReceived: (callback: ((line: string) => void) | null) => void,
  onProgress: (msg: string, progress: number) => void
): Promise<DanjosDeckConfig> {
  return new Promise((resolve, reject) => {
    onProgress('Requesting configuration...', 0);
    
    let configLines: string[] = [];
    let bitmaps: { b: number, p: number, hex: string }[] = [];
    let state = 'WAITING_CONFIG'; // WAITING_CONFIG, READING_CONFIG, READING_BITMAPS

    const timeout = setTimeout(() => {
      setOnLineReceived(null);
      reject(new Error('Timeout reading configuration from device'));
    }, 15000);

    setOnLineReceived((line) => {
      if (state === 'WAITING_CONFIG') {
        if (line.startsWith('PAGES ') || line.startsWith('ACTION ')) {
          state = 'READING_CONFIG';
          configLines.push(line);
          onProgress('Reading configuration...', 20);
        } else if (line === 'END_CONFIG') {
          state = 'READING_BITMAPS';
          onProgress('Reading images...', 50);
        }
      } else if (state === 'READING_CONFIG') {
        if (line === 'END_CONFIG') {
          state = 'READING_BITMAPS';
          onProgress('Reading images...', 50);
        } else {
          configLines.push(line);
        }
      } else if (state === 'READING_BITMAPS') {
        if (line === 'END_EXPORT') {
          clearTimeout(timeout);
          setOnLineReceived(null);
          onProgress('Parsing configuration...', 90);
          try {
            const parsedConfig = parseExportedConfig(configLines, bitmaps);
            onProgress('Import complete!', 100);
            resolve(parsedConfig);
          } catch (e) {
            reject(e);
          }
        } else if (line.startsWith('BITMAP_HEX ')) {
          const parts = line.split(' ');
          if (parts.length >= 4) {
            bitmaps.push({
              b: parseInt(parts[1]),
              p: parseInt(parts[2]),
              hex: parts[3]
            });
          }
        }
      }
    });

    writeText('EXPORT').catch(err => {
      clearTimeout(timeout);
      setOnLineReceived(null);
      reject(err);
    });
  });
}

function parseExportedConfig(lines: string[], bitmaps: { b: number, p: number, hex: string }[]): DanjosDeckConfig {
  const config: DanjosDeckConfig = {
    pages: [],
    encoder1: {
      cwAction: { type: 'none' },
      ccwAction: { type: 'none' },
      btnAction: { type: 'none' }
    },
    encoder2: {
      cwAction: { type: 'none' },
      ccwAction: { type: 'none' },
      btnAction: { type: 'none' }
    },
    pins: {
      btn1: 1, btn2: 2, btn3: 3, btn4: 4, btn5: 5, btn6: 6,
      btnPrev: 7, btnNext: 15,
      enc1Clk: 16, enc1Dt: 17, enc1Btn: 18,
      enc2Clk: 21, enc2Dt: 22, enc2Btn: 23,
      sda: 8, scl: 9
    }
  };

  let totalPages = 1;

  for (const line of lines) {
    if (line.startsWith('PAGES ')) {
      totalPages = parseInt(line.substring(6)) || 1;
    } else if (line.startsWith('PCIP ')) {
      config.pcIp = line.substring(5).trim();
    }
  }

  for (let i = 0; i < totalPages; i++) {
    config.pages.push({
      id: `page-${Date.now()}-${i}`,
      name: `Page ${i + 1}`,
      buttons: Array(6).fill(null).map((_, idx) => ({
        id: `btn-${Date.now()}-${i}-${idx}`,
        label: '',
        bitmap: Array(1024).fill(0),
        action: { type: 'none' }
      })) as any
    });
  }

  for (const line of lines) {
    if (line.startsWith('ACTION ')) {
      const parts = line.split(' ');
      if (parts.length >= 6) {
        const b = parseInt(parts[1]);
        const p = parseInt(parts[2]);
        const type = parseInt(parts[3]);
        const mod = parseInt(parts[4]);
        const key = parseInt(parts[5]);

        let action: ButtonAction = { type: 'none' };
        
        if (type === 1) {
          action = {
            type: 'keyboard',
            keyboard: {
              key: getKeyName(key, 1),
              modifiers: {
                leftCtrl: (mod & 1) !== 0,
                leftShift: (mod & 2) !== 0,
                leftAlt: (mod & 4) !== 0,
                leftGui: (mod & 8) !== 0,
                rightCtrl: (mod & 16) !== 0,
                rightShift: (mod & 32) !== 0,
                rightAlt: (mod & 64) !== 0,
              }
            }
          };
        } else if (type === 2) {
          const consumerName = getKeyName(key, 2);
          if (consumerName) {
            action = {
              type: 'consumer',
              consumer: consumerName as any
            };
          }
        } else if (type === 5) {
          action = {
            type: 'folder',
            folder: { targetPageIndex: key }
          };
        } else if (type === 6) {
          action = {
            type: 'back',
            folder: { targetPageId: 'back' }
          };
        }

        if (b >= 0 && b < 6 && p >= 0 && p < totalPages) {
          config.pages[p].buttons[b].action = action;
        } else if (b === 6) {
          config.encoder1.cwAction = action;
        } else if (b === 7) {
          config.encoder1.ccwAction = action;
        } else if (b === 8) {
          config.encoder1.btnAction = action;
        } else if (b === 9) {
          config.encoder2.cwAction = action;
        } else if (b === 10) {
          config.encoder2.ccwAction = action;
        } else if (b === 11) {
          config.encoder2.btnAction = action;
        }
      }
    }
  }

  for (const bmp of bitmaps) {
    if (bmp.p >= 0 && bmp.p < totalPages && bmp.b >= 0 && bmp.b < 6) {
      const bytes = new Uint8Array(1024);
      for (let i = 0; i < 1024; i++) {
        bytes[i] = parseInt(bmp.hex.substring(i * 2, i * 2 + 2), 16);
      }
      config.pages[bmp.p].buttons[bmp.b].bitmap = Array.from(bytes);
    }
  }

  return config;
}
