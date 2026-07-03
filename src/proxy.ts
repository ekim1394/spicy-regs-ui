import { NextResponse, type NextRequest } from 'next/server';

import { resolveHostRouting } from '@/lib/routing/hostRouting';

/**
 * Splits traffic between the two production hostnames — the apex serves the
 * front door, `app.` serves the product. All the logic lives in
 * {@link resolveHostRouting}; this is just the Next.js adapter.
 *
 * (This is the file formerly known as `middleware.ts`; Next.js 16 renamed the
 * convention to `proxy`.)
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const decision = resolveHostRouting(req.headers.get('host'), pathname, search);

  if (decision.type === 'redirect') {
    return NextResponse.redirect(decision.url, decision.status);
  }
  return NextResponse.next();
}

export const config = {
  // Run on page navigations only. Skip API routes, Next internals, and any
  // path with a file extension (static assets in /public: favicons, icons,
  // manifest, robots/sitemap) so those are never redirected across hosts.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
