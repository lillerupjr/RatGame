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
  "structures/buildings/downtown",
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

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp255(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, v));
}

function normalizeHueDegrees(h) {
  if (!Number.isFinite(h)) return 0;
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function hueDistanceDegrees(a, b) {
  const ah = normalizeHueDegrees(a);
  const bh = normalizeHueDegrees(b);
  const d = Math.abs(ah - bh);
  return Math.min(d, 360 - d);
}

function rgbToHsv(rgb) {
  const r = clamp255(rgb.r) / 255;
  const g = clamp255(rgb.g) / 255;
  const b = clamp255(rgb.b) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  const s = max === 0 ? 0 : delta / max;
  return {
    h: normalizeHueDegrees(h),
    s,
    v: max,
  };
}

function hsvToRgb(hsv) {
  const h = normalizeHueDegrees(hsv.h);
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = v - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function buildDb32HueAnchors(palette) {
  return palette.map((hex) => rgbToHsv(hexToRgb(hex)).h);
}

function pickNearestHueAnchor(sourceHue, anchors) {
  if (anchors.length === 0) return sourceHue;
  let nearest = anchors[0];
  let nearestDist = hueDistanceDegrees(sourceHue, nearest);
  for (let i = 1; i < anchors.length; i++) {
    const candidate = anchors[i];
    const dist = hueDistanceDegrees(sourceHue, candidate);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }
  return nearest;
}

function normalizePngToDb32(inFile, outFile, hueAnchors) {
  const buf = fs.readFileSync(inFile);
  const png = PNG.sync.read(buf);

  let pixelsMapped = 0;

  // RGBA byte array
  const data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // preserve fully transparent pixels
    const hsv = rgbToHsv({ r: data[i], g: data[i + 1], b: data[i + 2] });
    const nearestHue = pickNearestHueAnchor(hsv.h, hueAnchors);
    const rgb = hsvToRgb({
      h: nearestHue,
      s: hsv.s,
      v: hsv.v,
    });
    data[i] = rgb.r;
    data[i + 1] = rgb.g;
    data[i + 2] = rgb.b;
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
    {
      name: "downtown buildings",
      dir: path.join(OUT_ROOT, "structures", "buildings", "downtown"),
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

  const hueAnchors = buildDb32HueAnchors(db32.colors);

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
      pixels += normalizePngToDb32(abs, outAbs, hueAnchors);
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
