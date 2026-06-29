'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DanjosDeckConfig, ButtonAction, ActionType, ConsumerAction, KeyModifiers, SequenceStep, SpotifyActionType } from '../lib/types';
import { X, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { translations, Language } from '../lib/i18n';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DanjosDeckConfig;
  pageIndex: number;
  buttonIndex?: number; // 0-5
  encoderTarget?: 'cw1' | 'ccw1' | 'btn1' | 'cw2' | 'ccw2' | 'btn2';
  onSave: (newConfig: DanjosDeckConfig) => void;
  lang: Language;
}

const CONSUMER_ACTIONS = (t: any): { value: ConsumerAction; label: string; icon: string }[] => [
  { value: 'VOLUME_INCREMENT', label: t.volUp, icon: '🔊+' },
  { value: 'VOLUME_DECREMENT', label: t.volDown, icon: '🔉-' },
  { value: 'PLAY_PAUSE', label: t.playPause, icon: '⏯' },
  { value: 'MUTE', label: t.mute, icon: '🔇' },
  { value: 'SCAN_NEXT_TRACK', label: t.nextTrack, icon: '⏭' },
  { value: 'SCAN_PREV_TRACK', label: t.prevTrack, icon: '⏮' },
  { value: 'STOP', label: t.stop, icon: '⏹' },
  { value: 'BRIGHTNESS_INCREMENT', label: t.brightnessUp, icon: '🔆' },
  { value: 'BRIGHTNESS_DECREMENT', label: t.brightnessDown, icon: '🔅' },
];

const COMMON_KEYS = (t: any): { group: string; keys: string[] }[] => [
  { group: t.lettersNumbers, keys: 'abcdefghijklmnopqrstuvwxyz0123456789'.split('') },
  { group: t.special, keys: [' ', 'KEY_RETURN', 'KEY_ESC', 'KEY_BACKSPACE', 'KEY_TAB', 'KEY_DELETE', 'KEY_INSERT', 'KEY_HOME', 'KEY_END', 'KEY_PAGE_UP', 'KEY_PAGE_DOWN', 'KEY_UP_ARROW', 'KEY_DOWN_ARROW', 'KEY_LEFT_ARROW', 'KEY_RIGHT_ARROW'] },
  { group: t.functionKeys, keys: Array.from({ length: 24 }, (_, i) => `KEY_F${i + 1}`) },
  { group: t.modifiersKeys, keys: ['KEY_LEFT_CTRL', 'KEY_LEFT_SHIFT', 'KEY_LEFT_ALT', 'KEY_LEFT_GUI', 'KEY_RIGHT_CTRL', 'KEY_RIGHT_SHIFT', 'KEY_RIGHT_ALT', 'KEY_RIGHT_GUI'] },
  { group: t.hidKeys, keys: ['HID_KEY_APPLICATION'] },
];

