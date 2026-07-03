/**
 * Host-based routing for the two production domains.
 *
 * The whole product is one Next.js app, but it's served under two hostnames
 * (DNS lives in Cloudflare, both point at the same Vercel deployment):
 *
 *   - `spicy-regs.dev`      — the "front door": the marketing/About page only.
 *   - `app.spicy-regs.dev`  — the product itself: feed, agencies, search,
 *                             Federal Register, lab, docket/document pages.
 *
 * This module is the single source of truth for that split. It's a pure
 * function so it can be unit-tested without a `NextRequest`; the middleware
 * (`src/middleware.ts`) is a thin adapter over it.
 *
 * Any host that isn't one of the production domains (localhost, Vercel preview
 * URLs, `*.vercel.app`) is left untouched — every route is served from the one
 * host, which is what you want in dev and on previews.
 */

export const APEX_HOST = 'spicy-regs.dev';
export const WWW_HOST = 'www.spicy-regs.dev';
export const APP_HOST = 'app.spicy-regs.dev';

/**
 * Paths that make up the front door and therefore live on the apex domain.
 * Everything not listed here is part of the app and belongs on `app.`.
 * `/` is always treated as a front-door path (it renders the home redirect
 * to `/about`).
 */
const APEX_PATHS = ['/about'];

/** True for the paths served on the apex (front-door) domain. */
export function isApexPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return APEX_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type HostRoutingDecision =
  | { type: 'next' }
  | { type: 'redirect'; url: string; status: 307 | 308 };

/**
 * Decide what to do with a request, given its `Host` header and path.
 *
 * @param hostHeader raw value of the `Host` header (may include a port).
 * @param pathname   the request pathname, e.g. `/feed`.
 * @param search     the query string including the leading `?`, or `''`.
 */
export function resolveHostRouting(
  hostHeader: string | null | undefined,
  pathname: string,
  search = '',
): HostRoutingDecision {
  const host = (hostHeader ?? '').split(':')[0].toLowerCase();
  const rest = `${pathname}${search}`;

  // Canonicalize www → apex (permanent).
  if (host === WWW_HOST) {
    return { type: 'redirect', url: `https://${APEX_HOST}${rest}`, status: 308 };
  }

  // Apex: front door only. App routes bounce to the app subdomain.
  if (host === APEX_HOST) {
    if (isApexPath(pathname)) return { type: 'next' };
    return { type: 'redirect', url: `https://${APP_HOST}${rest}`, status: 308 };
  }

  // App subdomain: the product. Root lands on the feed; the front-door pages
  // bounce back to the apex so each page has one canonical host.
  if (host === APP_HOST) {
    if (pathname === '/') {
      return { type: 'redirect', url: `https://${APP_HOST}/feed`, status: 307 };
    }
    if (isApexPath(pathname)) {
      return { type: 'redirect', url: `https://${APEX_HOST}${rest}`, status: 308 };
    }
    return { type: 'next' };
  }

  // Any other host (localhost, previews, *.vercel.app): serve everything.
  return { type: 'next' };
}
