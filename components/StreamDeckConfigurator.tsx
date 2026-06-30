'use client';

import React, { useState, useEffect } from 'react';
import { DanjosDeckConfig, PageConfig, ButtonState } from '../lib/types';
import { loadConfig, saveConfig } from '../lib/storage';
import { generateDefaultBitmap, generateIconBitmap } from '../lib/imageConverter';
import ButtonGrid from './ButtonGrid';
import { SyncPanel } from './SyncPanel';
import SerialMonitor from './SerialMonitor';
import ActionModal from './ActionModal';
import PinsSettings from './PinsSettings';
import InstructionsTab from './InstructionsTab';
import { Settings2, Bell, Settings, User, ChevronLeft, ChevronRight, Trash2, Edit2, Plus, Layout, Cpu, BookOpen, Send, Wifi, Usb, RefreshCw, Sliders, Search } from 'lucide-react';
import { useSerial } from '../hooks/useSerial';
import { syncConfigToDevice, syncConfigViaWiFi } from '../lib/syncProtocol';
import Image from 'next/image';
import { translations, Language } from '../lib/i18n';

const DEFAULT_PINS = {
  btn1: 1, btn2: 2, btn3: 3, btn4: 4, btn5: 5, btn6: 6,
  btnPrev: 7, btnNext: 15,
  enc1Clk: 16, enc1Dt: 17, enc1Btn: 18,
  enc2Clk: 20, enc2Dt: 21, enc2Btn: 41,
  sda: 8, scl: 9
};

const DEFAULT_CONFIG: DanjosDeckConfig = {
  pages: [],
  encoder1: {
    cwAction: { type: 'consumer', consumer: 'VOLUME_INCREMENT' },
    ccwAction: { type: 'consumer', consumer: 'VOLUME_DECREMENT' },
    btnAction: { type: 'consumer', consumer: 'PLAY_PAUSE' }
  },
  encoder2: {
    cwAction: { type: 'consumer', consumer: 'VOLUME_INCREMENT' },
    ccwAction: { type: 'consumer', consumer: 'VOLUME_DECREMENT' },
    btnAction: { type: 'consumer', consumer: 'MUTE' }
  },
  pins: DEFAULT_PINS,
  pcIp: ''
};

const POPULAR_ICONS = [
  // Media & Controls
  'play_arrow', 'pause', 'stop', 'skip_next', 'skip_previous', 'fast_forward', 'fast_rewind',
  'volume_up', 'volume_down', 'volume_mute', 'volume_off', 'mic', 'mic_off',
  'power_settings_new', 'settings', 'build', 'tune', 'home', 'search', 'refresh', 'close',
  
  // Custom / Devices
  'lightbulb', 'bolt', 'flash_on', 'palette', 'image', 'photo_camera', 'videocam', 'music_note',
  'language', 'desktop_windows', 'laptop', 'mouse', 'keyboard', 'gamepad', 'sports_esports',
  'terminal', 'code', 'bug_report', 'folder', 'star', 'favorite', 'thumb_up', 'thumb_down',
  
  // Apps & Communication
  'mail', 'chat', 'message', 'call', 'notifications', 'calendar_today', 'schedule', 'timer',
  
  // System / Connectivity
  'wifi', 'wifi_off', 'bluetooth', 'usb', 'battery_charging_full', 'lock', 'lock_open',
  
  // Directions / Navigation
  'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'navigation', 'map',
  'add', 'remove', 'exposure_plus_1', 'exposure_neg_1', 'calculate', 'equalizer',
  'open_in_new', 'public', 'cloud', 'cloud_upload', 'cloud_download', 'sync',
  'brightness_high', 'brightness_low', 'desktop_mac', 'computer', 'link', 'launch',
  'info', 'help', 'warning', 'error', 'check_circle', 'cancel', 'account_circle', 'group',
  'shopping_cart', 'attach_file', 'visibility', 'visibility_off', 'vpn_key', 'headset', 'rocket'
];

