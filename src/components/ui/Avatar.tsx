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
 *
 * Quality floor: agency favicons vary wildly — some domains only expose a
 * 16px `/favicon.ico` or a tiny shared parent-department mark. Those upscale
 * into a blurry smear at avatar sizes. Once the image loads we inspect its
 * intrinsic resolution and, if the smaller side is below {@link QUALITY_FLOOR_PX},
 * discard it and show the colored initials instead — a clean letter beats a
 * mushy icon. Using the *min* dimension also rejects short, wide wordmarks.
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Minimum intrinsic dimension (px) a favicon must have to be shown. Below this
 * the Avatar falls back to initials. 48 rejects the common 16/32px favicons and
 * Google's generic globe placeholder while keeping genuinely hi-res icons.
 * Raise for stricter, lower for more permissive.
 */
const QUALITY_FLOOR_PX = 48;

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

  // Set true once a loaded image is judged too low-res to render (see
  // QUALITY_FLOOR_PX). Reset whenever the source changes.
  const [belowFloor, setBelowFloor] = React.useState(false);
  React.useEffect(() => { setBelowFloor(false); }, [src]);

  // Radix only mounts the DOM <img> after its internal loader reports the src
  // as loaded, so by the time this ref fires the bitmap is decoded and its
  // intrinsic size is known. We measure off the ref rather than an `onLoad`
  // prop because a cached image usually completes before React can attach the
  // handler — `img.complete` covers that case.
  const measureQuality = React.useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    const judge = () => {
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      if (min > 0 && min < QUALITY_FLOOR_PX) setBelowFloor(true);
    };
    if (img.complete && img.naturalWidth > 0) judge();
    else img.addEventListener('load', judge, { once: true });
  }, []);

  // Once rejected, hand Radix an `undefined` src so it transitions to its
  // `error` state (its loader treats any falsy src as an error) — that hides
  // the <img> and reveals the Fallback. We use `undefined` rather than `''`
  // because the transient re-render after rejection still reports `loaded` for
  // one frame and renders the <img>; an empty-string src there triggers a
  // browser warning + page re-fetch, whereas `undefined` omits the attribute.
  // Unmounting the Image ourselves would leave Radix's status stuck at
  // `loaded` (blank), so we keep it mounted and just drop the src.
  const effectiveSrc = belowFloor ? undefined : (src ?? undefined);

  return (
    <RadixAvatar.Root
      className={cn('inline-flex items-center justify-center align-middle overflow-hidden rounded-full flex-shrink-0', className)}
      style={{ width: px, height: px }}
    >
      {src && (
        <RadixAvatar.Image
          ref={measureQuality}
          src={effectiveSrc}
          alt={`${name} icon`}
          className="w-full h-full object-contain bg-white p-1"
        />
      )}
      <RadixAvatar.Fallback
        className={`w-full h-full flex items-center justify-center font-bold text-white tracking-wide ${SIZE_TEXT[size]}`}
        style={{ backgroundColor: bg }}
        // While a candidate image is still in play we briefly defer the
        // fallback to avoid a flash. Once rejected (or no `src`), omit
        // `delayMs` so Radix renders the initials synchronously.
        delayMs={src && !belowFloor ? 200 : undefined}
      >
        {initials}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
