import { memo } from 'react';
import { cn } from '@/lib/ui/cn';

interface IconProps {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}

/** Material Symbols Rounded glyph (self-hosted font). */
export const Icon = memo(function Icon({ name, size = 18, fill = false, className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('material-symbols-rounded inline-block shrink-0 overflow-hidden leading-none', className)}
      style={{ fontSize: size, width: size, height: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
});
