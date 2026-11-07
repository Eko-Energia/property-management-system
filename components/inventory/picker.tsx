'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { matchesQuery } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';

type PickerProps<T extends { id: number }> = {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: T[];
  searchText: (row: T) => (string | null | undefined)[];
  render: (row: T) => ReactNode;
  onConfirm: (ids: number[]) => void | Promise<void>;
  multiple?: boolean;
  confirmLabel?: (count: number) => string;
  footerExtra?: ReactNode;
  empty?: string;
};

/** Searchable list for choosing records (multi-select for packing many items at once). */
export function Picker<T extends { id: number }>({ open, onClose, title, rows, searchText, render, onConfirm, multiple = false, confirmLabel, footerExtra, empty = 'Brak pozycji' }: PickerProps<T>) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => rows.filter((r) => matchesQuery(query, ...searchText(r))).slice(0, 200), [rows, query, searchText]);

  const close = () => {
    setQuery('');
    setSelected(new Set());
    onClose();
  };

  const confirm = async (ids: number[]) => {
    setBusy(true);
    try {
      await onConfirm(ids);
      close();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: number) => {
    if (!multiple) {
      void confirm([id]);
      return;
    }
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        multiple || footerExtra ? (
          <>
            {footerExtra}
            {multiple && (
              <Button variant="primary" disabled={selected.size === 0} loading={busy} onClick={() => confirm([...selected])}>
                {confirmLabel ? confirmLabel(selected.size) : `Wybierz (${selected.size})`}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj…" className="pl-9" />
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {filtered.map((row) => {
            const isSel = selected.has(row.id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(row.id)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-800/60', isSel && 'bg-blue-950/40')}
                >
                  {multiple && (
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', isSel ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-600')}>
                      {isSel && <Check className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">{render(row)}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
