#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const reportPath = join(tmpdir(), `ratgame-vitest-${process.pid}.json`);
const vitestBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

try {
  rmSync(reportPath, { force: true });
} catch {
  // Best-effort cleanup only; a failed delete should not block test execution.
}

const result = spawnSync(
  vitestBin,
  [
    "run",
    ...process.argv.slice(2),
    "--reporter=json",
    `--outputFile=${reportPath}`,
    "--silent=passed-only",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
  },
);

if (!existsSync(reportPath)) {
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status ?? 1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const failedTests = [];
const totalFiles = report.testResults?.length ?? 0;

for (const fileResult of report.testResults ?? []) {
  for (const assertion of fileResult.assertionResults ?? []) {
    if (assertion.status !== "failed") {
      continue;
    }

    failedTests.push({
      file: fileResult.name,
      name: assertion.fullName || assertion.title,
      message: firstFailureLine(assertion.failureMessages),
    });
  }
}

if (failedTests.length === 0) {
  console.log(
    `All tests passed: ${report.numPassedTests}/${report.numTotalTests} tests in ${totalFiles} files.`,
  );
} else {
  const failedFiles = new Set(failedTests.map((test) => test.file)).size;
  console.log(
    `Failed: ${failedTests.length}/${report.numTotalTests} tests in ${failedFiles}/${totalFiles} files.`,
  );
  for (const test of failedTests) {
    console.log(`\n${test.file}`);
    console.log(`- ${test.name}`);
    if (test.message) {
      console.log(`  ${test.message}`);
    }
  }
}

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(result.status ?? (failedTests.length > 0 ? 1 : 0));

function firstFailureLine(messages) {
  return String(messages?.[0] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}
