'use client';

import React from 'react';
import { PageConfig, ButtonState } from '../lib/types';
import ButtonCard from './ButtonCard';

interface ButtonGridProps {
  page: PageConfig;
  onUpdatePage: (newPage: PageConfig) => void;
  selectedButtonIdx?: number;
  onSelectButton?: (index: number) => void;
  t: any;
}

export default function ButtonGrid({ page, onUpdatePage, selectedButtonIdx, onSelectButton, t }: ButtonGridProps) {
  const handleUpdateBtn = (index: number, newBtnState: ButtonState) => {
    const newButtons = [...page.buttons];
    newButtons[index] = newBtnState;
    onUpdatePage({ ...page, buttons: newButtons });
  };

  return (
    <div className="flex items-center justify-center">
      <div className="grid grid-cols-3 gap-4">
        {page.buttons.map((btn, idx) => (
          <ButtonCard
            key={`${page.id}-btn-${idx}`}
            button={btn}
            index={idx}
            onUpdate={handleUpdateBtn}
            isSelected={selectedButtonIdx === idx}
            onSelect={() => onSelectButton?.(idx)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
