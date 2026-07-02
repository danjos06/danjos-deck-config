'use client';

import React from 'react';
import { PageConfig, ButtonState, FolderConfig } from '../lib/types';
import ButtonCard from './ButtonCard';

interface ButtonGridProps {
  page: PageConfig;
  onUpdatePage: (newPage: PageConfig) => void;
  selectedButtonIdx?: number;
  onSelectButton?: (index: number) => void;
  t: any;
  backButtonIdx?: number;
  onBackClick?: () => void;
  folders?: FolderConfig[];
  onEnterFolder?: (folderId: string) => void;
}

export default function ButtonGrid({ 
  page, 
  onUpdatePage, 
  selectedButtonIdx, 
  onSelectButton, 
  t, 
  backButtonIdx, 
  onBackClick,
  folders,
  onEnterFolder
}: ButtonGridProps) {
  const handleUpdateBtn = (index: number, newBtnState: ButtonState) => {
    const newButtons = [...page.buttons];
    newButtons[index] = newBtnState;
    onUpdatePage({ ...page, buttons: newButtons });
  };

  return (
    <div className="flex items-center justify-center">
      <div className="grid grid-cols-3 gap-4">
        {page.buttons.map((btn, idx) => {
          const isBackButton = idx === backButtonIdx;
          const currentBtn = isBackButton ? {
            ...btn,
            label: btn.label || 'BACK',
            iconName: 'arrow_back'
          } : btn;

          return (
            <ButtonCard
              key={`${page.id}-btn-${idx}`}
              button={currentBtn}
              index={idx}
              onUpdate={handleUpdateBtn}
              isSelected={isBackButton ? false : (selectedButtonIdx === idx)}
              onSelect={isBackButton ? onBackClick : () => onSelectButton?.(idx)}
              t={t}
              isBackButton={isBackButton}
              folders={folders}
              onEnterFolder={onEnterFolder}
            />
          );
        })}
      </div>
    </div>
  );
}
