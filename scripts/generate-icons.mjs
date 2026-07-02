// Rasterizes assets/icon.svg into every icon size the app needs:
// PWA icons + apple-touch-icon in public/icons/, favicon and the
// native app icon in assets/. Run with: node scripts/generate-icons.mjs
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const svg = await readFile(path.join(root, 'assets', 'icon.svg'), 'utf8');

// Maskable icons get cropped to a circle by Android launchers, so the
// artwork must stay inside the central 80% safe zone.
const maskableSvg = svg.replace(
  /(<rect width="512" height="512" fill="url\(#glow\)"\/>)([\s\S]*)(<\/svg>)/,
  '$1<g transform="translate(51.2 51.2) scale(0.8)">$2</g>$3',
);

const jobs = [
  { src: svg, size: 1024, out: 'assets/icon.png' },
  { src: svg, size: 64, out: 'assets/favicon.png' },
  { src: svg, size: 180, out: 'public/icons/apple-touch-icon.png' },
  { src: svg, size: 192, out: 'public/icons/icon-192.png' },
  { src: svg, size: 512, out: 'public/icons/icon-512.png' },
  { src: maskableSvg, size: 192, out: 'public/icons/icon-maskable-192.png' },
  { src: maskableSvg, size: 512, out: 'public/icons/icon-maskable-512.png' },
];

await mkdir(path.join(root, 'public', 'icons'), { recursive: true });
for (const { src, size, out } of jobs) {
  await sharp(Buffer.from(src), { density: (72 * size) / 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(root, out));
  console.log(`${out} (${size}x${size})`);
}
