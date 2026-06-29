'use client';

import React from 'react';
import { DanjosDeckConfig, PinConfig } from '../lib/types';
import { Settings } from 'lucide-react';

interface PinsSettingsProps {
  config: DanjosDeckConfig;
  onUpdateConfig: (config: DanjosDeckConfig) => void;
  t: any;
  lang: string;
}

export default function PinsSettings({ config, onUpdateConfig, t, lang }: PinsSettingsProps) {
  const pins = config.pins || {
    btn1: 1, btn2: 2, btn3: 3, btn4: 4, btn5: 5, btn6: 6,
    btnPrev: 7, btnNext: 15,
    enc1Clk: 16, enc1Dt: 17, enc1Btn: 18,
    enc2Clk: 21, enc2Dt: 22, enc2Btn: 23,
    sda: 8, scl: 9
  };

  const handleUpdatePin = (key: keyof PinConfig, value: string) => {
    const pinVal = parseInt(value) || 0;
    const newConfig = { ...config };
    newConfig.pins = { ...pins, [key]: pinVal };
    onUpdateConfig(newConfig);
  };

  const handleToggleEnable = (key: keyof PinConfig, enabled: boolean) => {
    const newConfig = { ...config };
    newConfig.pins = { ...pins, [key]: enabled };
    onUpdateConfig(newConfig);
  };

  type FieldDef = { key: string; label: string; enableKey?: keyof PinConfig };
  type CategoryDef = { title: string; enableKey?: keyof PinConfig; fields: FieldDef[] };

  const categories: CategoryDef[] = [
    {
      title: t.mainButtons,
      fields: [
        { key: 'btn1', label: `${t.pinButton} 1`, enableKey: 'btn1Enabled' as keyof PinConfig }, 
        { key: 'btn2', label: `${t.pinButton} 2`, enableKey: 'btn2Enabled' as keyof PinConfig },
        { key: 'btn3', label: `${t.pinButton} 3`, enableKey: 'btn3Enabled' as keyof PinConfig }, 
        { key: 'btn4', label: `${t.pinButton} 4`, enableKey: 'btn4Enabled' as keyof PinConfig },
        { key: 'btn5', label: `${t.pinButton} 5`, enableKey: 'btn5Enabled' as keyof PinConfig }, 
        { key: 'btn6', label: `${t.pinButton} 6`, enableKey: 'btn6Enabled' as keyof PinConfig },
      ]
    },
    {
      title: t.navigation,
      fields: [
        { key: 'btnPrev', label: t.prevPage, enableKey: 'btnPrevEnabled' as keyof PinConfig }, 
        { key: 'btnNext', label: t.nextPage, enableKey: 'btnNextEnabled' as keyof PinConfig },
      ]
    },
    {
      title: t.encoderL,
      enableKey: 'enc1Enabled' as keyof PinConfig,
      fields: [
        { key: 'enc1Clk', label: t.clk }, { key: 'enc1Dt', label: t.dt }, { key: 'enc1Btn', label: t.pinButton },
      ]
    },
    {
      title: t.encoderR,
      enableKey: 'enc2Enabled' as keyof PinConfig,
      fields: [
        { key: 'enc2Clk', label: t.clk }, { key: 'enc2Dt', label: t.dt }, { key: 'enc2Btn', label: t.pinButton },
      ]
    },
    {
      title: 'I2C (Displays)',
      fields: [
        { key: 'sda', label: 'SDA' }, { key: 'scl', label: 'SCL' },
      ]
    }
  ];

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto custom-scrollbar bg-[#111]">
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex items-center space-x-3 text-yellow-500 mb-2">
          <Settings size={28} />
          <h2 className="text-2xl font-bold tracking-tight">{t.pinsSettings}</h2>
        </div>
        
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{t.pinsDesc}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat, i) => {
            const isCatEnabled = cat.enableKey ? pins[cat.enableKey as keyof PinConfig] !== false : true;
            return (
            <div key={i} className={`bg-[#1a1a1a] rounded-xl border border-[#3d3d3d] overflow-hidden shadow-xl transition-opacity ${!isCatEnabled ? 'opacity-50' : ''}`}>
              <div className="bg-[#252525] px-4 py-3 border-b border-[#3d3d3d] flex items-center justify-between">
                <h3 className="font-bold text-xs tracking-wide uppercase text-gray-400">{cat.title}</h3>
                {cat.enableKey && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isCatEnabled} 
                      onChange={(e) => handleToggleEnable(cat.enableKey as keyof PinConfig, e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">{lang === 'pt' ? 'Ativado' : 'Enabled'}</span>
                  </label>
                )}
              </div>
              <div className={`p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 ${!isCatEnabled ? 'pointer-events-none' : ''}`}>
                {cat.fields.map((field) => {
                  const isFieldEnabled = field.enableKey ? pins[field.enableKey as keyof PinConfig] !== false : true;
                  return (
                  <div key={field.key} className={`flex flex-col space-y-1.5 ${!isFieldEnabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{field.label}</label>
                      {field.enableKey && (
                        <input 
                          type="checkbox" 
                          checked={isFieldEnabled} 
                          onChange={(e) => handleToggleEnable(field.enableKey as keyof PinConfig, e.target.checked)}
                          className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 w-3 h-3"
                        />
                      )}
                    </div>
                    <input
                      type="number"
                      disabled={!isFieldEnabled}
                      value={(pins[field.key as keyof PinConfig] as number) || ''}
                      onChange={(e) => handleUpdatePin(field.key as keyof PinConfig, e.target.value)}
                      className="bg-[#111] border border-[#3d3d3d] text-sm text-white px-3 py-2 rounded focus:outline-none focus:border-yellow-500 transition-colors shadow-inner disabled:cursor-not-allowed"
                    />
                  </div>
                )})}
              </div>
            </div>
          )})}
        </div>
        
        <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl p-5 shadow-inner">
          <p className="text-xs text-yellow-500/80 font-medium leading-relaxed">
            {lang === 'pt' ? '⚠️ Nota: Mudanças nos pinos requerem regravar o firmware novamente via cabo para que as alterações físicas sejam reconhecidas pelo hardware.' : '⚠️ Note: Pin changes require downloading and flashing the firmware again via cable for hardwired changes to be recognized.'}
          </p>
        </div>
      </div>
    </div>
  );
}
