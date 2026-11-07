import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Minus, Plus } from 'lucide-react';
import type { Tone } from '@/lib/format';
import { cn } from './cn';

const TONES: Record<Tone, string> = {
  neutral: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
  info: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  danger: 'bg-red-500/10 text-red-300 ring-red-500/30',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[11px] tracking-tight text-zinc-400', className)}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-zinc-900 p-3 text-zinc-500">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-zinc-200">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-zinc-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-zinc-900', className)} />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  return (
    <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
      <p className="font-medium">Nie udało się wczytać danych.</p>
      {message && <p className="mt-1 text-red-300/80">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium text-red-100 underline underline-offset-2">
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-zinc-800 bg-zinc-900/50', className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Segmented tabs. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('rounded-md px-1.5 text-[11px]', value === o.value ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** − value + control with large touch targets. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  disabled,
  suffix,
}: {
  value: number;
  onChange: (delta: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900">
      <button
        type="button"
        aria-label="Zmniejsz"
        disabled={disabled || value <= min}
        onClick={() => onChange(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-l-xl text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[3.25rem] px-1 text-center text-sm font-semibold tabular-nums text-zinc-100">
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-zinc-500">{suffix}</span>}
      </span>
      <button
        type="button"
        aria-label="Zwiększ"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(1)}
        className="flex h-9 w-9 items-center justify-center rounded-r-xl text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
