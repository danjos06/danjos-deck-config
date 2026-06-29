'use client';

import React, { useEffect, useRef } from 'react';

interface BitmapCanvasProps {
  bitmap: number[];
  width?: number;    // display width in px, default 128
  height?: number;   // display height in px, default 64
  className?: string;
}

export default function BitmapCanvas({ bitmap, width = 128, height = 64, className = '' }: BitmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create ImageData of 128x64
    const imageData = ctx.createImageData(128, 64);
    const data = imageData.data;

    if (bitmap && bitmap.length === 1024) {
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 128; x++) {
          const byteIdx = y * 16 + (x >> 3);
          const bitIdx = 7 - (x & 7);
          const bit = (bitmap[byteIdx] >> bitIdx) & 1;
          
          const idx = (y * 128 + x) * 4;
          if (bit === 1) {
            // White
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = 255;
          } else {
            // Black
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
      }
    } else {
      // Fill black if no bitmap
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }

    // Draw to an offscreen canvas first since we need to scale it
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 128;
    offscreenCanvas.height = 64;
    const offCtx = offscreenCanvas.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imageData, 0, 0);
      
      // Clear main canvas
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      
      // Draw scaled
      ctx.imageSmoothingEnabled = false; // Keep it pixelated
      ctx.drawImage(offscreenCanvas, 0, 0, width, height);
    }
  }, [bitmap, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`bg-black ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
