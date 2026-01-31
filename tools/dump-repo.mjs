#!/usr/bin/env node
/**
 * Dump "relevant" repo files into one .txt for ChatGPT / review.
 *
 * Usage:
 *   node tools/dump-repo.mjs
 *   node tools/dump-repo.mjs --out repo_dump.txt
 *   node tools/dump-repo.mjs --root . --out repo_dump.txt
 *
 * Optional:
 *   --include-ext .ts,.js,.json,.md,.html,.css,.txt
 *   --max-bytes 500000
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
    const args = {
        root: process.cwd(),
        out: "repo_dump.txt",
        includeExt: [".ts", ".js", ".json", ".md", ".html", ".css", ".txt"],
        maxBytes: 750_000, // skip huge files by default
    };

    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--root") args.root = argv[++i] ?? args.root;
        else if (a === "--out") args.out = argv[++i] ?? args.out;
        else if (a === "--include-ext") {
            const v = argv[++i] ?? "";
            args.includeExt = v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (s.startsWith(".") ? s.toLowerCase() : `.${s.toLowerCase()}`));
        } else if (a === "--max-bytes") {
            const v = Number(argv[++i]);
            if (!Number.isNaN(v) && v > 0) args.maxBytes = v;
        } else if (a === "-h" || a === "--help") {
            console.log(`repo dump tool

Options:
  --root <dir>           Root directory to dump (default cwd)
  --out <file>           Output file (default repo_dump.txt)
  --include-ext <list>   Comma-separated extensions (default .ts,.js,.json,.md,.html,.css,.txt)
  --max-bytes <n>        Skip files larger than n bytes (default 750000)

Example:
  node tools/dump-repo.mjs --out RatGame_dump.txt
`);
            process.exit(0);
        }
    }
    return args;
}

const SKIP_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    ".cache",
    ".git",
    ".idea",
    ".vscode",
    "coverage",
    ".turbo",
    ".next",
]);

const SKIP_FILES = new Set([
    "package-lock.json", // include if you want, but usually noisy
    "pnpm-lock.yaml",
    "yarn.lock",
]);

const HEADER = "=".repeat(80);

function isBinaryLikeExt(ext) {
    return [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".mp3",
        ".wav",
        ".ogg",
        ".mp4",
        ".zip",
        ".bin",
        ".ttf",
        ".otf",
        ".woff",
        ".woff2",
    ].includes(ext);
}

function shouldSkipPath(relParts) {
    // skip any path segment matching skip dirs
    for (const p of relParts) {
        if (SKIP_DIRS.has(p)) return true;
    }
    return false;
}

async function walk(dirAbs, rootAbs, filesOut) {
    const entries = await fs.promises.readdir(dirAbs, { withFileTypes: true });
    for (const ent of entries) {
        const abs = path.join(dirAbs, ent.name);
        const rel = path.relative(rootAbs, abs);

        // Normalize to forward slashes for stable dumps
        const relNorm = rel.split(path.sep).join("/");

        const parts = rel.split(path.sep);
        if (shouldSkipPath(parts)) continue;

        if (ent.isDirectory()) {
            await walk(abs, rootAbs, filesOut);
            continue;
        }
        if (!ent.isFile()) continue;

        if (SKIP_FILES.has(ent.name)) continue;

        const ext = path.extname(ent.name).toLowerCase();
        if (isBinaryLikeExt(ext)) continue;

        filesOut.push({ abs, rel: relNorm, ext });
    }
}

function withinIncludedExt(ext, includeExt) {
    return includeExt.includes(ext);
}

async function main() {
    const args = parseArgs(process.argv);

    const rootAbs = path.resolve(args.root);
    const outAbs = path.resolve(rootAbs, args.out);

    const files = [];
    await walk(rootAbs, rootAbs, files);

    const selected = files
        .filter((f) => withinIncludedExt(f.ext, args.includeExt))
        .sort((a, b) => a.rel.localeCompare(b.rel));

    const out = fs.createWriteStream(outAbs, { encoding: "utf-8" });

    out.write(`REPO DUMP\n`);
    out.write(`Root: ${rootAbs}\n`);
    out.write(`Generated: ${new Date().toISOString()}\n`);
    out.write(`Included extensions: ${args.includeExt.join(",")}\n`);
    out.write(`Skipped dirs: ${Array.from(SKIP_DIRS).join(",")}\n`);
    out.write(`Max file size: ${args.maxBytes} bytes\n\n`);

    let count = 0;
    let skippedLarge = 0;

    for (const f of selected) {
        let st;
        try {
            st = await fs.promises.stat(f.abs);
        } catch {
            continue;
        }
        if (st.size > args.maxBytes) {
            skippedLarge++;
            continue;
        }

        let content = "";
        try {
            content = await fs.promises.readFile(f.abs, "utf-8");
        } catch (e) {
            content = `<<Could not read file as utf-8: ${String(e)}>>`;
        }

        out.write(`\n${HEADER}\n`);
        out.write(`FILE: ${f.rel}\n`);
        out.write(`${HEADER}\n\n`);
        out.write(content);
        out.write("\n");

        count++;
    }

    out.end();

    // nice summary
    console.log(`✅ Wrote ${count} files to: ${path.relative(process.cwd(), outAbs)}`);
    if (skippedLarge > 0) console.log(`ℹ️ Skipped ${skippedLarge} file(s) larger than ${args.maxBytes} bytes`);
}

main().catch((e) => {
    console.error("❌ dump-repo failed:", e);
    process.exit(1);
});
