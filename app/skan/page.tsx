'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { rpc } from '@/lib/data/mutations';
import { errorMessage } from '@/lib/errors';
import { parseScannedCode } from '@/lib/scan';
import { routeForLookup } from '@/components/global-scan';

/**
 * Target of QR links on stickers: /skan?id=<label or SKU>.
 * Opens the record where it currently is (warehouse or event),
 * unknown codes go to "assign this label".
 */
function Dispatcher() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = parseScannedCode(params.get('id') ?? '');
    if (!code) {
      router.replace('/');
      return;
    }
    rpc('lookup_code', { p_code: code })
      .then((hits) => router.replace(hits[0] ? routeForLookup(hits[0]) : `/magazyn?label=${encodeURIComponent(code)}`))
      .catch((err) => setError(errorMessage(err)));
  }, [params, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-zinc-400">
      {error ? (
        <p className="text-red-300">{error}</p>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
          Szukam przedmiotu…
        </>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <Dispatcher />
    </Suspense>
  );
}
