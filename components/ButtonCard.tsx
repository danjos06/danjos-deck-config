'use client';

import React, { useRef } from 'react';
import { ButtonState } from '../lib/types';
import BitmapCanvas from './BitmapCanvas';
import { imageToBitmap } from '../lib/imageConverter';
import { Camera, Folder, ArrowLeft } from 'lucide-react';

interface ButtonCardProps {
  button: ButtonState;
  index: number;
  onUpdate: (index: number, newConfig: ButtonState) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  t: any;
}

export default function ButtonCard({ button, index, onUpdate, isSelected, onSelect, t }: ButtonCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const bitmap = await imageToBitmap(file);
      onUpdate(index, { ...button, bitmap });
    } catch (err) {
      console.error(err);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className={`w-24 h-24 rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer relative group ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1e1e1e]' : 'border border-[#3d3d3d] hover:border-gray-500'
      }`}
      onClick={onSelect}
    >
      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-[#1a1a1a] relative">
        {button.action?.type === 'folder' && (
          <div className="absolute top-1 right-1 z-10 bg-blue-600/80 text-white p-1 rounded-full shadow" title={t.folderBadge}>
            <Folder size={12} />
          </div>
        )}
        {button.action?.type === 'back' && (
          <div className="absolute top-1 right-1 z-10 bg-amber-600/80 text-white p-1 rounded-full shadow" title={t.back}>
            <ArrowLeft size={12} />
          </div>
        )}

        {button.bitmap && button.bitmap.some(b => b !== 0) ? (
          <BitmapCanvas bitmap={button.bitmap} width={128} height={64} className="w-full h-full object-contain p-2" />
        ) : (
          <div className="text-center p-2">
            <span className="text-xs text-gray-400 font-medium break-words line-clamp-2">{button.label || t.empty}</span>
          </div>
        )}
        
        {/* Overlay upload button */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white p-2 rounded-full shadow-lg border border-[#3d3d3d] transition-colors"
            title={t.uploadImage}
          >
            <Camera size={16} />
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </div>
    </div>
  );
}
