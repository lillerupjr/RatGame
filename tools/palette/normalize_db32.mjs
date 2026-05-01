import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PNG } from "pngjs";

const DB32_TRANSFORM_MODE = "hsv-hue-lock";

const ROOT = process.cwd();
const IN_ROOT = path.join(ROOT, "public", "assets-runtime");
const OUT_ROOT = path.join(ROOT, "public", "assets-runtime", "base_db32");

const DB32_PATH = path.join(ROOT, "tools", "palettes", "db32.json");

// Phase 0: normalize a conservative runtime subset used by current maps.
const SUBSET_DIRS = [
  "tiles/floor/decals",
  "tiles/floor/asphalt",
  "tiles/floor/park",
  "tiles/floor/sidewalk",
  "tiles/animated",
  "tiles/walls",
  "tiles/stairs",
  "structures/buildings/avenue",
  "structures/buildings/downtown",
  "structures/buildings/china_town",
  "structures/buildings/batch_processed",
  "structures/buildings/batch1",
  "structures/buildings/batch4",
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

function normalizeRelPath(rel) {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "");
}

function distSq(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
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
  const v = max;
  return { h: normalizeHueDegrees(h), s, v };
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

function buildPaletteEntries(palette) {
  // Palette small (32), brute force per pixel is fine for the runtime bake subset.
  return palette.map((hex) => {
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb);
    return { hex: hex.toLowerCase(), ...rgb, h: hsv.h, s: hsv.s, v: hsv.v };
  });
}

function mapPixelToNearestRgb(rgb, pal) {
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

function pickNearestPaletteHsvAnchor(sourceHue, palette) {
  let nearest = palette[0];
  let nearestDist = hueDistanceDegrees(sourceHue, nearest.h);
  for (let i = 1; i < palette.length; i++) {
    const candidate = palette[i];
    const candidateDist = hueDistanceDegrees(sourceHue, candidate.h);
    if (candidateDist < nearestDist) {
      nearest = candidate;
      nearestDist = candidateDist;
    }
  }
  return nearest;
}

function mapPixelByHsvHueLock(rgb, palette) {
  const hsv = rgbToHsv(rgb);
  const nearest = pickNearestPaletteHsvAnchor(hsv.h, palette);
  return {
    ...hsvToRgb({
      h: nearest.h,
      s: hsv.s,
      v: hsv.v,
    }),
    hex: nearest.hex,
  };
}

function mapPixelToDb32(rgb, palette) {
  if (DB32_TRANSFORM_MODE === "hsv-hue-lock") {
    return mapPixelByHsvHueLock(rgb, palette);
  }
  return mapPixelToNearestRgb(rgb, palette);
}

function addCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rgbaKey(r, g, b, a) {
  return `${r},${g},${b},${a}`;
}

function summarizeTopCounts(map, limit = 8) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function parseInspectFilter() {
  const debugTargets = new Set();
  const addTargets = (raw) => {
    if (!raw) return;
    for (const token of raw.split(",")) {
      const trimmed = normalizeRelPath(token.trim());
      if (trimmed) debugTargets.add(trimmed);
    }
  };

  addTargets(process.env.DB32_DEBUG_ASSETS ?? "");
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--inspect=")) {
      addTargets(arg.slice("--inspect=".length));
    }
  }
  return debugTargets;
}

function normalizePngToDb32(inFile, outFile, pal, options = {}) {
  const buf = fs.readFileSync(inFile);
  const png = PNG.sync.read(buf);

  let pixelsMapped = 0;
  let changedPixels = 0;
  const inspect = options.inspect === true;
  const sourceColorCounts = inspect ? new Map() : null;
  const transformedColorCounts = inspect ? new Map() : null;
  const paletteUsage = inspect ? new Map() : null;
  const remapCounts = inspect ? new Map() : null;

  // RGBA byte array
  const data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // preserve fully transparent pixels

    const before = { r: data[i], g: data[i + 1], b: data[i + 2], a };
    const nearest = mapPixelToDb32(before, pal);
    if (inspect) {
      addCount(sourceColorCounts, rgbaKey(before.r, before.g, before.b, before.a));
      addCount(paletteUsage, nearest.hex);
    }

    data[i] = nearest.r;
    data[i + 1] = nearest.g;
    data[i + 2] = nearest.b;

    if (inspect) {
      addCount(transformedColorCounts, rgbaKey(nearest.r, nearest.g, nearest.b, before.a));
      addCount(
        remapCounts,
        `${rgbaKey(before.r, before.g, before.b, before.a)}->${rgbaKey(nearest.r, nearest.g, nearest.b, before.a)}(${nearest.hex})`,
      );
    }
    if (before.r !== nearest.r || before.g !== nearest.g || before.b !== nearest.b) {
      changedPixels++;
    }
    pixelsMapped++;
  }

  ensureDir(path.dirname(outFile));
  const outBuf = PNG.sync.write(png);
  fs.writeFileSync(outFile, outBuf);

  return inspect
    ? {
        pixelsMapped,
        changedPixels,
        sourceUniqueColors: sourceColorCounts.size,
        transformedUniqueColors: transformedColorCounts.size,
        topSourceColors: summarizeTopCounts(sourceColorCounts),
        topTransformedColors: summarizeTopCounts(transformedColorCounts),
        topRemaps: summarizeTopCounts(remapCounts),
        paletteUsage: summarizeTopCounts(paletteUsage),
        transformBranch: DB32_TRANSFORM_MODE === "hsv-hue-lock" ? "hsv-hue-lock-db32" : "nearest-db32-rgb",
      }
    : { pixelsMapped, changedPixels };
}

