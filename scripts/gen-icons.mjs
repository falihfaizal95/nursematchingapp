import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("assets", { recursive: true });

const TEAL = "#0d9488";
const CREAM = "#FBF7F1";

const heartPath =
  "M50 78 C 30 64, 16 52, 16 37 C 16 26, 24 18, 34 18 C 41 18, 47 22, 50 28 C 53 22, 59 18, 66 18 C 76 18, 84 26, 84 37 C 84 52, 70 64, 50 78 Z";

const squareIcon = (size, { bg = TEAL, fg = "white", radius = 22 } = {}) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="${radius}" fill="${bg}"/>
  <path d="${heartPath}" fill="${fg}"/>
</svg>`;

const transparentIcon = (size, fg = TEAL) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="${heartPath}" fill="${fg}"/>
</svg>`;

async function write(name, svg, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`assets/${name}`);
  console.log("wrote", name);
}

await write("icon.png", squareIcon(1024), 1024);
await write("android-icon-foreground.png", transparentIcon(1024, "white"), 1024);
await write("android-icon-background.png", `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="${TEAL}"/></svg>`, 1024);
await write("android-icon-monochrome.png", transparentIcon(1024, "white"), 1024);
await write("favicon.png", squareIcon(48, { radius: 10 }), 48);
await write("splash-icon.png", transparentIcon(400, TEAL), 400);
