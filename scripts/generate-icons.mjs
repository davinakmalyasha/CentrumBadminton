// Generates PWA icons from assets/centrumLOGO.avif (falls back to SVG if missing)
// Usage: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const LOGO = "assets/centrumLOGO.avif";
const hasLogo = existsSync(LOGO);
const PNG_OPTS = { palette: true, quality: 95, compressionLevel: 9 };

async function sharpFromLogo(size, maskable = false) {
  if (!hasLogo) throw new Error("no logo");
  // avif already has transparent background and perfect circle — use contain to preserve full ring
  let img = sharp(LOGO).resize(size, size, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 0 },
    position: "centre",
  });
  if (maskable) {
    const pad = Math.round(size * 0.12);
    img = sharp({
      create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([
        {
          input: await sharp(LOGO)
            .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer(),
          left: pad,
          top: pad,
        },
      ])
      .png(PNG_OPTS);
  }
  return img.png(PNG_OPTS);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF9A3D"/>
      <stop offset="1" stop-color="#FF7A00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="256" r="150" fill="#FFFFFF"/>
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
  ["public/icons/maskable-512.png", 512, true],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 64],
];

for (const [out, size, maskable] of targets) {
  try {
    if (hasLogo) {
      await (await sharpFromLogo(size, maskable)).toFile(out);
    } else {
      await sharp(Buffer.from(svg)).resize(size, size).png(PNG_OPTS).toFile(out);
    }
  } catch {
    await sharp(Buffer.from(svg)).resize(size, size).png(PNG_OPTS).toFile(out);
  }
  console.log("OK", out, hasLogo ? "(logo)" : "(svg fallback)");
}
