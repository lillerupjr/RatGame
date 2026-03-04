export type ScalarPipelineInput = {
  base: number;
  flatAdds?: number[];
  flatSubs?: number[];
  increased?: number[];
  decreased?: number[];
  more?: number[];
  less?: number[];
  min?: number;
  rounding?: "none" | "floor" | "round" | "ceil";
};

function asFinite(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

function sum(values: number[] | undefined): number {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let out = 0;
  for (let i = 0; i < values.length; i++) out += asFinite(values[i], 0);
  return out;
}

function productMore(values: number[] | undefined): number {
  if (!Array.isArray(values) || values.length === 0) return 1;
  let out = 1;
  for (let i = 0; i < values.length; i++) out *= 1 + asFinite(values[i], 0);
  return out;
}

function productLess(values: number[] | undefined): number {
  if (!Array.isArray(values) || values.length === 0) return 1;
  let out = 1;
  for (let i = 0; i < values.length; i++) out *= Math.max(0, 1 - asFinite(values[i], 0));
  return out;
}

function applyRounding(v: number, mode: ScalarPipelineInput["rounding"]): number {
  switch (mode) {
    case "floor":
      return Math.floor(v);
    case "round":
      return Math.round(v);
    case "ceil":
      return Math.ceil(v);
    case "none":
    default:
      return v;
  }
}

export function resolveScalarPipeline(input: ScalarPipelineInput): number {
  const base = asFinite(input.base, 0);
  const flat = sum(input.flatAdds) - sum(input.flatSubs);
  const inc = sum(input.increased) - sum(input.decreased);
  const moreMul = productMore(input.more);
  const lessMul = productLess(input.less);
  const min = asFinite(input.min ?? 0, 0);
  const raw = base + flat;
  const increased = raw * (1 + inc);
  const final = increased * moreMul * lessMul;
  const rounded = applyRounding(final, input.rounding ?? "none");
  return Math.max(min, rounded);
}
