import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const IN_ROOT = path.join(ROOT, "public", "assets-runtime");
const OUT_ROOT = path.join(ROOT, "public", "assets-runtime", "base_db32");

const DB32_PATH = path.join(ROOT, "tools", "palettes", "db32.json");

// Phase 0: normalize a conservative runtime subset used by current maps.
const SUBSET_DIRS = [
  "tiles/floor/decals",
  "tiles/floor/road",
  "tiles/animated",
  "tiles/walls",
  "tiles/stairs",
  "structures/buildings/avenue",
  "structures/buildings/china_town",
  "structures/containers",
  "props",
  "entities",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkPngFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".png")) out.push(full);
    }
  }
  return out;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function distSq(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function buildNearestMap(palette) {
  // Palette small (32), brute force per pixel is OK for Phase 0 subset.
  // Return palette array of {r,g,b}.
  return palette.map(hexToRgb);
}

function mapPixelToNearest(rgb, pal) {
  let bestI = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pal.length; i++) {
    const d = distSq(rgb, pal[i]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return pal[bestI];
}

function normalizePngToDb32(inFile, outFile, pal) {
  const buf = fs.readFileSync(inFile);
  const png = PNG.sync.read(buf);

  let pixelsMapped = 0;

  // RGBA byte array
  const data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // preserve fully transparent pixels
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const nn = mapPixelToNearest(rgb, pal);
    data[i] = nn.r;
    data[i + 1] = nn.g;
    data[i + 2] = nn.b;
    pixelsMapped++;
  }

  ensureDir(path.dirname(outFile));
  const outBuf = PNG.sync.write(png);
  fs.writeFileSync(outFile, outBuf);

  return pixelsMapped;
}

function relFromAssetsRuntime(absFile) {
  const rel = path.relative(IN_ROOT, absFile);
  return rel.replace(/\\/g, "/");
}

function countPngFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;
  return walkPngFiles(rootDir).length;
}

function reportCoverage() {
  const totalOut = countPngFiles(OUT_ROOT);
  console.log(`[assets:db32] Output PNGs total: ${totalOut}`);

  const checks = [
    {
      name: "decals",
      dir: path.join(OUT_ROOT, "tiles", "floor", "decals"),
    },
    {
      name: "avenue buildings",
      dir: path.join(OUT_ROOT, "structures", "buildings", "avenue"),
    },
    {
      name: "china_town buildings",
      dir: path.join(OUT_ROOT, "structures", "buildings", "china_town"),
    },
  ];

  for (const check of checks) {
    const hasPng = countPngFiles(check.dir) > 0;
    if (!hasPng) {
      console.warn(
        `[assets:db32] Coverage warning: ${check.name} missing or empty at ${path.relative(ROOT, check.dir)}`,
      );
    }
  }
}

function main() {
  if (!fs.existsSync(IN_ROOT)) {
    console.error(`[assets:db32] Missing input folder: ${IN_ROOT}`);
    process.exit(1);
  }
  const db32 = readJson(DB32_PATH);
  if (!db32?.colors || !Array.isArray(db32.colors) || db32.colors.length !== 32) {
    console.error("[assets:db32] tools/palettes/db32.json must contain 32 hex colors.");
    process.exit(1);
  }

  const pal = buildNearestMap(db32.colors);

  const t0 = performance.now();
  let files = 0;
  let pixels = 0;
  let failed = 0;

  ensureDir(OUT_ROOT);

  const inFiles = [];
  for (const sub of SUBSET_DIRS) {
    const dir = path.join(IN_ROOT, sub);
    if (!fs.existsSync(dir)) continue;
    inFiles.push(...walkPngFiles(dir));
  }

  for (const abs of inFiles) {
    const rel = relFromAssetsRuntime(abs); // e.g. tiles/floor/asphalt/1.png
    const outAbs = path.join(OUT_ROOT, rel);
    try {
      pixels += normalizePngToDb32(abs, outAbs, pal);
      files++;
    } catch (err) {
      failed++;
      console.warn(`[assets:db32] Skipped invalid PNG: ${rel}`);
      if (err instanceof Error) {
        console.warn(`[assets:db32] Reason: ${err.message}`);
      }
    }
  }

  const t1 = performance.now();
  const ms = Math.round(t1 - t0);

  console.log("[assets:db32] Output: public/assets-runtime/base_db32/...");
  console.log(`[assets:db32] Files processed: ${files}`);
  console.log(`[assets:db32] Files skipped: ${failed}`);
  console.log(`[assets:db32] Pixels mapped: ${pixels}`);
  console.log(`[assets:db32] Time: ${ms}ms`);
  reportCoverage();
}

main();
