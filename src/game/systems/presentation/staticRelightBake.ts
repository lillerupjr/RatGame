import type {
  StaticRelightDarknessBucket,
  StaticRelightLightCandidate,
} from "./staticRelightPoc";

export type StaticRelightPieceKind = "FLOOR_TOP" | "DECAL_TOP" | "STRUCTURE_SLICE";

export type StaticRelightBakeContextKeyInput = {
  mapId: string;
  relightEnabled: boolean;
  staticRelightEnabled?: boolean;
  paletteId: string;
  paletteVariantKey?: string;
  paletteSwapEnabled?: boolean;
  paletteGroup?: string;
  paletteSelectionId?: string;
  saturationWeightPercent: number;
  darknessPercent: number;
  baseDarknessBucket: StaticRelightDarknessBucket;
  staticRelightStrengthPercent: number;
  staticRelightTargetDarknessPercent: 0 | 25 | 50 | 75;
  lightColorModeOverride: string;
  lightStrengthOverride: string;
  lights: readonly StaticRelightLightCandidate[];
};

export type StaticRelightPieceKeyInput = {
  kind: StaticRelightPieceKind;
  parts: ReadonlyArray<string | number | boolean | null | undefined>;
};

export type StaticRelightBakeEntry<T> =
  | { kind: "BASE" }
  | { kind: "RELIT"; baked: T };

function q(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  const safeStep = Math.max(1e-6, Math.abs(step));
  return Math.round(value / safeStep) * safeStep;
}

function normalizePart(part: string | number | boolean | null | undefined): string {
  if (part == null) return "";
  if (typeof part === "number") {
    if (!Number.isFinite(part)) return "";
    return `${q(part, 0.001)}`;
  }
  if (typeof part === "boolean") return part ? "1" : "0";
  return `${part}`;
}

export function buildStaticRelightLightSignature(
  lights: readonly StaticRelightLightCandidate[],
): string {
  if (lights.length === 0) return "none";
  const normalized = lights.map((light) => [
    light.id,
    light.tileX,
    light.tileY,
    q(light.radiusPx, 0.5),
    q(light.yScale ?? 1, 0.01),
    q(light.intensity, 0.01),
  ].join(":"));
  normalized.sort();
  return normalized.join("|");
}

export function buildStaticRelightBakeContextKey(
  input: StaticRelightBakeContextKeyInput,
): string {
  return [
    `map:${input.mapId}`,
    `enabled:${input.relightEnabled ? 1 : 0}`,
    `relight:${input.staticRelightEnabled ? 1 : 0}`,
    `pal:${input.paletteId}`,
    `palv:${input.paletteVariantKey ?? ""}`,
    `swap:${input.paletteSwapEnabled ? 1 : 0}`,
    `palg:${input.paletteGroup ?? ""}`,
    `pals:${input.paletteSelectionId ?? ""}`,
    `sat:${q(input.saturationWeightPercent, 1)}`,
    `dark:${q(input.darknessPercent, 1)}`,
    `base:${input.baseDarknessBucket}`,
    `strength:${q(input.staticRelightStrengthPercent, 1)}`,
    `target:${input.staticRelightTargetDarknessPercent}`,
    `lcm:${input.lightColorModeOverride}`,
    `lsm:${input.lightStrengthOverride}`,
    `lights:${buildStaticRelightLightSignature(input.lights)}`,
  ].join("||");
}

export function buildStaticRelightPieceKey(
  input: StaticRelightPieceKeyInput,
): string {
  const parts = input.parts.map(normalizePart);
  return `${input.kind}::${parts.join("::")}`;
}

export class StaticRelightBakeStore<T> {
  private contextKey = "";
  private readonly entries = new Map<string, StaticRelightBakeEntry<T>>();

  clear(): void {
    this.entries.clear();
  }

  resetIfContextChanged(nextContextKey: string): boolean {
    if (nextContextKey === this.contextKey) return false;
    this.contextKey = nextContextKey;
    this.entries.clear();
    return true;
  }

  get(pieceKey: string): StaticRelightBakeEntry<T> | undefined {
    return this.entries.get(pieceKey);
  }

  set(pieceKey: string, entry: StaticRelightBakeEntry<T>): void {
    this.entries.set(pieceKey, entry);
  }

  getOrBake(
    pieceKey: string,
    baker: () => StaticRelightBakeEntry<T> | null,
  ): StaticRelightBakeEntry<T> | null {
    const cached = this.entries.get(pieceKey);
    if (cached) return cached;
    const baked = baker();
    if (!baked) return null;
    this.entries.set(pieceKey, baked);
    return baked;
  }
}
