import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'light';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-sm shadow-blue-950/50',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700',
  ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
  danger: 'bg-red-600/90 text-white hover:bg-red-500 active:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
  light: 'bg-white text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
