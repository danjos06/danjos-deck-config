import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';
import { focusRing } from './Button';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: string;
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  tone?: 'default' | 'danger';
  fill?: boolean;
  noTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', active, tone = 'default', fill, noTooltip, className, type = 'button', ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        tone === 'danger' ? 'text-fg-muted hover:bg-danger/15 hover:text-danger' : 'text-fg-muted hover:bg-white/[0.07] hover:text-fg',
        active && 'bg-white/[0.08] text-accent',
        focusRing,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 19} fill={fill} />
    </button>
  );
  return noTooltip ? btn : <Tooltip label={label}>{btn}</Tooltip>;
});
