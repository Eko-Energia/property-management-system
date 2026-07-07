'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, X, AlertCircle, Camera, Check, HelpCircle, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerButtonProps {
  onScan: (sku: string) => void;
  className?: string;
  buttonText?: string;
}

// Utility function to extract SKU ID from input
export const parseSkuFromInput = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check if it is a full URL containing '?id=...'
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const id = url.searchParams.get('id');
      if (id) {
        return id.toUpperCase().trim();
      }
    }
  } catch (e) {
    // Ignore invalid URL structures and fall back to regex
  }

  // Regex lookup for SKU format e.g. I-NA-0001 or C-EL-1002 anywhere in the text
  const skuRegex = /(I|C)-[A-Z]{2,3}-\d{4}/i;
  const match = trimmed.match(skuRegex);
  if (match) {
    return match[0].toUpperCase();
  }

  return null;
};

export default function ScannerButton({ 
  onScan, 
  className = '', 
  buttonText = 'Zeskanuj / Wpisz ID' 
}: ScannerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [isNotSecure, setIsNotSecure] = useState(false);

  // Dynamic host URL for instruction displays
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nasza-domena.pl';

  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setIsNotSecure(true);
        setMode('manual');
        setHasCameraAccess(false);
      } else {
        setIsNotSecure(false);
      }
    }
  }, [isOpen]);

  // Scroll Lock & Back Button Interceptor
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Intercept back button
    window.history.pushState({ modalOpen: true }, '', window.location.href);

    const handlePopState = () => {
      setIsOpen(false);
      resetModal();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'camera' || (typeof window !== 'undefined' && !window.isSecureContext)) return;

    let html5QrCode: Html5Qrcode | null = null;
    const qrRegionId = 'qr-reader-viewport';

    const startScanner = async () => {
      try {
        // Enforce that container exists
        const container = document.getElementById(qrRegionId);
        if (!container) return;

        // Check if there are cameras
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setHasCameraAccess(false);
          setMode('manual');
          return;
        }

        html5QrCode = new Html5Qrcode(qrRegionId);
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            const parsedSku = parseSkuFromInput(decodedText);
            if (parsedSku) {
              setSuccessMsg(`Zeskanowano pomyślnie SKU: ${parsedSku}`);
              setErrorMsg(null);
              // Audio click feedback
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(100);
              }
              // Stop camera and trigger callback
              if (html5QrCode) {
                html5QrCode.stop().then(() => {
                  setTimeout(() => {
                    onScan(parsedSku);
                    setIsOpen(false);
                    resetModal();
                  }, 600);
                }).catch(err => {
                  console.error(err);
                  onScan(parsedSku);
                  setIsOpen(false);
                  resetModal();
                });
              }
            } else {
              setErrorMsg('Zeskanowany kod nie pasuje do wzorca SKU ani URL dyspozytora.');
            }
          },
          () => {
            // Verbose logging of frame scanning errors is suppressed
          }
        );
        setHasCameraAccess(true);
      } catch (err) {
        console.warn('Camera stream failed or permission denied:', err);
        setHasCameraAccess(false);
        setMode('manual');
      }
    };

    // Tiny timeout to let modal render fully
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error('Error stopping scanner:', err));
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isOpen, mode, onScan]);

  const resetModal = () => {
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;
    setMode(isSecure ? 'camera' : 'manual');
    setHasCameraAccess(isSecure ? null : false);
    setManualInput('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setAccordionOpen(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedSku = parseSkuFromInput(manualInput);
    if (parsedSku) {
      setSuccessMsg(`Rozpoznano SKU: ${parsedSku}`);
      setTimeout(() => {
        onScan(parsedSku);
        setIsOpen(false);
        resetModal();
      }, 500);
    } else {
      setErrorMsg('Niepoprawne ID. Wpisz SKU (np. I-NA-0001) lub pełny adres URL dyspozytora.');
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500 hover:bg-blue-400 text-black shadow-lg shadow-blue-500/10 active:scale-95 transition-all duration-150 ${className}`}
      >
        <QrCode className="h-4.5 w-4.5 block shrink-0" />
        <span>{buttonText}</span>
      </button>

      {/* Modal Viewport */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-[96%] max-w-lg md:w-full mx-auto my-auto shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-855 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-400" />
                Skaner kodów QR / SKU
              </h3>
              <button
                type="button"
                onClick={() => { setIsOpen(false); resetModal(); }}
                className="text-zinc-500 hover:text-white transition-colors active:scale-95 duration-100 p-1.5 rounded-lg hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 md:p-6 space-y-5 flex-1 overflow-y-auto">
              
              {isNotSecure && (
                <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 text-amber-400 text-xs flex gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
                  <span className="font-semibold leading-relaxed">Przeglądarka blokuje kamerę. Użyj wpisywania ręcznego.</span>
                </div>
              )}

              {/* Toggles (Only visible if camera is supported) */}
              {hasCameraAccess !== false && (
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setMode('camera'); setErrorMsg(null); }}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      mode === 'camera' 
                        ? 'bg-zinc-950 text-white shadow-sm border border-zinc-800' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Kamera w telefonie
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('manual'); setErrorMsg(null); }}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      mode === 'manual' 
                        ? 'bg-zinc-950 text-white shadow-sm border border-zinc-800' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    Wpisz ręcznie
                  </button>
                </div>
              )}

              {/* View Selector */}
              {mode === 'camera' ? (
                <div className="space-y-4">
                  {/* Camera view screen */}
                  <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center">
                    
                    {/* Pulsing loading spinner */}
                    {hasCameraAccess === null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-zinc-500 bg-zinc-900">
                        <div className="relative flex h-8 w-8 items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-25"></span>
                          <Camera className="h-5 w-5 text-blue-400 animate-pulse" />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider uppercase">Inicjalizacja kamery...</span>
                      </div>
                    )}

                    {/* Viewport element for html5-qrcode library */}
                    <div id="qr-reader-viewport" className="w-full h-full object-cover [&>video]:object-cover" />
                    
                    {/* Scanner line overlays */}
                    {hasCameraAccess && (
                      <div className="absolute inset-0 pointer-events-none border-[18px] border-black/35 flex items-center justify-center">
                        {/* Central targeting crosshair */}
                        <div className="w-[180px] h-[180px] border-2 border-dashed border-blue-400/50 rounded-xl relative">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br" />
                          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-red-500/60 animate-[bounce_2s_infinite]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-550 text-center font-medium max-w-xs mx-auto leading-relaxed">
                    Nakieruj obiektyw kamery na kod QR zasobu, aby zeskanować automatycznie.
                  </p>
                </div>
              ) : (
                /* Manual Text input fallback view */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                      Identyfikator SKU lub Link URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="np. I-NA-0001, C-EL-1002 lub wklej adres..."
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs rounded-lg active:scale-95 transition-all uppercase tracking-wider"
                  >
                    Weryfikuj i Otwórz
                  </button>
                </form>
              )}

              {/* Action feedback indicators */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
                  <span className="font-medium leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 text-xs flex gap-2.5 animate-in fade-in duration-200">
                  <Check className="h-4.5 w-4.5 shrink-0 text-emerald-550" />
                  <span className="font-bold leading-relaxed">{successMsg}</span>
                </div>
              )}

              {/* Bottom Instructions Accordion Section */}
              <div className="border-t border-zinc-900 pt-4">
                <button
                  type="button"
                  onClick={() => setAccordionOpen(!accordionOpen)}
                  className="w-full flex items-center justify-between text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-semibold py-1 focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    Jak kodować i drukować kody QR?
                  </span>
                  <span className={`text-[10px] transform transition-transform duration-200 ${accordionOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                       {accordionOpen && (
                  <div className="mt-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-sm text-zinc-300 space-y-4 leading-relaxed animate-in slide-in-from-top-2 duration-200">
                    <p className="text-zinc-300 font-medium">
                      Nasze kody QR są zoptymalizowane tak, aby można je było skanować <strong className="text-white">bezpośrednio fabrycznym aparatem smartfona</strong> bez konieczności uruchamiania tej aplikacji.
                    </p>
                    <div className="space-y-1.5">
                      <span className="font-bold text-zinc-200 block">Prawidłowy format linku (URL) w kodzie QR:</span>
                      <code className="block bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-blue-400 font-mono text-xs select-all break-all leading-normal font-semibold">
                        {appUrl}/skan?id=[SKU]
                      </code>
                      <span className="text-[11px] text-zinc-550 mt-1 block">
                        Przykład: <strong className="text-zinc-400 font-mono">{appUrl}/skan?id=I-NA-0001</strong>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="font-bold text-zinc-200 block">Struktura identyfikatora SKU:</span>
                      <ul className="list-disc pl-5 space-y-2 text-zinc-350">
                        <li>
                          <strong className="text-white">Pierwsza litera</strong>: 
                          <code className="text-blue-300 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-xs ml-1 font-bold">I</code> (sprzęt trwały - items) lub 
                          <code className="text-blue-300 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-xs ml-1 font-bold">C</code> (zużywalne - consumables).
                        </li>
                        <li>
                          <strong className="text-white">Kod kategorii</strong>: 
                          2-3 litery przypisane w modalu kategorii (np. <code className="text-blue-300 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-xs font-bold">NA</code> dla narzędzi).
                        </li>
                        <li>
                          <strong className="text-white">Kolejny numer</strong>: 
                          4-cyfrowy ciąg cyfr (np. <code className="text-blue-300 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-xs font-bold">0001</code>).
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
