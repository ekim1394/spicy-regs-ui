'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Collapsed height, in lines. Tuned to show the opening of a typical abstract. */
const CLAMP_LINES = 4;

/**
 * Docket abstract, rendered inside the title panel (below the title, above the
 * tabs) so it's the first thing read on every docket. Clamps to a fixed length
 * and reveals the rest behind a "Read more" toggle, so a long abstract can't
 * push the tabs off-screen.
 *
 * Wrapper-less by design — the caller owns the surrounding panel/divider.
 * Overflow is measured once while clamped: if the text doesn't exceed the clamp
 * there's no toggle at all. Keyed by docket at the call site, so state resets
 * cleanly when navigating between dockets on the same route segment.
 */
export function DocketSummary({ abstract }: { abstract: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // While clamped, scrollHeight exceeds clientHeight only when text is cut off.
    setOverflowing(el.scrollHeight - el.clientHeight > 1);
  }, [abstract]);

  return (
    <div>
      <p
        ref={ref}
        className="text-sm text-[var(--foreground)] leading-relaxed"
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: CLAMP_LINES,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {abstract}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
