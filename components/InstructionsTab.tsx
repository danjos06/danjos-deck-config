'use client';

import React, { useState } from 'react';
import { Book, Code, Mouse, Keyboard, Clock, X, Info } from 'lucide-react';

export default function InstructionsTab({ t, lang }: { t: any, lang: string }) {
  const [selectedItem, setSelectedItem] = useState<{ title: string, desc: string } | null>(null);

  const keyDescriptions: Record<string, string> = {
    'KEY_RETURN': lang === 'pt' ? 'Tecla Enter / Return.' : 'Enter / Return key.',
    'KEY_ESC': lang === 'pt' ? 'Tecla Escape.' : 'Escape key.',
    'KEY_BACKSPACE': lang === 'pt' ? 'Tecla de apagar (Backspace).' : 'Backspace key.',
    'KEY_TAB': lang === 'pt' ? 'Tecla Tab.' : 'Tab key.',
    'KEY_DELETE': lang === 'pt' ? 'Tecla Delete.' : 'Delete key.',
    'KEY_INSERT': lang === 'pt' ? 'Tecla Insert.' : 'Insert key.',
    'KEY_HOME': lang === 'pt' ? 'Tecla Home.' : 'Home key.',
    'KEY_END': lang === 'pt' ? 'Tecla End.' : 'End key.',
    'KEY_PAGE_UP': lang === 'pt' ? 'Tecla Page Up.' : 'Page Up key.',
    'KEY_PAGE_DOWN': lang === 'pt' ? 'Tecla Page Down.' : 'Page Down key.',
    'KEY_UP_ARROW': lang === 'pt' ? 'Seta para Cima.' : 'Up Arrow key.',
    'KEY_DOWN_ARROW': lang === 'pt' ? 'Seta para Baixo.' : 'Down Arrow key.',
    'KEY_LEFT_ARROW': lang === 'pt' ? 'Seta para Esquerda.' : 'Left Arrow key.',
    'KEY_RIGHT_ARROW': lang === 'pt' ? 'Seta para Direita.' : 'Right Arrow key.',
    'KEY_LEFT_CTRL': lang === 'pt' ? 'Tecla Control esquerda.' : 'Left Control key.',
    'KEY_LEFT_SHIFT': lang === 'pt' ? 'Tecla Shift esquerda.' : 'Left Shift key.',
    'KEY_LEFT_ALT': lang === 'pt' ? 'Tecla Alt esquerda.' : 'Left Alt key.',
    'KEY_LEFT_GUI': lang === 'pt' ? 'Tecla Windows / Command esquerda.' : 'Left Windows / Command key.',
    'KEY_RIGHT_CTRL': lang === 'pt' ? 'Tecla Control direita.' : 'Right Control key.',
    'KEY_RIGHT_SHIFT': lang === 'pt' ? 'Tecla Shift direita.' : 'Right Shift key.',
    'KEY_RIGHT_ALT': lang === 'pt' ? 'Tecla Alt direita.' : 'Right Alt key.',
    'KEY_RIGHT_GUI': lang === 'pt' ? 'Tecla Windows / Command direita.' : 'Right Windows / Command key.',
    'VOLUME_INCREMENT': lang === 'pt' ? 'Aumentar o volume do sistema.' : 'Increase system volume.',
    'VOLUME_DECREMENT': lang === 'pt' ? 'Diminuir o volume do sistema.' : 'Decrease system volume.',
    'MUTE': lang === 'pt' ? 'Silenciar o áudio do sistema.' : 'Mute system audio.',
    'PLAY_PAUSE': lang === 'pt' ? 'Reproduzir ou pausar mídia.' : 'Play or pause media.',
    'SCAN_NEXT_TRACK': lang === 'pt' ? 'Próxima faixa de mídia.' : 'Next media track.',
    'SCAN_PREV_TRACK': lang === 'pt' ? 'Faixa de mídia anterior.' : 'Previous media track.',
    'STOP': lang === 'pt' ? 'Parar reprodução de mídia.' : 'Stop media playback.',
    'BRIGHTNESS_INCREMENT': lang === 'pt' ? 'Aumentar o brilho da tela.' : 'Increase screen brightness.',
    'BRIGHTNESS_DECREMENT': lang === 'pt' ? 'Diminuir o brilho da tela.' : 'Decrease screen brightness.',
    'MOUSE_LEFT': lang === 'pt' ? 'Botão Esquerdo do Mouse.' : 'Left Mouse Button.',
    'MOUSE_RIGHT': lang === 'pt' ? 'Botão Direito do Mouse.' : 'Right Mouse Button.',
    'MOUSE_MIDDLE': lang === 'pt' ? 'Botão do Meio (Scroll) do Mouse.' : 'Middle Mouse Button (Scroll).',
    'MOUSE_BACK': lang === 'pt' ? 'Botão de Voltar do Mouse.' : 'Mouse Back Button.',
    'MOUSE_FORWARD': lang === 'pt' ? 'Botão de Avançar do Mouse.' : 'Mouse Forward Button.',
    'HID_KEY_APPLICATION': lang === 'pt' ? 'Tecla de Menu de Contexto (Application).' : 'Context Menu key (Application).'
  };

  const getDesc = (key: string) => {
    if (keyDescriptions[key]) return keyDescriptions[key];
    if (key.length === 1) return lang === 'pt' ? `Tecla caractere '${key}'.` : `Character key '${key}'.`;
    if (key.startsWith('KEY_F')) return lang === 'pt' ? `Tecla de função ${key.replace('KEY_', '')}.` : `Function key ${key.replace('KEY_', '')}.`;
    return lang === 'pt' ? 'Identificador de tecla HID padrão.' : 'Standard HID key identifier.';
  };

  const allKeys = [
    { 
      group: lang === 'pt' ? 'Teclado (Alfanumérico)' : 'Keyboard (Alphanumeric)', 
      keys: [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'KEY_BACKSPACE', 'KEY_TAB', 'KEY_RETURN', 'KEY_ESC', 'KEY_INSERT', 'KEY_DELETE', 'KEY_PAGE_UP', 'KEY_PAGE_DOWN', 'KEY_HOME', 'KEY_END',
        'KEY_UP_ARROW', 'KEY_DOWN_ARROW', 'KEY_LEFT_ARROW', 'KEY_RIGHT_ARROW'
      ] 
    },
    { 
      group: t.modifiersKeys, 
      keys: ['KEY_LEFT_CTRL', 'KEY_LEFT_SHIFT', 'KEY_LEFT_ALT', 'KEY_LEFT_GUI', 'KEY_RIGHT_CTRL', 'KEY_RIGHT_SHIFT', 'KEY_RIGHT_ALT', 'KEY_RIGHT_GUI'] 
    },
    { 
      group: t.functionKeys, 
      keys: Array.from({ length: 24 }, (_, i) => `KEY_F${i + 1}`)
    },
    { 
      group: lang === 'pt' ? 'Multimídia / Consumer' : 'Multimedia / Consumer', 
      keys: ['VOLUME_INCREMENT', 'VOLUME_DECREMENT', 'MUTE', 'PLAY_PAUSE', 'SCAN_NEXT_TRACK', 'SCAN_PREV_TRACK', 'STOP', 'BRIGHTNESS_INCREMENT', 'BRIGHTNESS_DECREMENT'] 
    },
    { 
      group: 'Mouse / HID', 
      keys: ['MOUSE_LEFT', 'MOUSE_RIGHT', 'MOUSE_MIDDLE', 'MOUSE_BACK', 'MOUSE_FORWARD', 'HID_KEY_APPLICATION'] 
    }
  ];

  const categories = [
    {
      title: t.keyboard,
      icon: <Keyboard size={20} className="text-blue-400" />,
      items: [
        { name: 'Keyboard.print("text")', desc: lang === 'pt' ? 'Digita uma string de caracteres.' : 'Prints a string of characters.' },
        { name: 'Keyboard.press(KEY)', desc: lang === 'pt' ? 'Mantém uma tecla pressionada.' : 'Holds down a specific key.' },
        { name: 'Keyboard.release(KEY)', desc: lang === 'pt' ? 'Solta uma tecla específica.' : 'Releases a specific key.' },
        { name: 'Keyboard.releaseAll()', desc: lang === 'pt' ? 'Solta todas as teclas simultaneamente.' : 'Releases all currently held keys.' },
        { name: 'Keyboard.write(KEY)', desc: lang === 'pt' ? 'Digita um caractere (press + release).' : 'Writes a character (press + release).' },
      ]
    },
    {
      title: t.mouse,
      icon: <Mouse size={20} className="text-green-400" />,
      items: [
        { name: 'Mouse.move(x, y, wheel)', desc: lang === 'pt' ? 'Move o cursor (x, y) ou scroll wheel.' : 'Moves cursor (x, y) or scroll wheel.' },
        { name: 'Mouse.click(BUTTON)', desc: lang === 'pt' ? 'Executa um clique no botão.' : 'Performs a button click.' },
        { name: 'Mouse.press(BUTTON)', desc: lang === 'pt' ? 'Segura um botão do mouse.' : 'Holds down a mouse button.' },
        { name: 'Mouse.release(BUTTON)', desc: lang === 'pt' ? 'Solta um botão do mouse.' : 'Releases a mouse button.' },
      ]
    },
    {
      title: t.advanced,
      icon: <Code size={20} className="text-purple-400" />,
      items: [
        { name: 'delay(ms)', desc: lang === 'pt' ? 'Pausa a execução por X milissegundos.' : 'Pauses execution for X milliseconds.' },
        { name: 'Consumer.write(ACTION)', desc: lang === 'pt' ? 'Comandos multimídia (Volume, Brilho, etc).' : 'Multimedia commands (Volume, Brightness, etc).' },
        { name: 'digitalWrite(pin, val)', desc: lang === 'pt' ? 'Controla GPIOs diretamente (HIGH/LOW).' : 'Direct control of GPIOs (HIGH/LOW).' },
        { name: 'pinMode(pin, mode)', desc: lang === 'pt' ? 'Configura o modo do pino (INPUT/OUTPUT).' : 'Configures pin mode (INPUT/OUTPUT).' },
      ]
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#111] overflow-hidden relative">
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          <div className="flex items-center space-x-3 text-blue-400">
            <Book size={28} />
            <h2 className="text-2xl font-bold tracking-tight">{t.commandDocs}</h2>
          </div>
          
          <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
            {lang === 'pt' 
              ? 'Esta documentação cobre todas as funções e teclas que você pode usar para criar automações. Clique em qualquer comando ou identificador para ver detalhes.' 
              : 'This documentation covers all functions and keys you can use to create automations. Click on any command or identifier to see details.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, i) => (
              <div key={i} className="bg-[#1a1a1a] rounded-xl border border-[#3d3d3d] overflow-hidden shadow-xl">
                <div className="bg-[#252525] px-4 py-3 border-b border-[#3d3d3d] flex items-center space-x-3">
                  {cat.icon}
                  <h4 className="font-bold text-xs uppercase tracking-widest text-gray-300">{cat.title}</h4>
                </div>
                <div className="p-4 space-y-4">
                  {cat.items.map((item, j) => (
                    <div 
                      key={j} 
                      className="space-y-1 group cursor-pointer"
                      onClick={() => setSelectedItem({ title: item.name, desc: item.desc })}
                    >
                      <code className="text-[11px] text-blue-400 font-mono bg-blue-500/5 px-2 py-1 rounded border border-blue-500/20 block truncate transition-all duration-200 group-hover:scale-[1.02] group-hover:bg-blue-500/10 group-active:scale-95">
                        {item.name}
                      </code>
                      <p className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-bold text-gray-200 uppercase tracking-tight">{t.instructionsTitle}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {allKeys.map((group, i) => (
                <div key={i} className="bg-[#161616] p-5 rounded-xl border border-[#2d2d2d] space-y-4">
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#2d2d2d] pb-2">{group.group}</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {group.keys.map((key, j) => (
                      <span 
                        key={j} 
                        className="text-[9px] font-mono text-blue-300 bg-blue-900/20 border border-blue-500/10 px-2 py-1 rounded hover:bg-blue-900/40 transition-all duration-200 hover:scale-110 active:scale-90 cursor-help"
                        onClick={() => setSelectedItem({ title: key, desc: getDesc(key) })}
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6 shadow-inner">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg"><Clock size={18} className="text-blue-400" /></div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">{t.complexExample}</h4>
            </div>
            <pre className="text-[11px] font-mono text-blue-300/80 leading-relaxed bg-[#0a0a0a] p-5 rounded-lg border border-[#2d2d2d] shadow-2xl">
              {`// ${t.exampleDesc}
Keyboard.press(KEY_LEFT_GUI);
Keyboard.press('r');
Keyboard.releaseAll();
delay(200);
Keyboard.print("control");
Keyboard.press(KEY_RETURN);
Keyboard.releaseAll();`}
            </pre>
          </div>
        </div>
      </div>

      {/* Info Modal/Box */}
      {selectedItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-[#3d3d3d] rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Info size={20} className="text-blue-400" />
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-white transition-colors"
                id="close-info-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.identifier}</h4>
                <code className="text-sm text-blue-400 font-mono block bg-blue-500/5 p-2 rounded border border-blue-500/10">{selectedItem.title}</code>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.whatItDoes}</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{selectedItem.desc}</p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full bg-[#333] hover:bg-[#444] text-white text-xs font-bold py-2.5 rounded-lg transition-colors border border-[#4d4d4d]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
