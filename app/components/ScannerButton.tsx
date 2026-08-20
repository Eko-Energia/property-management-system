'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, X, AlertCircle, Camera, Check, HelpCircle, Keyboard, Barcode } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScannerButtonProps {
  onScan: (scannedCode: string) => void;
  className?: string;
  buttonText?: string;
  icon?: React.ElementType;
}

// Utility function to extract SKU / Barcode ID from input
export const parseCodeFromInput = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check if it is a full URL containing '?id=...'
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const id = url.searchParams.get('id');
      if (id) {
        return id.trim();
      }
    }
  } catch (e) {
    // Ignore invalid URL structures and fall back to raw input
  }

  return trimmed;
};

// Backward compatibility alias
export const parseSkuFromInput = parseCodeFromInput;

export default function ScannerButton({ 
  onScan, 
  className = '', 
  buttonText = 'Zeskanuj / Wpisz ID',
  icon: IconComponent
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

  // Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'camera' || (typeof window !== 'undefined' && !window.isSecureContext)) return;

    let html5QrCode: Html5Qrcode | null = null;
    let mediaStream: MediaStream | null = null;
    let animFrameId: number | null = null;
    let isScanningActive = true;

    const handleSuccess = (rawText: string) => {
      if (!isScanningActive) return;
      const parsedCode = parseCodeFromInput(rawText);
      if (parsedCode) {
        isScanningActive = false;
        const cleanCode = String(parsedCode).trim();
        setSuccessMsg(`Zeskanowano pomyślnie kod: ${cleanCode}`);
        setErrorMsg(null);

        // Audio / haptic feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(100);
          } catch (e) {
            // ignore
          }
        }

        // Pause html5QrCode if scanning
        if (html5QrCode && html5QrCode.isScanning) {
          try {
            html5QrCode.pause();
          } catch (e) {
            // ignore
          }
        }

        // 2. Execute onScan callback immediately
        onScan(cleanCode);

        // 3. Close ONLY the scanner overlay
        setIsOpen(false);

        // 4. Asynchronously stop media stream and camera resources in background
        setTimeout(() => {
          if (animFrameId) cancelAnimationFrame(animFrameId);
          if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            mediaStream = null;
          }
          if (html5QrCode) {
            try {
              if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => console.error('Error stopping scanner:', err));
              }
            } catch (e) {
              // ignore
            }
          }
          resetModal();
        }, 300);
      }
    };

    const startNativeBarcodeDetector = async (videoEl: HTMLVideoElement): Promise<boolean> => {
      try {
        if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
          return false;
        }

        let supportedFormats: string[] = [];
        try {
          supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
        } catch (e) {
          supportedFormats = ['code_128', 'qr_code'];
        }

        const desiredFormats = ['code_128', 'qr_code'];
        const formatsToUse = desiredFormats.filter(f => supportedFormats.includes(f));
        const detector = new (window as any).BarcodeDetector({
          formats: formatsToUse.length > 0 ? formatsToUse : ['code_128', 'qr_code']
        });

        // Request 1080p/720p resolution and continuous autofocus
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as any]
          }
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Try applying continuous focus track constraints if supported by browser
        const track = mediaStream.getVideoTracks()[0];
        if (track && typeof track.applyConstraints === 'function') {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }] as any
            });
          } catch (e) {
            // ignore
          }
        }

        videoEl.srcObject = mediaStream;
        await videoEl.play();

        setHasCameraAccess(true);

        const detectFrame = async () => {
          if (!isScanningActive) return;
          try {
            if (videoEl && videoEl.readyState >= 2) {
              const barcodes = await detector.detect(videoEl);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleSuccess(barcodes[0].rawValue);
                return;
              }
            }
          } catch (e) {
            // Ignore single frame detection hiccups
          }
          if (isScanningActive) {
            animFrameId = requestAnimationFrame(detectFrame);
          }
        };

        detectFrame();
        return true;
      } catch (err) {
        console.warn('Native BarcodeDetector stream failed, fallback to html5-qrcode:', err);
        if (mediaStream) {
          mediaStream.getTracks().forEach(t => t.stop());
          mediaStream = null;
        }
        return false;
      }
    };

    const startHtml5QrcodeFallback = async () => {
      try {
        const qrRegionId = 'qr-reader-viewport';
        const container = document.getElementById(qrRegionId);
        if (!container) return;

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setHasCameraAccess(false);
          setMode('manual');
          return;
        }

        // Strict Formats Whitelist: Allow EXCLUSIVELY CODE_128 and QR_CODE to prevent false positives
        const supportedFormats = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        html5QrCode = new Html5Qrcode(qrRegionId, {
          formatsToSupport: supportedFormats,
          verbose: false
        });

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const boxWidth = Math.min(Math.floor(viewfinderWidth * 0.88), 340);
            const boxHeight = Math.min(Math.floor(viewfinderHeight * 0.38), 130);
            return { width: Math.max(boxWidth, 200), height: Math.max(boxHeight, 80) };
          },
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }]
          }
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config as any,
          (decodedText) => {
            handleSuccess(decodedText);
          },
          () => {}
        );

        setHasCameraAccess(true);
      } catch (err) {
        console.warn('html5-qrcode camera stream failed:', err);
        setHasCameraAccess(false);
        setMode('manual');
      }
    };

    const startScanner = async () => {
      const nativeVideoEl = document.getElementById('native-video-viewport') as HTMLVideoElement | null;
      const html5QrViewportEl = document.getElementById('qr-reader-viewport');

      let nativeStarted = false;
      if (nativeVideoEl) {
        nativeStarted = await startNativeBarcodeDetector(nativeVideoEl);
      }

      if (nativeStarted) {
        if (nativeVideoEl) nativeVideoEl.style.display = 'block';
        if (html5QrViewportEl) html5QrViewportEl.style.display = 'none';
      } else {
        if (nativeVideoEl) nativeVideoEl.style.display = 'none';
        if (html5QrViewportEl) html5QrViewportEl.style.display = 'block';
        await startHtml5QrcodeFallback();
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isScanningActive = false;
      clearTimeout(timer);
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
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

    const parsedCode = parseCodeFromInput(manualInput);
    if (parsedCode) {
      setSuccessMsg(`Rozpoznano kod: ${parsedCode}`);
      setTimeout(() => {
        onScan(parsedCode);
        setIsOpen(false);
        resetModal();
      }, 400);
    } else {
      setErrorMsg('Wpisz kod kreskowy, SKU lub adres URL.');
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
        {IconComponent ? (
          <IconComponent className="h-4.5 w-4.5 block shrink-0" />
        ) : (
          <QrCode className="h-4.5 w-4.5 block shrink-0" />
        )}
        {buttonText ? <span>{buttonText}</span> : null}
      </button>

      {/* Modal Viewport */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-[96%] max-w-lg md:w-full mx-auto my-auto shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-855 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Barcode className="h-5 w-5 text-blue-400" />
                Skaner kodów kreskowych / QR
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

                    {/* Native video element for BarcodeDetector hardware acceleration */}
                    <video
                      id="native-video-viewport"
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover rounded-xl"
                      style={{ display: 'none' }}
                    />

                    {/* Viewport element for html5-qrcode library */}
                    <div id="qr-reader-viewport" className="w-full h-full object-cover [&>video]:object-cover" />
                    
                    {/* Scanner line overlays */}
                    {hasCameraAccess && (
                      <div className="absolute inset-0 pointer-events-none border-[18px] border-black/35 flex items-center justify-center">
                        {/* Central targeting crosshair for 1D and 2D */}
                        <div className="w-[220px] h-[130px] border-2 border-dashed border-blue-400/50 rounded-xl relative">
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
                    Nakieruj obiektyw kamery na kod kreskowy (Code 128, EAN) lub kod QR.
                  </p>
                </div>
              ) : (
                /* Manual Text input fallback view */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                      Kod kreskowy, SKU lub Link URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="np. 00045, 5901234567890, I-NA-0001..."
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
                    Jak używać kodów kreskowych i QR?
                  </span>
                  <span className={`text-[10px] transform transition-transform duration-200 ${accordionOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {accordionOpen && (
                  <div className="mt-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-sm text-zinc-300 space-y-4 leading-relaxed animate-in slide-in-from-top-2 duration-200">
                    <p className="text-zinc-300 font-medium">
                      System obsługuje standardowe <strong className="text-white">naklejki z kodami kreskowymi 1D</strong> (np. Code 128, EAN-13, Code 39) oraz <strong className="text-white">kody QR</strong>.
                    </p>
                    <div className="space-y-1.5">
                      <span className="font-bold text-zinc-200 block">Kody kreskowe 1D na przedmiotach:</span>
                      <p className="text-xs text-zinc-400">
                        Kod z naklejki (np. <code className="text-blue-400 font-mono font-bold">00045</code>) wpisuje się w pole "Kod kreskowy (Etykieta)" przy tworzeniu lub edycji zasobu.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="font-bold text-zinc-200 block">Kody QR na smartfonach:</span>
                      <code className="block bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-blue-400 font-mono text-xs select-all break-all leading-normal font-semibold">
                        {appUrl}/skan?id=[KOD_LUB_SKU]
                      </code>
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
