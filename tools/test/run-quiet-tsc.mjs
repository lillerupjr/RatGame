#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const MAX_ERRORS = 20;
const tscBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
);

const result = spawnSync(tscBin, ["--noEmit", "--pretty", "false", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const diagnostics = output
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /error TS\d+:/.test(line));

if ((result.status ?? 1) === 0) {
  console.log("Typecheck passed.");
  process.exit(0);
}

if (diagnostics.length === 0) {
  console.log("Typecheck failed.");
  printCapped(output);
  process.exit(result.status ?? 1);
}

const files = new Set(
  diagnostics
    .map((line) => line.match(/^(.+?)\(\d+,\d+\): error TS\d+:/)?.[1])
    .filter(Boolean),
);

console.log(`Typecheck failed: ${diagnostics.length} errors across ${files.size} files.`);
for (const line of diagnostics.slice(0, MAX_ERRORS)) {
  console.log(line);
}
if (diagnostics.length > MAX_ERRORS) {
  console.log(`...and ${diagnostics.length - MAX_ERRORS} more errors.`);
}

process.exit(result.status ?? 1);

function printCapped(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  for (const line of lines.slice(0, MAX_ERRORS)) {
    console.log(line);
  }
  if (lines.length > MAX_ERRORS) {
    console.log(`...and ${lines.length - MAX_ERRORS} more lines.`);
  }
}
