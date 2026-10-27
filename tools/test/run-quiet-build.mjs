#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const MAX_FAILURE_LINES = 40;
const viteBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);

const started = performance.now();
const result = spawnSync(viteBin, ["build", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const elapsed = ((performance.now() - started) / 1000).toFixed(1);

if ((result.status ?? 1) === 0) {
  console.log(`Build passed in ${elapsed}s.`);
  process.exit(0);
}

const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`
  .split("\n")
  .map((line) => line.trimEnd())
  .filter(Boolean);

console.log(`Build failed in ${elapsed}s.`);
for (const line of lines.slice(-MAX_FAILURE_LINES)) {
  console.log(line);
}
if (lines.length > MAX_FAILURE_LINES) {
  console.log(`...showing last ${MAX_FAILURE_LINES} of ${lines.length} lines.`);
}

process.exit(result.status ?? 1);
