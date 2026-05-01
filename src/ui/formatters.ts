/** Format a stat modifier as a human-readable string. */
export function describeStatMod(mod: { key: string; op: string; value: number }): string {
  const value = Number.isFinite(mod.value) ? mod.value : 0;
  if (mod.op === "more" || mod.op === "increased" || mod.op === "less" || mod.op === "decreased") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${Math.round(value * 100)}% ${mod.op} ${mod.key}`;
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} ${mod.key}`;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
