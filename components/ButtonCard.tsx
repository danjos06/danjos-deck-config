'use client';

import React, { useRef } from 'react';
import { ButtonState, PageConfig } from '../lib/types';
import BitmapCanvas from './BitmapCanvas';
import { imageToBitmap } from '../lib/imageConverter';
import { Camera, ArrowUpRight } from 'lucide-react';

interface ButtonCardProps {
  button: ButtonState;
  index: number;
  onUpdate: (index: number, newConfig: ButtonState) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  t: any;
  pages?: PageConfig[];
  onJumpToPage?: (pageId: string) => void;
}

export default function ButtonCard({ 
  button, 
  index, 
  onUpdate, 
  isSelected, 
  onSelect, 
  t, 
  pages, 
  onJumpToPage 
}: ButtonCardProps) {
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
        isSelected 
          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1e1e1e]' 
          : 'border border-[#3d3d3d] hover:border-gray-500'
      }`}
      onClick={onSelect}
    >
      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-[#1a1a1a] relative">
        {button.bitmap && button.bitmap.some(b => b !== 0) ? (
          <BitmapCanvas bitmap={button.bitmap} width={128} height={64} className="w-full h-full object-contain p-2" />
        ) : button.action?.type === 'go_to_page' ? (
          <div className="flex flex-col items-center justify-center p-2 text-indigo-400">
            <span className="material-symbols-rounded text-2xl mb-1">shortcut</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center break-words line-clamp-2 max-w-[80px]">
              {button.label || (() => {
                const targetPage = pages?.find(p => p.id === button.action?.targetPageId);
                return targetPage ? targetPage.name : (t.go_to_page || 'Go to Page');
              })()}
            </span>
          </div>
        ) : (
          <div className="text-center p-2">
            <span className="text-xs text-gray-400 font-medium break-words line-clamp-2">{button.label || t.empty}</span>
          </div>
        )}
        
        {/* Overlay buttons */}
        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
          {button.action?.type === 'go_to_page' && button.action.targetPageId && onJumpToPage && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onJumpToPage(button.action!.targetPageId!);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-full shadow-lg border border-indigo-500 transition-colors"
              title={t.go_to_page || 'Go to Page'}
            >
              <ArrowUpRight size={16} />
            </button>
          )}
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
