# Hosting & domains

The whole product is **one Next.js app on Vercel**, served under two hostnames:

| Hostname | Serves | Notes |
|---|---|---|
| `spicy-regs.dev` | The front door — the `/about` page (and `/`, which redirects to it). | The "main page". |
| `app.spicy-regs.dev` | The product — feed, agencies, search, Federal Register, lab, and docket/document pages. | `/` redirects to `/feed`. |
| `www.spicy-regs.dev` | — | Redirects to the apex. |

DNS for all of these lives in **Cloudflare** and points at the Vercel deployment.

## How the split works

DNS only gets both hostnames to the same deployment; the per-page split is done in
the app by a Next.js proxy (formerly "middleware"):

- [`src/proxy.ts`](../src/proxy.ts) — the Next.js adapter (runs on every page navigation).
- [`src/lib/routing/hostRouting.ts`](../src/lib/routing/hostRouting.ts) — the pure decision
  function (unit-tested in `hostRouting.test.ts`), the single source of truth for which
  paths belong to which host.

Rules:

- On the apex, only front-door paths (`/`, `/about`) are served; every app route
  (`/feed`, `/agencies`, …) 308-redirects to `app.spicy-regs.dev`, preserving path + query.
- On `app.`, `/` lands on `/feed`, and the front-door pages (`/about`) 308-redirect back
  to the apex, so each page has one canonical host.
- Any other host (localhost, Vercel preview URLs, `*.vercel.app`) is left untouched — every
  route is served from the single host, which is what you want in dev and on previews.

To move a path between hosts, edit `APEX_PATHS` in `hostRouting.ts` — nothing else.

## One-time setup outside the code

In the **Vercel project → Settings → Domains**, add all three domains:
`spicy-regs.dev`, `app.spicy-regs.dev`, and `www.spicy-regs.dev`. In **Cloudflare DNS**,
point each at Vercel (per Vercel's domain instructions) and set the records to
**DNS-only** (grey cloud) unless you have Cloudflare's proxy configured to preserve the
`Host` header — the proxy split relies on the incoming `Host`.
