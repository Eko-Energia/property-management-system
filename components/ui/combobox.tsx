'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { matchesQuery } from '@/lib/format';
import { cn } from './cn';

export type ComboOption<V extends string | number> = {
  value: V;
  label: string;
  /** secondary text shown under the label and searched too */
  hint?: string | null;
  group?: string;
};

type Props<V extends string | number> = {
  id?: string;
  value: V | null;
  onChange: (value: V | null) => void;
  options: ComboOption<V>[];
  placeholder?: string;
  /** label of the "nothing selected" choice; omit to make a value required */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  /** extra row at the bottom, e.g. "add new" */
  footer?: (query: string, close: () => void) => ReactNode;
};

/**
 * Searchable select: looks like an input, filters as you type, keyboard friendly
 * (↑ ↓ Enter Esc). Replaces native <select> where lists get long.
 */
export function Combobox<V extends string | number>({ id, value, onChange, options, placeholder = 'Wybierz…', emptyLabel, disabled, className, footer }: Props<V>) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => options.filter((o) => matchesQuery(query, o.label, o.hint, o.group)), [options, query]);
  // flat list used for keyboard navigation: [empty choice?, ...filtered]
  const choices: (ComboOption<V> | null)[] = emptyLabel && !query ? [null, ...filtered] : filtered;

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, choices.findIndex((c) => (c?.value ?? null) === value)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (c: ComboOption<V> | null) => {
    onChange(c?.value ?? null);
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(choices.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (choices[active] !== undefined) pick(choices[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // close the list, not the surrounding modal
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (selected?.label ?? '')}
        placeholder={open ? 'Wpisz, aby wyszukać…' : selected ? '' : (emptyLabel ?? placeholder)}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-16 text-sm text-zinc-100 placeholder:text-zinc-500',
          'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60',
          !open && !selected && 'placeholder:text-zinc-400',
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {selected && emptyLabel && !disabled && !open && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Wyczyść"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className={cn('pointer-events-none h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          ref={(el) => el?.scrollIntoView({ block: 'nearest' })}
          onMouseDown={(e) => e.preventDefault()} // keep focus in the input while clicking
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl animate-in fade-in"
        >
          {choices.length === 0 && <p className="px-3 py-3 text-center text-sm text-zinc-500">Nic nie pasuje do „{query}”</p>}
          {choices.map((c, i) => {
            const header = c?.group && c.group !== choices[i - 1]?.group ? c.group : null;
            const isSel = (c?.value ?? null) === value;
            return (
              <div key={c ? String(c.value) : '__empty'}>
                {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm', i === active ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-300')}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', !c && 'text-zinc-500')}>{c ? c.label : emptyLabel}</span>
                    {c?.hint && <span className="block truncate text-xs text-zinc-500">{c.hint}</span>}
                  </span>
                  {isSel && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                </button>
              </div>
            );
          })}
          {footer?.(query, close)}
        </div>
      )}
    </div>
  );
}
