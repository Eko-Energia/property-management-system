'use client';

import { useEffect, useRef, useState } from 'react';
import { SCAN_FORMATS } from '@/lib/scan';

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export type CameraState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable' | 'insecure';

// No hard minimums: weak/old cameras used to fail with OverconstrainedError.
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

/**
 * Camera barcode reading. Native BarcodeDetector (fast, Android/Chrome)
 * with html5-qrcode as fallback (iOS Safari, Firefox).
 *
 * - `onDetect` is read through a ref, so re-renders of the parent never restart the camera.
 * - Every await checks a cancellation flag, so the stream is released even when the
 *   component unmounts mid-start (StrictMode, fast close).
 * - Tracks are stopped ~300 ms after close: stopping synchronously on mobile resized the
 *   viewport and blurred the page, which closed the form the code was meant for.
 */
export function useBarcodeCamera({
  active,
  videoRef,
  fallbackElementId,
  onDetect,
}: {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  fallbackElementId: string;
  onDetect: (raw: string) => void;
}) {
  const [state, setState] = useState<CameraState>('starting');
  const [engine, setEngine] = useState<'native' | 'fallback' | null>(null);
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const onDetectRef = useRef(onDetect);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  // environment limits are known up front (component is client-only, mounted when the scanner opens)
  const unsupported: CameraState | null =
    typeof window === 'undefined' ? null : !window.isSecureContext ? 'insecure' : !navigator.mediaDevices?.getUserMedia ? 'unavailable' : null;

  useEffect(() => {
    if (!active || unsupported) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let html5: import('html5-qrcode').Html5Qrcode | null = null;

    const release = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      trackRef.current = null;
      const h = html5;
      html5 = null;
      if (h) {
        Promise.resolve()
          .then(() => (h.isScanning ? h.stop() : undefined))
          .then(() => h.clear())
          .catch(() => undefined);
      }
    };

    const setupTorch = (track: MediaStreamTrack | undefined) => {
      trackRef.current = track ?? null;
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch({ available: Boolean(caps.torch), on: false });
    };

    const startNative = async (): Promise<boolean> => {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      const video = videoRef.current;
      if (!Ctor || !video) return false;
      try {
        const supported = (await Ctor.getSupportedFormats?.()) ?? [...SCAN_FORMATS];
        const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
        if (formats.length === 0) return false;
        const detector = new Ctor({ formats: [...formats] });
        stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS, audio: false });
        if (cancelled) return true;
        const track = stream.getVideoTracks()[0];
        track?.applyConstraints?.({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        setupTorch(track);
        video.srcObject = stream;
        await video.play();
        if (cancelled) return true;
        setEngine('native');
        setState('running');
        const tick = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes.find((c) => c.rawValue)?.rawValue;
              if (value && !cancelled) onDetectRef.current(value);
            }
          } catch {
            // single-frame hiccups are normal
          }
          if (!cancelled) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return true;
      } catch (err) {
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        if ((err as DOMException)?.name === 'NotAllowedError') {
          setState('denied');
          return true;
        }
        return false;
      }
    };

    const startFallback = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        const instance = new Html5Qrcode(fallbackElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        html5 = instance;
        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (w: number, h: number) => ({
              width: Math.max(200, Math.min(Math.floor(w * 0.88), 360)),
              height: Math.max(90, Math.min(Math.floor(h * 0.4), 160)),
            }),
            videoConstraints: VIDEO_CONSTRAINTS,
          },
          (text) => {
            if (!cancelled) onDetectRef.current(text);
          },
          () => undefined,
        );
        if (cancelled) {
          release();
          return;
        }
        setupTorch(undefined); // torch only on the native path
        setEngine('fallback');
        setState('running');
      } catch (err) {
        if (cancelled) return;
        const msg = String((err as Error)?.message ?? err);
        setState(/NotAllowed|Permission/i.test(msg) ? 'denied' : 'unavailable');
      }
    };

    // small delay lets the overlay paint before the permission prompt / camera spin-up
    const startTimer = setTimeout(async () => {
      const handled = await startNative();
      if (!handled && !cancelled) await startFallback();
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      setTimeout(release, 300);
      setEngine(null);
      setState('starting');
      setTorch({ available: false, on: false });
    };
  }, [active, unsupported, videoRef, fallbackElementId]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ available: true, on: next });
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  return { state: unsupported ?? (active ? state : 'idle'), engine, torch, toggleTorch };
}
