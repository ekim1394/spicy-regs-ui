// Validate + bake agency favicons into src/lib/data/agencies.json.
//
// Why this exists: at runtime we'd otherwise point each Avatar at Google's
// favicon service (https://www.google.com/s2/favicons?domain=…&sz=128). That
// service is great when the domain has a real favicon, but for domains that
// don't it serves a generic GLOBE placeholder to browsers (while returning a
// clean 404 to non-browser clients like this script). The globe is a full
// 128px image, so a client-side size floor can't catch it.
//
// So we resolve every agency's icon HERE, server-side, where "no favicon"
// shows up honestly as a 404. We keep the icon URL only when Google returns a
// real bitmap that clears the quality floor; everything else (404 → would be a
// globe, or too-small → would be blurry) becomes `favicon: null`, and the
// Avatar renders colored initials instead.
//
// Re-run after editing the agency list or to refresh:  node scripts/validate_favicons.mjs
//
// NOTE: the QUALITY_FLOOR_PX here must stay in sync with the one in
// src/components/ui/Avatar.tsx (kept as defense-in-depth).

import { readFile, writeFile } from 'node:fs/promises';

const JSON_PATH = new URL('../src/lib/data/agencies.json', import.meta.url);
const QUALITY_FLOOR_PX = 48;
const CONCURRENCY = 4;
const MAX_RETRIES = 6;
const THROTTLE_MS = 150; // small per-request spacing to stay under s2's rate limit
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** hostname from a possibly scheme-less website string, or null. */
function hostOf(website) {
  if (!website) return null;
  try {
    const raw = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(raw).hostname || null;
  } catch {
    return null;
  }
}

/** PNG/GIF/ICO/JPEG intrinsic width from raw bytes, or 0 if undetermined. */
function bitmapWidth(buf) {
  // PNG: width is a big-endian uint32 at byte offset 16 (IHDR).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return buf.readUInt32BE(16);
  }
  // GIF: little-endian uint16 at offset 6.
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49) {
    return buf.readUInt16LE(6);
  }
  // ICO: width byte at offset 6 (0 means 256).
  if (buf.length >= 7 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1) {
    return buf[6] === 0 ? 256 : buf[6];
  }
  // JPEG: walk the segment markers to the Start-Of-Frame, which holds width.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      // Standalone markers (no length payload): RSTn, SOI/EOI, TEM.
      if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) { o += 2; continue; }
      const len = buf.readUInt16BE(o + 2);
      // SOF0–SOF15 carry frame dims, excluding DHT(C4)/JPG(C8)/DAC(CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return buf.readUInt16BE(o + 7); // [marker][len:2][precision:1][height:2][width:2]
      }
      o += 2 + len;
    }
  }
  return 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve one agency to a validated icon URL or null.
 * Returns { url, reason } — reason is for the run report.
 */
async function resolve(agency) {
  const host = hostOf(agency.website);
  if (!host) return { url: null, reason: 'no-website' };

  // Request 128px (the largest s2 serves) for crispness; Google returns the
  // true source size when smaller, which is what the floor check measures.
  const url = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(THROTTLE_MS);
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      // A clean 404 is Google's honest "no favicon for this domain" — the
      // browser would paint a globe placeholder here, so we drop it. (The 404
      // body is itself a tiny globe; ignore it.)
      if (res.status === 404) return { url: null, reason: 'no-favicon (would be globe)' };

      const ct = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());

      // Anything that isn't a clean 200 image is almost always rate-limiting —
      // a 200 HTML "sorry" page, a 429, or a 3xx to one. Retry, never drop:
      // mis-reading a throttle as "no favicon" silently nukes a real icon.
      if (res.status !== 200 || !ct.startsWith('image/')) {
        throw new Error(`throttled? status ${res.status} ct ${ct || 'none'}`);
      }
      const w = bitmapWidth(buf);
      if (w === 0) throw new Error('unreadable bitmap'); // truncated → transient

      if (w < QUALITY_FLOOR_PX) return { url: null, reason: `too-small (${w}px)` };
      return { url, reason: `ok (${w}px)` };
    } catch (err) {
      if (attempt === MAX_RETRIES) return { url: undefined, reason: `ERROR ${err.message}` };
      await sleep(500 * attempt);
    }
  }
  return { url: undefined, reason: 'ERROR exhausted' };
}

/** Run resolve() over the list with a small concurrency cap. */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const agencies = JSON.parse(await readFile(JSON_PATH, 'utf8'));
console.log(`Validating favicons for ${agencies.length} agencies (floor ${QUALITY_FLOOR_PX}px)…\n`);

const results = await mapPool(agencies, CONCURRENCY, resolve);

let kept = 0,
  dropped = 0;
const errors = [];
results.forEach((r, idx) => {
  const a = agencies[idx];
  if (r.url === undefined) {
    errors.push(a.code); // transient — leave existing value untouched
    return;
  }
  a.favicon = r.url; // string URL or null
  if (r.url) kept++;
  else dropped++;
});

await writeFile(JSON_PATH, JSON.stringify(agencies, null, 2) + '\n');

console.log(`kept ${kept} real icons, dropped ${dropped} → initials`);
if (errors.length) {
  console.log(`\n${errors.length} transient errors (left unchanged, re-run to resolve): ${errors.join(' ')}`);
  process.exitCode = 1;
}
