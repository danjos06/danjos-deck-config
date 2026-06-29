'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, Plug, Unplug } from 'lucide-react';

interface SerialMonitorProps {
  isConnected: boolean;
  logs: { time: string; text: string }[];
  onConnect: (baudRate: number) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  onToast: (msg: string) => void;
  t: any;
}

export default function SerialMonitor({ 
  isConnected, 
  logs, 
  onConnect, 
  onDisconnect, 
  onSend, 
  onClear, 
  onToast,
  t
}: SerialMonitorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [baudRate, setBaudRate] = useState(115200);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current && isOpen) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const handleConnect = async () => {
    try {
      await onConnect(baudRate);
    } catch (e: any) {
      onToast(e.message || t.serialConnectFailed);
    }
  };

  const handleDisconnect = async () => {
    try {
      await onDisconnect();
    } catch (e: any) {
      onToast(t.serialDisconnectError);
    }
  };

  const handleSend = async () => {
    if (!isConnected || !input) return;
    try {
      await onSend(input);
      setInput('');
    } catch (e) {
      onToast(t.serialSendFailed);
    }
  };

  return (
    <div className="border-t border-[#2d2d2d] bg-[#1e1e1e] flex flex-col transition-all duration-300" style={{ height: isOpen ? '300px' : '48px' }}>
      {/* Header */}
      <div 
        className="h-12 px-4 flex items-center justify-between cursor-pointer hover:bg-[#252525] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <Terminal size={16} className="text-gray-400" />
          <span className="font-medium text-sm text-gray-200">{t.serialMonitor}</span>
          {isConnected && (
            <span className="flex items-center space-x-1 ml-2 px-2 py-0.5 rounded-full bg-green-900/30 border border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] uppercase tracking-wider text-green-400">{t.connected}</span>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
          <select 
            value={baudRate} 
            onChange={e => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
            className="bg-[#252525] border border-[#3d3d3d] text-xs text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value={9600}>9600</option>
            <option value={115200}>115200</option>
            <option value={230400}>230400</option>
          </select>
          
          {isConnected ? (
            <button 
              onClick={handleDisconnect}
              className="flex items-center space-x-1 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
            >
              <Unplug size={12} />
              <span>{t.disconnect}</span>
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="flex items-center space-x-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
            >
              <Plug size={12} />
              <span>{t.connect}</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="flex-1 flex flex-col min-h-0 border-t border-[#2d2d2d]">
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs bg-[#1a1a1a]">
            {logs.length === 0 ? (
              <div className="text-gray-600 italic p-2">{t.noData}</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex space-x-3 py-0.5 hover:bg-[#252525]">
                  <span className="text-gray-600 select-none">[{log.time}]</span>
                  <span className={log.text.startsWith('TX:') ? 'text-blue-400' : 'text-gray-300'}>{log.text}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
          
          <div className="h-12 border-t border-[#2d2d2d] bg-[#1e1e1e] px-2 flex items-center space-x-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={!isConnected}
              placeholder={isConnected ? t.sendCommand : t.connectToSend}
              className="flex-1 bg-[#252525] border border-[#3d3d3d] text-xs text-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button 
              onClick={handleSend}
              disabled={!isConnected || !input}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-[#3d3d3d] disabled:text-gray-500 text-white rounded transition-colors"
            >
              <Send size={14} />
            </button>
            <div className="w-px h-6 bg-[#3d3d3d] mx-1"></div>
            <button 
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded transition-colors"
              title={t.clearLogs}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
