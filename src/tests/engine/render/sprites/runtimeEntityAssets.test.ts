import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function collectPngStats(rootDir: string): { pngCount: number; zeroBytePngs: string[] } {
  const zeroBytePngs: string[] = [];
  let pngCount = 0;
  const pending = [rootDir];

  while (pending.length > 0) {
    const dir = pending.pop();
    if (!dir) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) continue;
      pngCount += 1;
      if (statSync(fullPath).size === 0) {
        zeroBytePngs.push(relative(rootDir, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  zeroBytePngs.sort();
  return { pngCount, zeroBytePngs };
}

describe("runtime entity assets", () => {
  it("ships non-empty png files", () => {
    const entityRoot = fileURLToPath(
      new URL("../../../../../public/assets-runtime/entities", import.meta.url),
    );

    const { pngCount, zeroBytePngs } = collectPngStats(entityRoot);

    expect(pngCount).toBeGreaterThan(0);
    expect(
      zeroBytePngs,
      zeroBytePngs.length === 0
        ? undefined
        : `Zero-byte runtime entity pngs:\n${zeroBytePngs.join("\n")}`,
    ).toEqual([]);
  });
});
