'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ScanLine, X } from 'lucide-react';
import { rpc } from '@/lib/data/mutations';
import { parseScannedCode } from '@/lib/scan';
import type { LookupResult } from '@/lib/types';
import { ScannerModal } from '@/components/scanner/scanner-modal';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export type LabelConflict = LookupResult | null;

/**
 * The club re-uses pre-printed labels from a roll, each value exists once.
 * This field checks whether a label is already attached somewhere and lets
 * the user move it (handled by the caller via assign_label on save).
 */
export function LabelField({
  id,
  value,
  onChange,
  self,
  onConflictChange,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** the record being edited, so its own label is not a conflict */
  self?: { kind: 'item' | 'consumable'; id: number };
  onConflictChange: (conflict: LabelConflict) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ code: string; hit: LabelConflict }>({ code: '', hit: null });
  const code = value.trim();
  const conflict = result.code === code ? result.hit : null;

  useEffect(() => {
    if (!code) {
      onConflictChange(null);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const hits = await rpc('lookup_code', { p_code: code });
        const other = hits.find((h) => h.barcode === code && !(self && h.kind === self.kind && h.id === self.id)) ?? null;
        if (!stale) {
          setResult({ code, hit: other });
          onConflictChange(other);
        }
      } catch {
        // lookup is advisory; the DB constraint still protects us
      }
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // onConflictChange is a stable setter from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, self?.id, self?.kind]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Zeskanuj albo wpisz numer naklejki"
            autoComplete="off"
            className="pr-8 font-mono"
          />
          {value && (
            <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200" aria-label="Wyczyść">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="button" variant="secondary" size="icon" onClick={() => setScanning(true)} aria-label="Skanuj etykietę">
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>
      {conflict && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-950/40 p-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ta etykieta jest przypisana do: <b>{conflict.name}</b> ({conflict.sku}). Po zapisaniu zostanie <b>przeniesiona</b> na ten rekord.
          </span>
        </div>
      )}
      <ScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={(code) => onChange(parseScannedCode(code) ?? '')}
        title="Skanuj etykietę"
        hint="Naklejka z rolki (Code 128)"
      />
    </div>
  );
}
