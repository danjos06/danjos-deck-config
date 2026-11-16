import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-950';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-black font-semibold hover:bg-accent-soft active:bg-accent-deep shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]',
  secondary: 'bg-ink-700 text-fg hover:bg-ink-600 border border-white/[0.07]',
  ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.06]',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
        focusRing,
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin" size={size === 'sm' ? 14 : 16} />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />
      )}
      {children}
    </button>
  );
});