function relFromAssetsRuntime(absFile) {
  const rel = path.relative(IN_ROOT, absFile);
  return rel.replace(/\\/g, "/");
}

function getOutputRelativePaths(rel) {
  const batchMatch = rel.match(
    /^structures\/buildings\/batch_processed\/([^/]+)\/images\/(n|e|s|w|ne|nw|se|sw)\.png$/i,
  );
  if (!batchMatch) return [rel];

  const [, buildingId, dir] = batchMatch;
  const normalizedDir = dir.toLowerCase();
  const outputs = [`structures/buildings/batch_processed/${buildingId}/${normalizedDir}.png`];
  if (normalizedDir === "s") {
    outputs.unshift(`structures/buildings/batch_processed/${buildingId}.png`);
  }
  return outputs;
}

function countPngFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;
  return walkPngFiles(rootDir).length;
}

function logInspectSummary(summary) {
  console.log(`[assets:db32][inspect] ${summary.rel}`);
  console.log(
    JSON.stringify(
      {
        sourceSubsetDir: summary.sourceSubsetDir,
        sourceFile: summary.sourceFile,
        outputFiles: summary.outputFiles,
        transformBranch: summary.transformBranch,
        nonTransparentPixels: summary.nonTransparentPixels,
        changedPixels: summary.changedPixels,
        changedPixelPercent: summary.changedPixelPercent,
        sourceUniqueColors: summary.sourceUniqueColors,
        transformedUniqueColors: summary.transformedUniqueColors,
        topSourceColors: summary.topSourceColors,
        topTransformedColors: summary.topTransformedColors,
        paletteUsage: summary.paletteUsage,
        topRemaps: summary.topRemaps,
      },
      null,
      2,
    ),
  );
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
      name: "asphalt floors",
      dir: path.join(OUT_ROOT, "tiles", "floor", "asphalt"),
    },
    {
      name: "park floors",
      dir: path.join(OUT_ROOT, "tiles", "floor", "park"),
    },
    {
      name: "sidewalk floors",
      dir: path.join(OUT_ROOT, "tiles", "floor", "sidewalk"),
    },
    {
      name: "walls",
      dir: path.join(OUT_ROOT, "tiles", "walls"),
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

  const pal = buildPaletteEntries(db32.colors);
  const inspectTargets = parseInspectFilter();

  const t0 = performance.now();
  let files = 0;
  let pixels = 0;
  let failed = 0;

  ensureDir(OUT_ROOT);

  const inFiles = [];
  const missingSubsetDirs = [];
  for (const sub of SUBSET_DIRS) {
    const dir = path.join(IN_ROOT, sub);
    if (!fs.existsSync(dir)) {
      missingSubsetDirs.push(sub);
      continue;
    }
    inFiles.push(...walkPngFiles(dir));
  }
  if (missingSubsetDirs.length > 0) {
    console.warn(
      `[assets:db32] Missing configured input dirs: ${missingSubsetDirs.map((sub) => normalizeRelPath(sub)).join(", ")}`,
    );
  }

  for (const abs of inFiles) {
    const rel = relFromAssetsRuntime(abs); // e.g. tiles/floor/asphalt/1.png
    const outRels = getOutputRelativePaths(rel);
    const sourceSubsetDir = SUBSET_DIRS.find((sub) => rel === sub || rel.startsWith(`${sub}/`)) ?? "(unmatched)";
    try {
      let inspectSummary = null;
      for (const outRel of outRels) {
        const outAbs = path.join(OUT_ROOT, outRel);
        const normalizeResult = normalizePngToDb32(abs, outAbs, pal, {
          inspect: inspectTargets.has(rel),
        });
        pixels += normalizeResult.pixelsMapped;
        if (normalizeResult.transformBranch) {
          inspectSummary = {
            rel,
            sourceSubsetDir,
            sourceFile: path.relative(ROOT, abs),
            outputFiles: outRels.map((candidate) => path.join("public", "assets-runtime", "base_db32", candidate)),
            nonTransparentPixels: normalizeResult.pixelsMapped,
            changedPixels: normalizeResult.changedPixels,
            changedPixelPercent: normalizeResult.pixelsMapped === 0
              ? "0.00"
              : ((normalizeResult.changedPixels / normalizeResult.pixelsMapped) * 100).toFixed(2),
            sourceUniqueColors: normalizeResult.sourceUniqueColors,
            transformedUniqueColors: normalizeResult.transformedUniqueColors,
            topSourceColors: normalizeResult.topSourceColors,
            topTransformedColors: normalizeResult.topTransformedColors,
            paletteUsage: normalizeResult.paletteUsage,
            topRemaps: normalizeResult.topRemaps,
            transformBranch: normalizeResult.transformBranch,
          };
        }
        files++;
      }
      if (inspectSummary) logInspectSummary(inspectSummary);
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
  console.log(`[assets:db32] Transform mode: ${DB32_TRANSFORM_MODE}`);
  console.log(`[assets:db32] Files processed: ${files}`);
  console.log(`[assets:db32] Files skipped: ${failed}`);
  console.log(`[assets:db32] Pixels mapped: ${pixels}`);
  console.log(`[assets:db32] Time: ${ms}ms`);
  reportCoverage();
}

main();
