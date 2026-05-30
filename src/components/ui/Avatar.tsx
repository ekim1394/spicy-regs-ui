'use client';

import * as React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { stringToColor, getInitials } from '@/lib/agencyMetadata';
import { cn } from '@/lib/utils/cn';

/**
 * Round avatar with image-with-fallback semantics, backed by Radix Avatar.
 *
 * Defaults:
 *   - `color` is derived from `name` via `stringToColor` if not supplied.
 *   - `fallback` is `getInitials(name)` if not supplied.
 *
 * Radix's `Image` only mounts visible content once the underlying <img>
 * resolves successfully, so the favicon-with-fallback behaviour comes for
 * free with no error-state bookkeeping.
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Display name used to derive initials + a deterministic color. */
  name: string;
  /** Optional image URL — favicon or thumbnail. Falls back to initials. */
  src?: string | null;
  /** Override the auto-derived background color. */
  color?: string;
  /** Override the auto-derived fallback text (initials). */
  fallback?: string;
  /** Visual size. Defaults to `md` (32px). */
  size?: AvatarSize;
  className?: string;
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 48,
  xl: 72,
};

const SIZE_TEXT: Record<AvatarSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-xl',
};

export function Avatar({
  name,
  src,
  color,
  fallback,
  size = 'md',
  className = '',
}: AvatarProps) {
  const px = SIZE_PX[size];
  const initials = fallback ?? getInitials(name);
  const bg = color ?? stringToColor(name);

  return (
    <RadixAvatar.Root
      className={cn('inline-flex items-center justify-center align-middle overflow-hidden rounded-full flex-shrink-0', className)}
      style={{ width: px, height: px }}
    >
      {src && (
        <RadixAvatar.Image
          src={src}
          alt={`${name} icon`}
          className="w-full h-full object-contain bg-white p-1"
        />
      )}
      <RadixAvatar.Fallback
        className={`w-full h-full flex items-center justify-center font-bold text-white tracking-wide ${SIZE_TEXT[size]}`}
        style={{ backgroundColor: bg }}
        // When `src` is set we briefly defer the fallback to let the image
        // load and avoid a flash. When no `src`, omit `delayMs` entirely so
        // Radix renders the fallback synchronously on first paint.
        delayMs={src ? 200 : undefined}
      >
        {initials}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
