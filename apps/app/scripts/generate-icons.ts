/**
 * Regenerate the mobile app's brand PNGs from the SVG sources in apps/app/brand/.
 *
 * Run from apps/app:
 *   npm run generate-icons
 * or:
 *   npx tsx scripts/generate-icons.ts
 *
 * Outputs (overwrites existing):
 *   assets/icon.png           1024x1024  iOS/Android launcher icon (yellow bg + rounded corners baked in)
 *   assets/adaptive-icon.png  1024x1024  Android adaptive foreground (transparent bg; Android draws its own bg)
 *   assets/splash-icon.png    1024x1024  Splash mark (transparent bg; splash screen bg is in app.json)
 *   assets/favicon.png        64x64      Expo web favicon (yellow bg)
 */
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const APP_DIR = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(APP_DIR, "brand");
const OUT_DIR = path.join(APP_DIR, "assets");

const SOURCES = {
  iosIcon: "quizzer-app-icon-ios.svg",
  markYellow: "quizzer-mark-yellow.svg",
  favicon: "quizzer-favicon-32.svg",
} as const;

/**
 * Remove the full-bleed yellow background `<rect>` from an SVG so the remaining
 * `<g>` mark renders on a transparent canvas. Only strips rects whose fill is
 * exactly `#FFD400` and that cover the full viewBox — keeps rounded-corner
 * background rects (which also have `rx`/`ry`) intact.
 */
function stripYellowBackground(svg: string): string {
  return svg.replace(
    /<rect\b(?![^>]*\brx=)[^>]*\bfill\s*=\s*["']#FFD400["'][^>]*\/>/gi,
    "",
  );
}

async function renderSvgToPng(
  svg: string,
  size: number,
  outFile: string,
): Promise<void> {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
}

async function readSvg(name: string): Promise<string> {
  return fs.readFile(path.join(BRAND_DIR, name), "utf8");
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [iosIconSvg, markYellowSvg, faviconSvg] = await Promise.all([
    readSvg(SOURCES.iosIcon),
    readSvg(SOURCES.markYellow),
    readSvg(SOURCES.favicon),
  ]);

  const markTransparentSvg = stripYellowBackground(markYellowSvg);

  const outputs: Array<[string, Promise<void>]> = [
    ["icon.png", renderSvgToPng(iosIconSvg, 1024, path.join(OUT_DIR, "icon.png"))],
    [
      "adaptive-icon.png",
      renderSvgToPng(markTransparentSvg, 1024, path.join(OUT_DIR, "adaptive-icon.png")),
    ],
    [
      "splash-icon.png",
      renderSvgToPng(markTransparentSvg, 1024, path.join(OUT_DIR, "splash-icon.png")),
    ],
    ["favicon.png", renderSvgToPng(faviconSvg, 64, path.join(OUT_DIR, "favicon.png"))],
  ];

  for (const [name, task] of outputs) {
    await task;
    const { size } = await fs.stat(path.join(OUT_DIR, name));
    console.log(`  ✓ ${name.padEnd(20)} ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error("generate-icons failed:", err);
  process.exit(1);
});
