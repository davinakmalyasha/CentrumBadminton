// Generates PWA icons from an inline SVG placeholder logo.
// Usage: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF9A3D"/>
      <stop offset="1" stop-color="#FF7A00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="256" r="150" fill="#FFFFFF"/>
  <!-- shuttlecock -->
  <g transform="translate(256,236)">
    <path d="M0,-84 L34,-30 L-34,-30 Z" fill="#0B2545"/>
    <path d="M-40,-26 L40,-26 L28,10 L-28,10 Z" fill="#0B2545"/>
    <path d="M0,14 L14,96 L-14,96 Z" fill="#0B2545"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });

const targets = [
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-192.png", 192],
  ["public/icons/maskable-512.png", 512],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 64],
];

for (const [out, size] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("OK", out);
}
