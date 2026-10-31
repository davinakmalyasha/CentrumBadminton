// Generate a small transparent circular badge from the transparent source.
// Diet version: 256px + size shootout (palette-PNG vs AVIF-with-alpha),
// winner keeps the public/centrumLOGO-badge.* name. AVIF keeps alpha;
// PNG uses palette for tiny size. Both stay transparent (no background).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const size = 256;
const r = size / 2;
const pad = Math.round(size * 0.09);

const src = process.argv[2] ?? "assets/centrumLOGO.png";

const content = await sharp(src)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(Math.round(size * 0.8), Math.round(size * 0.8), {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// White circle base + dest-in circular mask
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
);
const white = await sharp({
  create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
})
  .png()
  .toBuffer();
const comp = await sharp(white)
  .composite([{ input: content, top: pad, left: pad }])
  .png()
  .toBuffer();
const circled = await sharp(comp)
  .composite([{ input: svg, top: 0, left: 0, blend: "dest-in" }])
  .png()
  .toBuffer();

// Contenders: palette PNG (tiny, universal) vs AVIF with alpha (tiny, modern)
const pngBuf = await sharp(circled).png({ compressionLevel: 9, palette: true }).toBuffer();
let avifBuf = null;
try {
  avifBuf = await sharp(circled).avif({ quality: 60 }).toBuffer();
} catch (e) {
  console.log("AVIF encode unavailable:", e.message);
}
console.log("palette-PNG bytes:", pngBuf.length);
if (avifBuf) console.log("avif bytes:", avifBuf.length);

if (avifBuf && avifBuf.length < pngBuf.length) {
  writeFileSync("public/centrumLOGO-badge.avif", avifBuf);
  console.log("WINNER avif → public/centrumLOGO-badge.avif");
} else {
  writeFileSync("public/centrumLOGO-badge.png", pngBuf);
  console.log("WINNER png → public/centrumLOGO-badge.png");
}

// 32px PNG favicon (browsers accept PNG favicons via <link rel=icon>)
const fav = await sharp(circled).resize(32, 32, { fit: "contain" }).png().toBuffer();
writeFileSync("public/icon-32.png", fav);
console.log("favicon bytes:", fav.length, "→ public/icon-32.png");
