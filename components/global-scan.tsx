'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Package, PackagePlus, ScanLine, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { rpc } from '@/lib/data/mutations';
import { errorMessage } from '@/lib/errors';
import { ScannerModal } from '@/components/scanner/scanner-modal';
import { Modal } from '@/components/ui/modal';
import { Mono } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import type { LookupResult } from '@/lib/types';

/** Where a scanned record should open. */
export function routeForLookup(hit: LookupResult): string {
  if (hit.kind === 'consumable') return `/magazyn?tab=materialy&open=${hit.id}`;
  if (hit.event_id) return `/zawody/${hit.event_id}?item=${hit.id}`;
  return `/magazyn?open=${hit.id}`;
}

/**
 * Scan anything from anywhere: known label/SKU -> open it,
 * unknown label (fresh sticker from the roll) -> create or attach.
 */
export function GlobalScanButton({ variant }: { variant: 'header' | 'fab' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unknown, setUnknown] = useState<string | null>(null);

  const onScan = async (code: string) => {
    try {
      const hits = await rpc('lookup_code', { p_code: code });
      if (hits.length === 0) {
        setUnknown(code);
        return;
      }
      if (hits.length > 1) toast.warning(`Kod ${code} pasuje do ${hits.length} rekordów, otwieram pierwszy.`);
      router.push(routeForLookup(hits[0]));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const go = (href: string) => {
    setUnknown(null);
    router.push(href);
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          <ScanLine className="h-4 w-4" /> Skanuj
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Skanuj etykietę"
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/60 ring-4 ring-zinc-950 active:scale-95"
        >
          <ScanLine className="h-6 w-6" />
        </button>
      )}

      <ScannerModal
        open={open}
        onClose={() => setOpen(false)}
        onScan={onScan}
        title="Skanuj etykietę"
        hint="Kod kreskowy z naklejki, QR albo SKU"
      />

      <Modal
        open={unknown !== null}
        onClose={() => setUnknown(null)}
        title="Nowa etykieta"
        description={
          <>
            Kod <Mono className="text-zinc-200">{unknown}</Mono> nie jest jeszcze przypisany. Co z nim zrobić?
          </>
        }
        size="sm"
      >
        <div className="grid gap-2">
          <ActionTile icon={Wrench} title="Nowy sprzęt" text="Utwórz przedmiot z tą etykietą" onClick={() => go(`/magazyn?new=item&label=${encodeURIComponent(unknown ?? '')}`)} />
          <ActionTile icon={PackagePlus} title="Nowy materiał" text="Utwórz materiał zużywalny z tą etykietą" onClick={() => go(`/magazyn?tab=materialy&new=consumable&label=${encodeURIComponent(unknown ?? '')}`)} />
          <ActionTile icon={Link2} title="Przypisz do istniejącego" text="Wybierz przedmiot lub materiał z listy" onClick={() => go(`/magazyn?label=${encodeURIComponent(unknown ?? '')}`)} />
        </div>
      </Modal>
    </>
  );
}

function ActionTile({ icon: Icon, title, text, onClick }: { icon: typeof Package; title: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800')}
    >
      <span className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-xs text-zinc-500">{text}</span>
      </span>
    </button>
  );
}
