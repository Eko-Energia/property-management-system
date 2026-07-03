'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

function ScanDispatcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const rawId = searchParams.get('id');
    if (!rawId) {
      setErrorMsg('Brak identyfikatora SKU w zeskanowanym linku.');
      return;
    }

    const cleanId = rawId.trim().toUpperCase();
    
    // Validate format using regex: (I|C)-[A-Z]{2,3}-\d{4}
    const skuRegex = /^(I|C)-[A-Z]{2,3}-\d{4}$/;
    if (!skuRegex.test(cleanId)) {
      setErrorMsg(`Niepoprawny format identyfikatora SKU: "${cleanId}". Kod powinien zaczynać się od I- lub C-, np. I-NA-0001.`);
      return;
    }

    // Auto-redirect to warehouse page with open parameter
    const timer = setTimeout(() => {
      router.push(`/magazyn?open=${cleanId}`);
    }, 1500); // 1.5 seconds delay for premium animation feel

    return () => clearTimeout(timer);
  }, [router, searchParams]);

  return (
    <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
      
      {errorMsg ? (
        /* Error State UI */
        <>
          <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-10 w-10 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-white">Błąd dyspozytora</h1>
            <p className="text-zinc-400 text-xs leading-relaxed">
              {errorMsg}
            </p>
          </div>
          <Link
            href="/magazyn"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-lg transition-colors active:scale-95 duration-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Przejdź do Magazynu
          </Link>
        </>
      ) : (
        /* Pulse scanning loader animation */
        <>
          <div className="relative h-24 w-24 rounded-2xl border border-zinc-800 bg-zinc-950/80 flex items-center justify-center overflow-hidden">
            {/* Scan green/blue bar indicator animation */}
            <div className="absolute inset-x-0 h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-[bounce_2.5s_infinite]" />
            <QrCode className="h-12 w-12 text-blue-400/80 animate-pulse" />
          </div>
          
          <div className="space-y-2.5">
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
              Odczytywanie kodu QR
            </h1>
            <p className="text-zinc-450 text-xs font-medium leading-relaxed max-w-xs mx-auto">
              Sprawdzanie typu zasobu i przekierowywanie do widoku szczegółów w magazynie...
            </p>
          </div>

          <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden p-[1px]">
            <div className="h-full rounded-full bg-blue-500 animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
          </div>
        </>
      )}

    </div>
  );
}

export default function ScanDispatcherPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)] pointer-events-none" />
      
      <Suspense fallback={
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center space-y-4">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          <span className="text-zinc-500 text-xs font-semibold">Inicjalizacja dyspozytora...</span>
        </div>
      }>
        <ScanDispatcher />
      </Suspense>
    </div>
  );
}
