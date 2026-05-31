// Regenerate the app favicon (src/app/icon.png) from a vector source so it
// tracks the brand tokens. Prussian-blue squircle + the lucide "flame" mark
// (the same icon the header renders via <Flame/>), white-outlined with a
// lighter-prussian fill. Re-run after a rebrand:  node scripts/gen_app_icon.mjs
//
// Colors are the resolved sRGB of the globals.css oklch tokens:
//   --accent-primary   oklch(0.45 0.125 254) → #185598  (squircle)
//   --accent-secondary oklch(0.52 0.120 254) → #326aac  (flame fill)

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SIZE = 512;
const BG = '#185598';   // --accent-primary
const FILL = '#326aac'; // --accent-secondary
const RADIUS = 112;

// lucide "flame" path, authored on a 24×24 grid. Centered (~12,12), ~20 tall.
const FLAME =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 ' +
  '.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3' +
  'a2.5 2.5 0 0 0 2.5 2.5z';

// Scale 15 → flame ~300px tall; translate to center the (12,12) path origin.
const S = 15;
const T = SIZE / 2 - 12 * S; // 256 - 180 = 76

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${BG}"/>
  <g transform="translate(${T} ${T}) scale(${S})">
    <path d="${FLAME}" fill="${FILL}" stroke="#ffffff" stroke-width="1.15"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(new URL('../src/app/icon.png', import.meta.url), png);
console.log(`wrote src/app/icon.png (${SIZE}×${SIZE}, ${(png.length / 1024).toFixed(1)}KB)`);
