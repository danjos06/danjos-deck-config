'use client';

import React, { useState } from 'react';
import { Download, RefreshCw, Usb, Wifi, Trash2 } from 'lucide-react';
import { DanjosDeckConfig } from '@/lib/types';
import { syncConfigToDevice, importConfigFromDevice, syncConfigViaWiFi } from '@/lib/syncProtocol';
import { generateFirmware } from '@/lib/firmwareTemplate';

interface SyncPanelProps {
  config: DanjosDeckConfig;
  isConnected: boolean;
  onConnect: (baudRate?: number) => Promise<void>;
  writeText: (text: string) => Promise<void>;
  writeBinary: (data: Uint8Array) => Promise<void>;
  setOnLineReceived: (callback: ((line: string) => void) | null) => void;
  t: any;
  onConfigImported?: (config: DanjosDeckConfig) => void;
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  lang?: string;
}

export function SyncPanel({ config, isConnected, onConnect, writeText, writeBinary, setOnLineReceived, t, onConfigImported, ipAddress, setIpAddress, lang = 'en' }: SyncPanelProps) {
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [wifiError, setWifiError] = useState(false);

  const handleDownloadFirmware = () => {
    const firmware = generateFirmware(config, ssid, password);
    const blob = new Blob([firmware], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danjos_deck_firmware.ino';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadConfig = () => {
    // Generate config.txt content
    let content = `PAGES ${config.pages.length}\n`;
    config.pages.forEach((page, pIdx) => {
      page.buttons.forEach((btn, bIdx) => {
        if (btn.action.type !== 'none') {
          let type = btn.action.type === 'keyboard' ? 1 : 2;
          let mod = 0;
          if (btn.action.keyboard?.modifiers) {
            const m = btn.action.keyboard.modifiers;
            if (m.leftCtrl) mod |= 1;
            if (m.leftShift) mod |= 2;
            if (m.leftAlt) mod |= 4;
            if (m.leftGui) mod |= 8;
            if (m.rightCtrl) mod |= 16;
            if (m.rightShift) mod |= 32;
            if (m.rightAlt) mod |= 64;
          }
          // Note: This is a simplified version for manual upload
          content += `ACTION ${bIdx} ${pIdx} ${type} ${mod} 0\n`;
        }
      });
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSync = async () => {
    if (!isConnected) {
      onConnect();
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setWifiError(false);
    setSyncMessage(t.syncing);

    try {
      await syncConfigToDevice(config, writeText, writeBinary, setOnLineReceived, (msg, progress) => {
        setSyncMessage(msg);
        setSyncProgress(progress);
      });
      setTimeout(() => {
        setSyncMessage('');
        setSyncProgress(0);
        setIsSyncing(false);
      }, 3000);
    } catch (error) {
      setIsSyncing(false);
    }
  };

  const handleSyncWiFi = async () => {
    if (!ipAddress) {
      alert(t.ipAddressRequired);
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setWifiError(false);
    setSyncMessage(t.syncing);

    try {
      await syncConfigViaWiFi(ipAddress, config, (msg, progress) => {
        setSyncMessage(msg);
        setSyncProgress(progress);
      });
      setTimeout(() => {
        setSyncMessage('');
        setSyncProgress(0);
        setIsSyncing(false);
      }, 3000);
    } catch (error) {
      console.error(error);
      setWifiError(true);
      setSyncMessage(t.wifiSyncBlocked);
      setTimeout(() => setIsSyncing(false), 5000);
    }
  };

  const handleImport = async () => {
    if (!isConnected) {
      onConnect();
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage(t.importing);

    try {
      const importedConfig = await importConfigFromDevice(writeText, setOnLineReceived, (msg, progress) => {
        setSyncMessage(msg);
        setSyncProgress(progress);
      });
      if (onConfigImported) {
        onConfigImported(importedConfig);
      }
      setTimeout(() => {
        setSyncMessage('');
        setSyncProgress(0);
        setIsSyncing(false);
      }, 3000);
    } catch (error) {
      setIsSyncing(false);
    }
  };

  const handleClearDevice = async () => {
    if (!isConnected) {
      onConnect();
      return;
    }
    const confirmMsg = lang === 'pt' ? 'Tem certeza que deseja limpar tudo no ESP? Isso apagará todas as configurações e imagens salvas.' : 'Are you sure you want to clear everything on the ESP? This will delete all saved settings and images.';
    if (!window.confirm(confirmMsg)) return;

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage(lang === 'pt' ? 'Limpando ESP...' : 'Clearing ESP...');
    
    try {
      await writeText('CLEAR\n');
      setTimeout(() => {
        setSyncMessage(lang === 'pt' ? 'ESP limpo com sucesso!' : 'ESP cleared successfully!');
        setSyncProgress(100);
        setTimeout(() => {
          setSyncMessage('');
          setSyncProgress(0);
          setIsSyncing(false);
        }, 2000);
      }, 1000);
    } catch (error) {
      console.error(error);
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#252525]">
      <div className="p-4 border-b border-[#2d2d2d]">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gray-400" />
          {t.syncDevice}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {t.syncDesc}
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Step 1: Initial Firmware */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#3d3d3d] flex items-center justify-center text-xs font-bold text-gray-300">
              1
            </div>
            <h3 className="text-sm font-medium text-gray-200">{t.initialSetup}</h3>
          </div>
          <p className="text-xs text-gray-400 pl-8">
            {t.initialSetupDesc}
          </p>
          <div className="pl-8 space-y-3">
            <div className="space-y-2">
              <input
                type="text"
                placeholder={t.wifiSsid}
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#3d3d3d] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <input
                type="password"
                placeholder={t.wifiPass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#3d3d3d] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleDownloadFirmware}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 rounded transition-colors text-xs border border-[#3d3d3d]"
            >
              <Download className="w-3 h-3" />
              {t.downloadFirmware}
            </button>
          </div>
        </div>

        {/* Step 2: Sync Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#3d3d3d] flex items-center justify-center text-xs font-bold text-gray-300">
              2
            </div>
            <h3 className="text-sm font-medium text-gray-200">{t.syncConfig}</h3>
          </div>
          <p className="text-xs text-gray-400 pl-8">
            {t.syncConfigDesc}
          </p>
          
          <div className="pl-8 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors border ${
                  isConnected 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500' 
                    : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 border-[#3d3d3d]'
                } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Usb className="w-4 h-4" />
                )}
                USB
              </button>
              
              <button
                onClick={handleImport}
                disabled={isSyncing}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors border ${
                  isConnected 
                    ? 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 border-[#3d3d3d]' 
                    : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 border-[#3d3d3d]'
                } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Download className="w-4 h-4" />
                {t.import}
              </button>
            </div>

            <div className="pt-2 border-t border-[#3d3d3d] space-y-2">
              <input
                type="text"
                placeholder={t.ipPlaceholder}
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#3d3d3d] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSyncWiFi}
                disabled={isSyncing || !ipAddress}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors border ${
                  ipAddress && !isSyncing
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-500' 
                    : 'bg-[#2d2d2d] text-gray-500 border-[#3d3d3d] cursor-not-allowed'
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {t.wifiSync}
              </button>

              {wifiError && (
                <div className="bg-amber-900/20 border border-amber-600/50 rounded p-3 space-y-2">
                  <p className="text-[10px] text-amber-200 leading-tight">
                    <strong>{t.wifiWarnTitle}:</strong> {t.wifiWarnDesc}
                  </p>
                  <p className="text-[10px] text-amber-200 leading-tight">
                    {t.wifiWarnFix}
                  </p>
                  <button
                    onClick={handleDownloadConfig}
                    className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] rounded transition-colors"
                  >
                    {t.manualDownload}
                  </button>
                </div>
              )}
            </div>

            {syncMessage && (
              <div className="bg-[#1e1e1e] rounded p-3 border border-[#3d3d3d]">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span className="truncate mr-2">{syncMessage}</span>
                  <span>{Math.round(syncProgress)}%</span>
                </div>
                <div className="w-full bg-[#2d2d2d] rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-1 transition-all duration-300 ease-out"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="pt-4 border-t border-[#3d3d3d] space-y-3">
           <h3 className="text-sm font-medium text-red-400">{lang === 'pt' ? 'Zona de Perigo' : 'Danger Zone'}</h3>
           <p className="text-xs text-gray-400">
             {lang === 'pt' ? 'Isso irá limpar todas as configurações e imagens armazenadas no dispositivo.' : 'This will clear all configurations and images stored on the device.'}
           </p>
           <button
             onClick={handleClearDevice}
             disabled={!isConnected || isSyncing}
             className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors border ${
               isConnected && !isSyncing
                 ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border-red-900/50'
                 : 'bg-[#2d2d2d] text-gray-500 border-[#3d3d3d] cursor-not-allowed'
             }`}
           >
             <Trash2 className="w-4 h-4" />
             {lang === 'pt' ? 'Limpar ESP (Reset)' : 'Clear ESP (Reset)'}
           </button>
        </div>
      </div>
    </div>
  );
}
