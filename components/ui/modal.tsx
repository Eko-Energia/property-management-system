'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

let openCount = 0;

/**
 * Closes an overlay with the phone's back gesture/button instead of leaving
 * the page. Pushes one history entry while open and removes it when the
 * overlay is closed from the UI. Works with stacked overlays and keeps
 * Next.js' own history state intact.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    let active = true;
    let pushed = false;
    let poppedByUser = false;
    const onPop = () => {
      if (window.history.state?.overlay === id) return; // a nested overlay was closed
      poppedByUser = true;
      onCloseRef.current();
    };
    // history.back() is async: wait for a previous overlay's cleanup before pushing,
    // otherwise its back() would pop *our* entry (form closes -> details open).
    void (pendingBack ?? Promise.resolve()).then(() => {
      if (!active) return;
      window.history.pushState({ ...window.history.state, overlay: id }, '');
      pushed = true;
      window.addEventListener('popstate', onPop);
    });
    return () => {
      active = false;
      window.removeEventListener('popstate', onPop);
      if (pushed && !poppedByUser) {
        // chain after any back() still in flight (e.g. a confirm dialog closing just before us)
        const chained: Promise<void> = (pendingBack ?? Promise.resolve()).then(() => popIfTop(id));
        pendingBack = chained;
        void chained.then(() => {
          if (pendingBack === chained) pendingBack = null;
        });
      }
    };
  }, [open]);
}

let pendingBack: Promise<void> | null = null;

function popIfTop(id: string): Promise<void> {
  if (window.history.state?.overlay !== id) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done);
      resolve();
    };
    window.addEventListener('popstate', done);
    window.history.back();
  });
}

function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = '';
    };
  }, [open]);
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action bar at the bottom (always visible on small phones). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing by backdrop click (e.g. forms with unsaved input). */
  dismissible?: boolean;
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useBackToClose(open, onClose);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), select, textarea, button:not([data-close])');
    (first ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    panel?.addEventListener('keydown', onKey);
    return () => {
      panel?.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
    // focus only when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl outline-none',
          'rounded-t-2xl sm:rounded-2xl animate-in slide-in-from-bottom',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-zinc-100">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800/80 bg-zinc-950 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
