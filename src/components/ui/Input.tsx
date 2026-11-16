import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';

const base =
  'w-full min-w-0 rounded-lg border border-white/[0.08] bg-ink-950 px-3 text-sm text-fg placeholder:text-fg-dim transition-colors hover:border-white/15 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-40';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, mono, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(base, 'h-9', mono && 'font-mono text-[13px]', invalid && 'border-danger/60 focus:border-danger focus:ring-danger/25', className)}
      {...rest}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, mono, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, 'py-2 leading-relaxed', mono && 'font-mono text-[12.5px]', className)} {...rest} />;
});

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Label + control + hint/error wrapper. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : hint ? <p className="mt-1 text-[11px] text-fg-dim">{hint}</p> : null}
    </div>
  );
}
