import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#0d9488"/>
  <path d="M50 78 C 30 64, 16 52, 16 37 C 16 26, 24 18, 34 18 C 41 18, 47 22, 50 28 C 53 22, 59 18, 66 18 C 76 18, 84 26, 84 37 C 84 52, 70 64, 50 78 Z" fill="white"/>
</svg>`;

const sizes = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of sizes) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
