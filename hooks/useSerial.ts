'use client';

import { useState, useRef, useCallback } from 'react';

export function useSerial() {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);
  const onLineReceivedRef = useRef<((line: string) => void) | null>(null);
  
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const keepReadingRef = useRef(true);

  const addLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text }]);
  }, []);

  const connect = async (baudRate: number = 115200) => {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser.');
      }

      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate });
      setPort(selectedPort);
      setIsConnected(true);
      addLog('Connected to ESP32');

      keepReadingRef.current = true;
      readLoop(selectedPort);
    } catch (error: any) {
      addLog(`Connection error: ${error.message}`);
      throw error;
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (port) {
        await port.close();
        setPort(null);
        setIsConnected(false);
        addLog('Disconnected');
      }
    } catch (error: any) {
      addLog(`Disconnect error: ${error.message}`);
    }
  };

  const readLoop = async (activePort: SerialPort) => {
    while (activePort.readable && keepReadingRef.current) {
      const reader = activePort.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                addLog(`RX: ${trimmed}`);
                if (onLineReceivedRef.current) {
                  onLineReceivedRef.current(trimmed);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Read error:', error);
      } finally {
        reader.releaseLock();
        readerRef.current = null;
      }
    }
  };

  const writeText = async (text: string) => {
    if (!port || !port.writable) return;
    try {
      if (!writerRef.current) {
        writerRef.current = port.writable.getWriter();
      }
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode(text + '\n'));
      addLog(`TX: ${text}`);
    } catch (error: any) {
      addLog(`Write error: ${error.message}`);
    } finally {
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
    }
  };

  const writeBinary = async (data: Uint8Array) => {
    if (!port || !port.writable) return;
    try {
      if (!writerRef.current) {
        writerRef.current = port.writable.getWriter();
      }
      await writerRef.current.write(data);
      addLog(`TX: [${data.length} bytes of binary data]`);
    } catch (error: any) {
      addLog(`Write error: ${error.message}`);
    } finally {
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
    }
  };

  const clearLogs = () => setLogs([]);

  const setOnLineReceived = useCallback((callback: ((line: string) => void) | null) => {
    onLineReceivedRef.current = callback;
  }, []);

  return {
    port,
    isConnected,
    logs,
    connect,
    disconnect,
    writeText,
    writeBinary,
    clearLogs,
    setOnLineReceived,
  };
}
