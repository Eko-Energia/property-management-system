'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Flashlight, FlashlightOff, Keyboard, Loader2, ShieldAlert, X } from 'lucide-react';
import { parseScannedCode } from '@/lib/scan';
import { useBackToClose } from '@/components/ui/modal';
import { cn } from '@/components/ui/cn';
import { useBarcodeCamera } from './use-barcode-camera';

export type ScanFeedback = { tone: 'success' | 'error' | 'info'; text: string } | null;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Return a promise to show a busy state; in continuous mode the camera keeps running. */
  onScan: (code: string) => void | Promise<void>;
  title?: string;
  hint?: ReactNode;
  /** single: close after first code. continuous: keep scanning (packing many items). */
  mode?: 'single' | 'continuous';
  /** Result of the last scan, shown over the camera in continuous mode. */
  feedback?: ScanFeedback;
  /** Extra content under the viewfinder (e.g. current box selector). */
  footer?: ReactNode;
};

const REPEAT_WINDOW_MS = 2500;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

/** Mounted only while open, so every opening starts with fresh state and a fresh camera. */
export function ScannerModal(props: Props) {
  if (!props.open || typeof document === 'undefined') return null;
  return <ScannerOverlay {...props} />;
}

function ScannerOverlay({ onClose, onScan, title = 'Skanuj etykietę', hint, mode = 'single', feedback, footer }: Props) {
  const [tab, setTab] = useState<'camera' | 'manual'>('camera');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackId = useId().replace(/:/g, '') + '-qr';
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);

  useBackToClose(true, onClose);

  const handleCode = async (raw: string) => {
    const code = parseScannedCode(raw);
    if (!code || busyRef.current) return;
    const now = Date.now();
    if (lastRef.current && lastRef.current.code === code && now - lastRef.current.at < REPEAT_WINDOW_MS) return;
    lastRef.current = { code, at: now };
    vibrate(80);
    if (mode === 'single') {
      onClose();
      await onScan(code);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await onScan(code);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const camera = useBarcodeCamera({
    active: tab === 'camera',
    videoRef,
    fallbackElementId: fallbackId,
    onDetect: handleCode,
  });

  // no camera -> manual entry (derived, not synced through an effect)
  const cameraFailed = camera.state === 'insecure' || camera.state === 'unavailable' || camera.state === 'denied';
  const activeTab = cameraFailed ? 'manual' : tab;

  useEffect(() => {
    if (feedback?.tone === 'error') vibrate([60, 60, 60]);
  }, [feedback]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    lastRef.current = null;
    void handleCode(manual);
    setManual('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-zinc-100" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{title}</p>
          {hint && <p className="truncate text-xs text-zinc-400">{hint}</p>}
        </div>
        <div className="flex items-center gap-1">
          {camera.torch.available && activeTab === 'camera' && (
            <button onClick={camera.toggleTorch} className="rounded-full p-2.5 text-zinc-300 hover:bg-white/10" aria-label="Latarka">
              {camera.torch.on ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </button>
          )}
          <button onClick={onClose} className="rounded-full p-2.5 text-zinc-300 hover:bg-white/10" aria-label="Zamknij skaner">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {activeTab === 'camera' ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn('absolute inset-0 h-full w-full object-cover', camera.engine !== 'native' && 'hidden')}
            />
            <div id={fallbackId} className={cn('absolute inset-0 [&_video]:h-full [&_video]:object-cover', camera.engine !== 'fallback' && 'hidden')} />
            {camera.engine === 'native' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-36 w-[min(88vw,380px)] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            )}
            {camera.state === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-zinc-400">
                <Loader2 className="h-7 w-7 animate-spin" />
                Uruchamiam aparat…
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            {camera.state === 'insecure' && <Notice>Aparat działa tylko przez HTTPS. Wpisz kod ręcznie.</Notice>}
            {camera.state === 'denied' && <Notice>Brak zgody na aparat. Włącz ją w ustawieniach przeglądarki albo wpisz kod.</Notice>}
            {camera.state === 'unavailable' && <Notice>Nie udało się uruchomić aparatu. Wpisz kod ręcznie.</Notice>}
            <form onSubmit={submitManual} className="w-full max-w-sm space-y-3">
              <input
                autoFocus
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Numer etykiety lub SKU (np. 00045, I-EL-0001)"
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-center font-mono text-base tracking-wide placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <button type="submit" disabled={!manual.trim()} className="h-12 w-full rounded-xl bg-blue-600 font-medium disabled:opacity-40">
                Szukaj
              </button>
            </form>
          </div>
        )}

        {(feedback || busy) && mode === 'continuous' && (
          <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center">
            <div
              key={feedback?.text}
              className={cn(
                'animate-in slide-in-from-bottom rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg',
                busy && 'bg-zinc-800 text-zinc-200',
                !busy && feedback?.tone === 'success' && 'bg-emerald-600 text-white',
                !busy && feedback?.tone === 'error' && 'bg-red-600 text-white',
                !busy && feedback?.tone === 'info' && 'bg-zinc-800 text-zinc-100',
              )}
            >
              {busy ? 'Przetwarzam…' : feedback?.text}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {footer}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-900 p-1">
          <button
            onClick={() => setTab('camera')}
            disabled={cameraFailed}
            className={cn('flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium disabled:opacity-40', activeTab === 'camera' ? 'bg-zinc-700' : 'text-zinc-400')}
          >
            <Camera className="h-4 w-4" /> Aparat
          </button>
          <button
            onClick={() => setTab('manual')}
            className={cn('flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium', activeTab === 'manual' ? 'bg-zinc-700' : 'text-zinc-400')}
          >
            <Keyboard className="h-4 w-4" /> Wpisz kod
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-sm items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-950/40 p-3 text-sm text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