export default function StreamDeckConfigurator() {
  const [config, setConfig] = useState<DanjosDeckConfig | null>(null);
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [selectedButtonIdx, setSelectedButtonIdx] = useState<number | undefined>(undefined);
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<'config' | 'sync' | 'pins' | 'docs'>('config');
  
  // Sub-tabs for selected button config
  const [buttonSubTab, setButtonSubTab] = useState<'appearance' | 'action'>('appearance');
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  // Modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [editingButtonIdx, setEditingButtonIdx] = useState<number | undefined>(undefined);
  const [editingEncoderTarget, setEditingEncoderTarget] = useState<'cw1' | 'ccw1' | 'btn1' | 'cw2' | 'ccw2' | 'btn2' | undefined>(undefined);
  const [pageContextMenu, setPageContextMenu] = useState<{ x: number, y: number, pageIdx: number } | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);

  // Sync state
  const [ipAddress, setIpAddressState] = useState('');
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [quickSyncMethod, setQuickSyncMethod] = useState<'wifi' | 'usb' | null>(null);

  const updateButtonDesign = async (updates: Partial<ButtonState>) => {
    if (!config || selectedButtonIdx === undefined) return;
    
    const button = config.pages[selectedPageIdx].buttons[selectedButtonIdx];
    const newButton = { ...button, ...updates };
    
    const iconName = newButton.iconName ?? '';
    const iconLayout = newButton.iconLayout ?? 'icon-only';
    const iconSize = newButton.iconSize ?? 24;
    const iconXOffset = newButton.iconXOffset ?? 0;
    const iconYOffset = newButton.iconYOffset ?? 0;
    const textSize = newButton.textSize ?? 12;
    const textXOffset = newButton.textXOffset ?? 0;
    const textYOffset = newButton.textYOffset ?? 0;
    const showBorder = newButton.showBorder !== undefined ? newButton.showBorder : true;
    const label = newButton.label ?? '';

    const newBitmap = await generateIconBitmap({
      iconName,
      iconSize,
      iconXOffset,
      iconYOffset,
      label,
      textSize,
      textXOffset,
      textYOffset,
      layout: iconLayout,
      showBorder,
    });
    newButton.bitmap = newBitmap;

    const newConfig = { ...config };
    newConfig.pages[selectedPageIdx].buttons[selectedButtonIdx] = newButton;
    handleUpdateConfig(newConfig);
  };

  const setIpAddress = (ip: string) => {
    setIpAddressState(ip);
    localStorage.setItem('danjos_ip', ip);
  };

  const { 
    port, 
    isConnected, 
    logs, 
    connect, 
    disconnect, 
    writeText, 
    writeBinary, 
    clearLogs,
    setOnLineReceived
  } = useSerial();

  useEffect(() => {
    const savedIp = localStorage.getItem('danjos_ip');
    if (savedIp) setIpAddressState(savedIp);

    const timer = setTimeout(() => {
      const savedLang = localStorage.getItem('danjos_lang') as Language;
      if (savedLang === 'en' || savedLang === 'pt') {
        setLang(savedLang);
      }

      const loaded = loadConfig();
      if (loaded && loaded.pages && loaded.pages.length > 0) {
        if (!loaded.encoder1) {
          // Migration
          loaded.encoder1 = (loaded as any).encoder || DEFAULT_CONFIG.encoder1;
          loaded.encoder2 = DEFAULT_CONFIG.encoder2;
          loaded.pins = DEFAULT_CONFIG.pins;
        }
        setConfig(loaded);
      } else {
        const defaultBitmap = generateDefaultBitmap();
        const initialConfig = { ...DEFAULT_CONFIG };
        const defaultButtons: ButtonState[] = [
          { label: 'Color Pick', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: true, leftShift: true, leftCtrl: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 'c' } } },
          { label: 'New Tab', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: true, leftCtrl: true, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 't' } } },
          { label: 'Spotlight', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: true, leftAlt: true, leftCtrl: false, leftShift: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: ' ' } } },
          { label: 'App 2', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: true, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: '2' } } },
          { label: 'Context Menu', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: false, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 'HID_KEY_APPLICATION' } } },
          { label: 'Right Ctrl', bitmap: defaultBitmap, action: { type: 'keyboard', keyboard: { modifiers: { leftGui: false, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 'KEY_RIGHT_CTRL' } } }
        ];
        initialConfig.pages = [
          { id: 'p0', name: 'Page 1', buttons: JSON.parse(JSON.stringify(defaultButtons)) },
          { id: 'p1', name: 'Page 2', buttons: JSON.parse(JSON.stringify(defaultButtons)) }
        ];
        setConfig(initialConfig);
        saveConfig(initialConfig);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const t = translations[lang];

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('danjos_lang', newLang);
  };

  const showToast = (msg: string) => {
    const id = Date.now();
    setToast({ msg, id });
    setTimeout(() => setToast(current => current?.id === id ? null : current), 3000);
  };

  const handleUpdateConfig = (newConfig: DanjosDeckConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleUpdatePage = (newPage: PageConfig) => {
    if (!config) return;
    const newConfig = { ...config };
    newConfig.pages[selectedPageIdx] = newPage;
    handleUpdateConfig(newConfig);
  };

  const openButtonActionModal = (index: number) => {
    setEditingButtonIdx(index);
    setEditingEncoderTarget(undefined);
    setIsActionModalOpen(true);
  };

  const openEncoderActionModal = (target: 'cw1' | 'ccw1' | 'btn1' | 'cw2' | 'ccw2' | 'btn2') => {
    setEditingEncoderTarget(target);
    setEditingButtonIdx(undefined);
    setIsActionModalOpen(true);
  };

  const deletePageByIndex = (idx: number) => {
    if (!config || config.pages.length <= 1) return;
    const pageName = config.pages[idx].name;
    if (window.confirm(`${t.confirmDeletePage} (${pageName})`)) {
      const newPages = config.pages.filter((_, i) => i !== idx);
      const nextConfig = { ...config, pages: newPages };
      
      let nextIdx = selectedPageIdx;
      if (idx === selectedPageIdx) {
        nextIdx = Math.max(0, selectedPageIdx - 1);
      } else if (idx < selectedPageIdx) {
        nextIdx = selectedPageIdx - 1;
      }
      
      setSelectedPageIdx(nextIdx);
      handleUpdateConfig(nextConfig);
    }
  };

  const duplicatePage = (idx: number) => {
    if (!config || config.pages.length >= 8) return;
    const pageToDup = config.pages[idx];
    const newPage = JSON.parse(JSON.stringify(pageToDup));
    newPage.id = `p${Date.now()}`;
    
    let copySuffix = ' (Copy)';
    if (lang === 'pt') copySuffix = ' (Cópia)';
    newPage.name = `${pageToDup.name}${copySuffix}`;
    
    const newPages = [...config.pages];
    newPages.splice(idx + 1, 0, newPage);
    
    handleUpdateConfig({ ...config, pages: newPages });
    setSelectedPageIdx(idx + 1);
  };

  const clearButtonAction = () => {
    if (!config || selectedButtonIdx === undefined) return;
    const newConfig = { ...config };
    const defaultBitmap = generateDefaultBitmap();
    newConfig.pages[selectedPageIdx].buttons[selectedButtonIdx] = {
      label: '',
      bitmap: defaultBitmap,
      action: { type: 'none' }
    };
    handleUpdateConfig(newConfig);
    showToast(t.clearAction);
  };

  const renameCurrentPage = () => {
    if (!config) return;
    const newName = prompt(t.renamePage, config.pages[selectedPageIdx].name);
    if (newName && newName.trim()) {
      const newConfig = { ...config };
      newConfig.pages[selectedPageIdx].name = newName.trim();
      handleUpdateConfig(newConfig);
    }
  };

  const handleQuickSync = async () => {
    if (!config) return;
    if (!isConnected && !ipAddress) {
      showToast('Connect via USB or enter an IP address in the Sync tab first.');
      return;
    }

    setIsQuickSyncing(true);
    let method: 'usb' | 'wifi' = isConnected ? 'usb' : 'wifi';
    setQuickSyncMethod(method);
    
    try {
      if (method === 'usb') {
        showToast(t.syncing + ' (USB)');
        await syncConfigToDevice(config, writeText, writeBinary, setOnLineReceived, (msg) => {
          // You could show toast messages here if needed, but it might spam
        });
      } else {
        showToast(t.syncing + ' (WiFi)');
        await syncConfigViaWiFi(ipAddress, config, () => {});
      }
      showToast(lang === 'pt' ? 'Sincronização concluída!' : 'Sync complete!');
    } catch (err: any) {
      console.error(err);
      showToast((lang === 'pt' ? 'Erro na sincronização: ' : 'Sync error: ') + err.message);
    } finally {
      setIsQuickSyncing(false);
      setQuickSyncMethod(null);
    }
  };

  if (!config) return <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center text-white"><p>{translations[lang].loading}</p></div>;

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans">
      <header className="h-24 bg-[#1a1a1a] flex items-center justify-between px-6 flex-shrink-0 z-10 border-b border-[#2d2d2d]">
        <div className="flex items-center">
          <div className="w-24 h-24 relative">
            <Image src="https://i.imgur.com/700dwV5.png" alt="Logo" fill className="object-contain" unoptimized referrerPolicy="no-referrer" />
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex bg-[#252525] rounded-lg p-1 border border-[#3d3d3d]">
            <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center space-x-2 ${activeTab === 'config' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <Layout size={14} /><span>{t.editor}</span>
            </button>
            <button onClick={() => setActiveTab('sync')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center space-x-2 ${activeTab === 'sync' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <Cpu size={14} /><span>{t.sync}</span>
            </button>
            <button onClick={() => setActiveTab('pins')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center space-x-2 ${activeTab === 'pins' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <Settings size={14} /><span>{t.pinsSettings}</span>
            </button>
            <button onClick={() => setActiveTab('docs')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center space-x-2 ${activeTab === 'docs' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <BookOpen size={14} /><span>{t.instructions}</span>
            </button>
          </div>
          
          {/* Quick Sync Button */}
          <button 
            onClick={handleQuickSync}
            disabled={isQuickSyncing || (!isConnected && !ipAddress)}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg text-sm
              ${isQuickSyncing ? 'bg-orange-600 text-white animate-pulse' : 
                (isConnected || ipAddress) ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          >
            {isQuickSyncing ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span>{isQuickSyncing ? (lang === 'pt' ? 'Enviando...' : 'Sending...') : (lang === 'pt' ? 'Enviar' : 'Send')}</span>
            {(!isQuickSyncing && (isConnected || ipAddress)) && (
              <span className="ml-2 text-[10px] opacity-70">
                ({isConnected ? 'USB' : ipAddress})
              </span>
            )}
          </button>

          <div className="flex items-center space-x-3">
            <button onClick={() => handleLangChange('en')} className={`text-2xl transition-all ${lang === 'en' ? 'scale-110 opacity-100' : 'grayscale opacity-50'}`}>🇺🇸</button>
            <button onClick={() => handleLangChange('pt')} className={`text-2xl transition-all ${lang === 'pt' ? 'scale-110 opacity-100' : 'grayscale opacity-50'}`}>🇧🇷</button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]" onClick={() => setSelectedButtonIdx(undefined)}>
          {activeTab === 'config' ? (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
                <div className="flex items-center justify-center space-x-12 my-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-center space-y-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t.encoderL}</p>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3d3d3d] to-[#111] border-2 border-[#4d4d4d] shadow-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 transition-all active:scale-95" onClick={() => openEncoderActionModal('btn1')}>
                      <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#222] shadow-inner flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-gray-700 shadow-md"></div></div>
                    </div>
                    <div className="flex space-x-4">
                      <button onClick={() => openEncoderActionModal('ccw1')} className="text-xl text-gray-500 hover:text-white transition-colors">↺</button>
                      <button onClick={() => openEncoderActionModal('cw1')} className="text-xl text-gray-500 hover:text-white transition-colors">↻</button>
                    </div>
                  </div>

                  <ButtonGrid page={config.pages[selectedPageIdx]} onUpdatePage={handleUpdatePage} selectedButtonIdx={selectedButtonIdx} onSelectButton={setSelectedButtonIdx} t={t} />

                  <div className="flex flex-col items-center space-y-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t.encoderR}</p>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3d3d3d] to-[#111] border-2 border-[#4d4d4d] shadow-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 transition-all active:scale-95" onClick={() => openEncoderActionModal('btn2')}>
                      <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#222] shadow-inner flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-gray-700 shadow-md"></div></div>
                    </div>
                    <div className="flex space-x-4">
                      <button onClick={() => openEncoderActionModal('ccw2')} className="text-xl text-gray-500 hover:text-white transition-colors">↺</button>
                      <button onClick={() => openEncoderActionModal('cw2')} className="text-xl text-gray-500 hover:text-white transition-colors">↻</button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full max-w-2xl mt-8 px-8 mb-4" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setSelectedPageIdx((selectedPageIdx - 1 + config.pages.length) % config.pages.length)} className="p-4 rounded-full bg-[#252525] border border-[#3d3d3d] text-gray-400 hover:text-white hover:bg-[#333] transition-all"><ChevronLeft size={28} /></button>
                  <div className="flex items-center space-x-3 bg-black/40 rounded-full px-4 py-2 border border-[#3d3d3d] shadow-inner">
                    {config.pages.map((p, i) => (
                      <button 
                        key={p.id} 
                        onClick={() => setSelectedPageIdx(i)} 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setPageContextMenu({ x: e.clientX, y: e.clientY, pageIdx: i });
                        }}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${selectedPageIdx === i ? 'bg-blue-600 text-white shadow-lg scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => {
                      if (config.pages.length < 8) {
                        const newC = { ...config };
                        const bm = generateDefaultBitmap();
                        newC.pages.push({ id: `p${Date.now()}`, name: `${t.page} ${config.pages.length + 1}`, buttons: Array(6).fill(null).map(() => ({ label: '', bitmap: bm, action: { type: 'none' } })) });
                        handleUpdateConfig(newC);
                        setSelectedPageIdx(newC.pages.length - 1);
                      }
                    }} className="w-8 h-8 rounded-full text-gray-500 hover:text-white hover:bg-[#3d3d3d] flex items-center justify-center"><Plus size={18} /></button>
                  </div>
                  <button onClick={() => setSelectedPageIdx((selectedPageIdx + 1) % config.pages.length)} className="p-4 rounded-full bg-[#252525] border border-[#3d3d3d] text-gray-400 hover:text-white hover:bg-[#333] transition-all"><ChevronRight size={28} /></button>
                </div>
              </div>

              <div className="h-[460px] bg-[#1a1a1a] border-t border-[#2d2d2d] p-5 flex-shrink-0 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {selectedButtonIdx !== undefined ? (
                  <div className="flex flex-col h-full max-w-6xl mx-auto w-full overflow-hidden">
                    {/* Header Controls with Sub-tabs */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2d2d2d] flex-shrink-0">
                      <div className="flex items-center space-x-6">
                        <h3 className="text-sm font-bold text-gray-400 tracking-wider uppercase">
                          {t.buttonSettings} {selectedButtonIdx + 1}
                        </h3>
                        
                        {/* Sub Tab Switcher */}
                        <div className="flex bg-[#111] rounded-lg p-1 border border-[#2d2d2d]">
                          <button 
                            onClick={() => setButtonSubTab('appearance')} 
                            className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all ${buttonSubTab === 'appearance' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                          >
                            {t.screenTab}
                          </button>
                          <button 
                            onClick={() => setButtonSubTab('action')} 
                            className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all ${buttonSubTab === 'action' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                          >
                            {t.actionTab}
                          </button>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button onClick={renameCurrentPage} title={t.renamePage} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-[#252525]"><Edit2 size={16} /></button>
                        <button onClick={clearButtonAction} title={t.clearAction} className="p-2 text-red-500/60 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    {buttonSubTab === 'appearance' ? (
                      <div className="flex-1 grid grid-cols-12 gap-5 overflow-hidden">
                        {/* COLUMN 1: Google Icons Search & Selection */}
                        <div className="col-span-4 flex flex-col overflow-hidden border-r border-[#2d2d2d] pr-4">
                          <div className="relative mb-2 flex-shrink-0">
                            <input 
                              type="text" 
                              value={iconSearchQuery}
                              onChange={(e) => setIconSearchQuery(e.target.value)}
                              placeholder={t.searchIcons}
                              className="w-full bg-[#111] border border-[#2d2d2d] text-xs text-white pl-8 pr-4 py-2 rounded focus:outline-none focus:border-blue-500"
                            />
                            <div className="absolute left-2.5 top-2.5 text-gray-500">
                              <Search size={14} />
                            </div>
                          </div>

                          {/* Icons List Grid */}
                          <div className="flex-1 overflow-y-auto bg-black/40 border border-[#2d2d2d] rounded-lg p-2.5">
                            {/* Option to clear icon / select none */}
                            <div className="grid grid-cols-4 gap-2">
                              <button 
                                onClick={() => updateButtonDesign({ iconName: '' })}
                                className={`h-11 rounded flex flex-col items-center justify-center border transition-all text-[10px] font-medium ${!config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e1e1e] border-[#2d2d2d] text-gray-400 hover:text-white'}`}
                              >
                                <span className="text-[10px] opacity-60">None</span>
                              </button>

                              {/* Custom searched option if not found */}
                              {iconSearchQuery && !POPULAR_ICONS.includes(iconSearchQuery.toLowerCase()) && (
                                <button 
                                  onClick={() => updateButtonDesign({ iconName: iconSearchQuery.toLowerCase() })}
                                  className={`h-11 rounded flex flex-col items-center justify-center border transition-all px-1 ${config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName === iconSearchQuery.toLowerCase() ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-900/20 border-blue-600/30 text-blue-400 hover:text-blue-300'}`}
                                  title={`Use '${iconSearchQuery}'`}
                                >
                                  <span className="material-icons text-lg leading-none">{iconSearchQuery.toLowerCase()}</span>
                                  <span className="text-[8px] truncate max-w-full">Use Custom</span>
                                </button>
                              )}

                              {POPULAR_ICONS.filter(icon => icon.toLowerCase().includes(iconSearchQuery.toLowerCase())).map((ico) => (
                                <button 
                                  key={ico}
                                  onClick={() => updateButtonDesign({ iconName: ico })}
                                  className={`h-11 rounded flex flex-col items-center justify-center border transition-all hover:scale-105 active:scale-95 ${config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName === ico ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-[#1e1e1e] border-[#2d2d2d] text-gray-300 hover:text-white'}`}
                                  title={ico}
                                >
                                  <span className="material-icons text-xl leading-none">{ico}</span>
                                  <span className="text-[8px] opacity-50 truncate max-w-[40px] mt-0.5">{ico}</span>
                                </button>
                              ))}
                            </div>
                            {POPULAR_ICONS.filter(icon => icon.toLowerCase().includes(iconSearchQuery.toLowerCase())).length === 0 && !iconSearchQuery && (
                              <p className="text-center text-xs text-gray-500 py-6">No icons found.</p>
                            )}
                          </div>
                        </div>

                        {/* COLUMN 2: Appearance Customization */}
                        <div className="col-span-5 flex flex-col overflow-y-auto pr-2 space-y-3.5 border-r border-[#2d2d2d]">
                          {/* Layout Mode */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t.layout}</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['icon-only', 'icon-text-side', 'icon-text-below'] as const).map((l) => (
                                <button
                                  key={l}
                                  onClick={() => updateButtonDesign({ iconLayout: l })}
                                  className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-all ${config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconLayout === l || (!config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconLayout && l === 'icon-only') ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-[#111] border-[#2d2d2d] text-gray-400 hover:text-white'}`}
                                >
                                  {l === 'icon-only' ? t.iconOnly : l === 'icon-text-side' ? t.iconTextSide : t.iconTextBelow}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sizes Controls */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t.iconSize}</label>
                                <span className="text-[10px] font-mono text-gray-400">{config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconSize ?? 24}px</span>
                              </div>
                              <input 
                                type="range" 
                                min="8" 
                                max="48" 
                                value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconSize ?? 24}
                                onChange={(e) => updateButtonDesign({ iconSize: parseInt(e.target.value) })}
                                className="w-full h-1 bg-[#111] rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t.textSize}</label>
                                <span className="text-[10px] font-mono text-gray-400">{config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textSize ?? 12}px</span>
                              </div>
                              <input 
                                type="range" 
                                min="6" 
                                max="24" 
                                value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textSize ?? 12}
                                onChange={(e) => updateButtonDesign({ textSize: parseInt(e.target.value) })}
                                className="w-full h-1 bg-[#111] rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>

                          {/* Offset Coordinates */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Icon Offsets */}
                            <div className="space-y-2 p-2 bg-black/20 rounded-lg border border-[#252525]">
                              <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">{t.iconOffsets}</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-gray-500 font-mono">X: {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconXOffset ?? 0}px</span>
                                  <input 
                                    type="range" 
                                    min="-40" 
                                    max="40" 
                                    value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconXOffset ?? 0}
                                    onChange={(e) => updateButtonDesign({ iconXOffset: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#111] rounded appearance-none cursor-pointer accent-blue-500"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-gray-500 font-mono">Y: {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconYOffset ?? 0}px</span>
                                  <input 
                                    type="range" 
                                    min="-20" 
                                    max="20" 
                                    value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconYOffset ?? 0}
                                    onChange={(e) => updateButtonDesign({ iconYOffset: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#111] rounded appearance-none cursor-pointer accent-blue-500"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Text Offsets */}
                            <div className="space-y-2 p-2 bg-black/20 rounded-lg border border-[#252525]">
                              <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">{t.textOffsets}</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-gray-500 font-mono">X: {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textXOffset ?? 0}px</span>
                                  <input 
                                    type="range" 
                                    min="-40" 
                                    max="40" 
                                    value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textXOffset ?? 0}
                                    onChange={(e) => updateButtonDesign({ textXOffset: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#111] rounded appearance-none cursor-pointer accent-blue-500"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-gray-500 font-mono">Y: {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textYOffset ?? 0}px</span>
                                  <input 
                                    type="range" 
                                    min="-20" 
                                    max="20" 
                                    value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.textYOffset ?? 0}
                                    onChange={(e) => updateButtonDesign({ textYOffset: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#111] rounded appearance-none cursor-pointer accent-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Border Toggle & Quick Reset */}
                          <div className="flex items-center justify-between pt-1 flex-shrink-0">
                            <label className="flex items-center space-x-2.5 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.showBorder !== false}
                                onChange={(e) => updateButtonDesign({ showBorder: e.target.checked })}
                                className="w-3.5 h-3.5 rounded border-[#2d2d2d] bg-[#111] text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-gray-300">{t.showBorder}</span>
                            </label>

                            <button
                              onClick={() => updateButtonDesign({
                                iconSize: 24,
                                iconXOffset: 0,
                                iconYOffset: 0,
                                textSize: 12,
                                textXOffset: 0,
                                textYOffset: 0,
                                showBorder: true,
                              })}
                              className="text-[10px] text-gray-500 hover:text-white transition-all font-mono uppercase tracking-wider bg-black/20 border border-[#2d2d2d] px-2 py-1 rounded"
                            >
                              Reset Layout
                            </button>
                          </div>
                        </div>

                        {/* COLUMN 3: Title & Label settings */}
                        <div className="col-span-3 flex flex-col justify-between pl-2">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t.titleLabel}</label>
                              <input 
                                type="text" 
                                value={config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.label || ''} 
                                onChange={(e) => updateButtonDesign({ label: e.target.value })}
                                className="w-full bg-[#111] border border-[#2d2d2d] text-xs text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 shadow-inner" 
                                placeholder={t.enterTitle} 
                              />
                            </div>

                            {/* Icon selection status */}
                            <div className="p-2.5 bg-[#111] rounded border border-[#2d2d2d] flex items-center space-x-2.5">
                              {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName ? (
                                <>
                                  <div className="w-8 h-8 rounded bg-[#1e1e1e] border border-[#2d2d2d] flex items-center justify-center text-white">
                                    <span className="material-icons text-xl">{config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName}</span>
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">Active Icon</p>
                                    <p className="text-xs text-blue-400 font-mono truncate">{config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.iconName}</p>
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs text-gray-500 italic">{t.noIcon}</p>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#2d2d2d] space-y-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block tracking-wider">{t.currentAction}</span>
                            <div className="text-[10px] font-mono text-blue-400 truncate bg-blue-900/10 border border-blue-900/20 px-2 py-1 rounded italic mb-1.5">
                              {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.action?.type || t.noAction}
                            </div>
                            <button 
                              onClick={() => openButtonActionModal(selectedButtonIdx)} 
                              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                            >
                              {t.editAction}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ACTION SUB-TAB */
                      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-6 space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{t.currentAction}</label>
                          <div className="w-full h-11 bg-[#111] border border-[#2d2d2d] text-xs text-blue-400 font-mono px-4 flex items-center rounded italic">
                            {config.pages[selectedPageIdx]?.buttons[selectedButtonIdx]?.action?.type || t.noAction}
                          </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-2">
                          <button 
                            onClick={clearButtonAction} 
                            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 rounded text-xs font-bold transition-all uppercase tracking-wider"
                          >
                            {t.clearAction}
                          </button>
                          <button 
                            onClick={() => openButtonActionModal(selectedButtonIdx)} 
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all uppercase tracking-wider shadow-lg"
                          >
                            {t.editAction}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 font-mono italic text-sm">{t.selectKey}</div>
                )}
              </div>
            </div>
          ) : activeTab === 'pins' ? (
            <div className="flex-1 flex overflow-hidden">
              <PinsSettings config={config} onUpdateConfig={handleUpdateConfig} t={t} lang={lang} />
            </div>
          ) : activeTab === 'docs' ? (
            <div className="flex-1 flex flex-col bg-[#111] overflow-hidden">
              <InstructionsTab t={t} lang={lang} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <SyncPanel config={config} isConnected={isConnected} onConnect={connect} writeText={writeText} writeBinary={writeBinary} setOnLineReceived={setOnLineReceived} onConfigImported={handleUpdateConfig} t={t} ipAddress={ipAddress} setIpAddress={setIpAddress} lang={lang} />
              <div className="mt-8 pt-8 border-t border-[#2d2d2d]"><SerialMonitor isConnected={isConnected} logs={logs} onConnect={connect} onDisconnect={disconnect} onSend={writeText} onClear={clearLogs} onToast={showToast} t={t} /></div>
            </div>
          )}
        </div>
      </main>

      <ActionModal 
        isOpen={isActionModalOpen} 
        onClose={() => setIsActionModalOpen(false)} 
        config={config} 
        pageIndex={selectedPageIdx} 
        buttonIndex={editingButtonIdx} 
        encoderTarget={editingEncoderTarget} 
        onSave={handleUpdateConfig} 
        lang={lang}
      />

      {pageContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPageContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setPageContextMenu(null); }} />
          <div 
            className="fixed z-50 bg-[#2d2d2d] border border-[#3d3d3d] rounded-lg shadow-2xl py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: pageContextMenu.y, left: pageContextMenu.x }}
          >
            <button 
              onClick={() => {
                duplicatePage(pageContextMenu.pageIdx);
                setPageContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
            >
              <Plus size={14} />
              <span>{t.duplicatePage}</span>
            </button>
            {config.pages.length > 1 && (
              <button 
                onClick={() => {
                  deletePageByIndex(pageContextMenu.pageIdx);
                  setPageContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500 hover:text-white flex items-center space-x-2 border-t border-[#3d3d3d]"
              >
                <Trash2 size={14} />
                <span>{t.deletePage}</span>
              </button>
            )}
          </div>
        </>
      )}

      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#2d2d2d] border border-[#3d3d3d] text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 animate-in slide-in-from-bottom-5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div><span className="text-xs font-bold uppercase tracking-widest">{toast.msg}</span></div>}
    </div>
  );
}
