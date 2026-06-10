'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Lightweight, accessible modal dialog. Renders in a portal so it escapes any
 * overflow-clipped scroll container, dims the page behind a prussian-tinted
 * scrim, and traps the essentials: Esc closes, a backdrop click closes, body
 * scroll is locked while open, and focus moves into the panel on open and
 * returns to the trigger on close.
 *
 * Chrome only — the caller owns the content. Pass `title` for the labelled
 * header (with a built-in close button) or omit it and render a fully custom
 * header inside `children`.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional header title; when set, renders the standard header + close button. */
  title?: React.ReactNode;
  /** Secondary line under the title (metadata, counts). */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. Defaults to a readable column. */
  widthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = 'max-w-2xl',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the panel so Esc/tabbing land in the dialog.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: 'color-mix(in srgb, var(--foreground) 38%, transparent)' }}
      onMouseDown={(e) => {
        // Only a click that starts AND lands on the backdrop closes — guards
        // against a drag that began inside the panel ending on the scrim.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'card-static card-lg relative my-auto w-full outline-none',
          widthClass,
        )}
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        {title != null && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug text-[var(--foreground)]">
                {title}
              </h3>
              {subtitle != null && (
                <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                'shrink-0 rounded-sm p-1 text-[var(--muted)] transition-colors',
                'hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
