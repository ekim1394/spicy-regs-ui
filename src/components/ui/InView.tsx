'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface InViewProps {
  children: ReactNode;
  /**
   * Space reserved (px) before the children mount, to limit the scroll jump
   * when they appear. Roughly the rendered height of the deferred content.
   */
  minHeight?: number;
  /** How far ahead of the viewport to begin mounting (IntersectionObserver rootMargin). */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers mounting its children until they're scrolled near the viewport. Used
 * to hold back below-the-fold panels whose mount kicks off an expensive query —
 * the work only runs if the user actually scrolls to it. Once shown, children
 * stay mounted (so their data isn't refetched on scroll-away).
 */
export function InView({ children, minHeight = 320, rootMargin = '400px', className }: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} className={className} style={shown ? undefined : { minHeight }}>
      {shown ? children : null}
    </div>
  );
}