export default function ActionModal({ isOpen, onClose, config, pageIndex, buttonIndex, encoderTarget, onSave, lang }: ActionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [action, setAction] = useState<ButtonAction>({ type: 'none' });

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (encoderTarget) {
        const encoderMap: Record<string, ButtonAction> = {
          cw1: config.encoder1.cwAction,
          ccw1: config.encoder1.ccwAction,
          btn1: config.encoder1.btnAction,
          cw2: config.encoder2.cwAction,
          ccw2: config.encoder2.ccwAction,
          btn2: config.encoder2.btnAction,
        };
        const targetAction = encoderMap[encoderTarget];
        if (targetAction) setAction({ ...targetAction });
      } else if (buttonIndex !== undefined) {
        const btnAction = config.pages[pageIndex]?.buttons[buttonIndex]?.action;
        setAction(btnAction ? JSON.parse(JSON.stringify(btnAction)) : { type: 'none' });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, config, buttonIndex, encoderTarget, pageIndex]);

  if (!isOpen || !mounted) return null;

    const t = translations[lang];
    const consumerActions = CONSUMER_ACTIONS(t);
    const commonKeys = COMMON_KEYS(t);

  const handleSave = () => {
    const newConfig = JSON.parse(JSON.stringify(config)) as DanjosDeckConfig;
    if (encoderTarget) {
      if (encoderTarget === 'cw1') newConfig.encoder1.cwAction = action;
      else if (encoderTarget === 'ccw1') newConfig.encoder1.ccwAction = action;
      else if (encoderTarget === 'btn1') newConfig.encoder1.btnAction = action;
      else if (encoderTarget === 'cw2') newConfig.encoder2.cwAction = action;
      else if (encoderTarget === 'ccw2') newConfig.encoder2.ccwAction = action;
      else if (encoderTarget === 'btn2') newConfig.encoder2.btnAction = action;
    } else if (buttonIndex !== undefined) {
      newConfig.pages[pageIndex].buttons[buttonIndex].action = action;
    }
    onSave(newConfig);
    onClose();
  };

  const updateActionType = (type: ActionType) => {
    const newAction: ButtonAction = { type };
    if (type === 'keyboard') {
      newAction.keyboard = { modifiers: { leftGui: false, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 'a' };
    } else if (type === 'text') {
      newAction.text = 'Hello World';
    } else if (type === 'consumer') {
      newAction.consumer = 'VOLUME_INCREMENT';
    } else if (type === 'mouse') {
      newAction.mouse = { actionType: 'click', button: 'left' };
    } else if (type === 'cpp') {
      newAction.cpp = { code: 'Keyboard.print("Hello World!");' };
    } else if (type === 'sequence') {
      newAction.sequence = [];
    } else if (type === 'spotify') {
      newAction.spotify = { action: 'PLAY_PAUSE' };
    }
    setAction(newAction);
  };

  const addStep = () => {
    if (action.type !== 'sequence') return;
    const newSteps = [...(action.sequence || [])];
    newSteps.push({ type: 'keyboard', keyboard: { modifiers: { leftGui: false, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: 'a' }, delayMs: 100 });
    setAction({ ...action, sequence: newSteps });
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-[500px] h-full bg-[#1e1e1e] border-l border-[#2d2d2d] shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <h2 className="text-lg font-semibold text-white">{t.editAction}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#252525]"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">{t.actionType}</label>
            <div className="grid grid-cols-2 gap-2">
              {['none', 'keyboard', 'text', 'consumer', 'mouse', 'cpp', 'sequence', 'spotify'].map((type) => (
                <button
                  key={type}
                  onClick={() => updateActionType(type as ActionType)}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    action.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#252525] border-[#3d3d3d] text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                  }`}
                >
                  {t[type as keyof typeof t] || type}
                </button>
              ))}
            </div>
          </div>

          {action.type === 'keyboard' && action.keyboard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#171717] p-3 rounded border border-[#2d2d2d]">
                {Object.keys(action.keyboard.modifiers).map((mod) => (
                  <label key={mod} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={action.keyboard!.modifiers[mod as keyof KeyModifiers]}
                      onChange={(e) => {
                        const newAction = { ...action };
                        newAction.keyboard!.modifiers[mod as keyof KeyModifiers] = e.target.checked;
                        setAction(newAction);
                      }}
                      className="rounded text-blue-500"
                    />
                    <span className="text-[10px] text-gray-400">
                      {mod.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
              <select
                value={action.keyboard.key}
                onChange={(e) => setAction({ ...action, keyboard: { ...action.keyboard!, key: e.target.value } })}
                className="w-full bg-[#252525] border border-[#3d3d3d] text-xs text-white p-2 rounded"
              >
                {commonKeys.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.keys.map(k => <option key={k} value={k}>{k}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {action.type === 'text' && (
            <div className="space-y-4">
              <textarea
                value={action.text || ''}
                onChange={(e) => setAction({ ...action, text: e.target.value })}
                className="w-full h-32 bg-[#252525] border border-[#3d3d3d] text-xs text-white p-2 rounded focus:outline-none focus:border-blue-500"
                placeholder="Enter text to type..."
              />
            </div>
          )}

          {action.type === 'mouse' && action.mouse && (
            <div className="space-y-4">
              <select
                value={action.mouse.actionType}
                onChange={(e) => setAction({ ...action, mouse: { ...action.mouse!, actionType: e.target.value as any } })}
                className="w-full bg-[#252525] border border-[#3d3d3d] text-xs text-white p-2 rounded"
              >
                <option value="click">{t.mouseClick}</option>
                <option value="move">{t.mouseMove}</option>
                <option value="scroll">{t.mouseScroll}</option>
              </select>
              {action.mouse.actionType === 'click' && (
                <div className="flex space-x-2">
                  {['left', 'right', 'middle'].map(b => (
                    <button
                      key={b}
                      onClick={() => setAction({ ...action, mouse: { ...action.mouse!, button: b as any } })}
                      className={`flex-1 py-2 text-xs rounded border ${action.mouse!.button === b ? 'bg-blue-600' : 'bg-[#252525]'}`}
                    >
                      {t[b as keyof typeof t] || b}
                    </button>
                  ))}
                </div>
              )}
              {action.mouse.actionType === 'move' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500">X</label>
                    <input type="number" value={action.mouse.x || 0} onChange={(e) => setAction({ ...action, mouse: { ...action.mouse!, x: parseInt(e.target.value) } })} className="w-full bg-[#252525] border border-[#3d3d3d] text-xs p-2 rounded" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Y</label>
                    <input type="number" value={action.mouse.y || 0} onChange={(e) => setAction({ ...action, mouse: { ...action.mouse!, y: parseInt(e.target.value) } })} className="w-full bg-[#252525] border border-[#3d3d3d] text-xs p-2 rounded" />
                  </div>
                </div>
              )}
            </div>
          )}

          {action.type === 'cpp' && action.cpp && (
            <div className="space-y-2">
              <label className="text-sm text-gray-300">{t.cppCode}</label>
              <textarea
                value={action.cpp.code}
                onChange={(e) => setAction({ ...action, cpp: { code: e.target.value } })}
                className="w-full h-48 bg-black/40 border border-[#3d3d3d] rounded p-3 font-mono text-xs text-blue-300 focus:outline-none focus:border-blue-500"
                placeholder={t.cppPlaceholder}
              />
              <p className="text-[10px] text-yellow-500 italic">*{t.reflashWarning}</p>
            </div>
          )}

          {action.type === 'sequence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">{t.sequence}</label>
                <button onClick={addStep} className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"><Plus size={20} /></button>
              </div>
              <div className="space-y-3">
                {action.sequence?.map((step, idx) => (
                  <div key={idx} className="bg-black/20 border border-[#2d2d2d] rounded p-3 relative group">
                    <button onClick={() => {
                      const newSteps = [...action.sequence!];
                      newSteps.splice(idx, 1);
                      setAction({ ...action, sequence: newSteps });
                    }} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                    
                    <div className="flex space-x-2 mb-2">
                      <select value={step.type} onChange={(e) => {
                        const newSteps = [...action.sequence!];
                        newSteps[idx].type = e.target.value as any;
                        setAction({ ...action, sequence: newSteps });
                      }} className="bg-[#252525] border border-[#3d3d3d] text-[10px] p-1 rounded">
                        <option value="keyboard">{t.keyboard}</option>
                        <option value="consumer">{t.consumer}</option>
                        <option value="mouse">{t.mouse}</option>
                        <option value="delay">{t.delay}</option>
                      </select>
                      <input type="number" placeholder="Delay" value={step.delayMs || 0} onChange={(e) => {
                        const newSteps = [...action.sequence!];
                        newSteps[idx].delayMs = parseInt(e.target.value);
                        setAction({ ...action, sequence: newSteps });
                      }} className="w-16 bg-[#252525] border border-[#3d3d3d] text-[10px] p-1 rounded" />
                    </div>

                    {step.type === 'keyboard' && (
                      <div className="flex space-x-2">
                        <select
                          value={step.keyboard?.key}
                          onChange={(e) => {
                            const newSteps = [...action.sequence!];
                            newSteps[idx].keyboard = { modifiers: { leftGui: false, leftCtrl: false, leftShift: false, leftAlt: false, rightCtrl: false, rightShift: false, rightAlt: false }, key: e.target.value };
                            setAction({ ...action, sequence: newSteps });
                          }}
                          className="flex-1 bg-[#1a1a1a] border border-[#2d2d2d] text-[10px] text-white p-1 rounded"
                        >
                          {commonKeys.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.keys.map(k => <option key={k} value={k}>{k}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {action.type === 'consumer' && (
            <select
              value={action.consumer}
              onChange={(e) => setAction({ ...action, consumer: e.target.value as any })}
              className="w-full bg-[#252525] border border-[#3d3d3d] text-xs text-white p-2 rounded"
            >
              {consumerActions.map(ca => <option key={ca.value} value={ca.value}>{ca.icon} {ca.label}</option>)}
            </select>
          )}

          {action.type === 'spotify' && action.spotify && (
            <div className="space-y-4">
              <label className="text-xs text-gray-500">{t.spotifyAction || 'Spotify Action'}</label>
              <select
                value={action.spotify.action}
                onChange={(e) => setAction({ ...action, spotify: { action: e.target.value as SpotifyActionType } })}
                className="w-full bg-[#252525] border border-[#3d3d3d] text-xs text-white p-2 rounded"
              >
                <option value="PLAY_PAUSE">⏯ {t.playPause || 'Play / Pause'}</option>
                <option value="NEXT_TRACK">⏭ {t.nextTrack || 'Next Track'}</option>
                <option value="PREV_TRACK">⏮ {t.prevTrack || 'Previous Track'}</option>
                <option value="VOLUME_UP">🔊 {t.volUp || 'Volume Up'}</option>
                <option value="VOLUME_DOWN">🔉 {t.volDown || 'Volume Down'}</option>
              </select>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-[#2d2d2d] bg-[#1e1e1e]">
          <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors">{t.saveChanges}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
