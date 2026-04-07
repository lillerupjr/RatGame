export const SHADOW_SUN_V1_DAYLIGHT_START_HOUR = 7;
export const SHADOW_SUN_V1_SOLAR_NOON_HOUR = 13;
export const SHADOW_SUN_V1_DAYLIGHT_END_HOUR = 19;
export const SHADOW_SUN_V1_MAX_ELEVATION_DEG = 55;
export const SHADOW_SUN_V1_AMBIENT_MIN_ELEVATION_DEG = -18;
export const SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG = 1;
export const SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG = 89;
export const SHADOW_SUN_V1_MAX_PROJECTION_SCALE = 6;
export const SHADOW_SUN_V1_PROJECTION_Z_EPSILON = 1e-3;
export const DEFAULT_SHADOW_SUN_V1_TIME_HOUR = SHADOW_SUN_V1_SOLAR_NOON_HOUR;
export const DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG = SHADOW_SUN_V1_MAX_ELEVATION_DEG;

export const SHADOW_SUN_V1_HOUR_OPTIONS = [
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
] as const;

export type ShadowSunDirectionLabel = "NE" | "E" | "SE" | "S" | "SW";

export type ShadowSunV1Model = {
  timeHour: number;
  timeLabel: string;
  elevationDeg: number;
  directionLabel: ShadowSunDirectionLabel;
  forward: { x: number; y: number; z: number };
  projectionDirection: { x: number; y: number };
  castsShadows: boolean;
  stepKey: string;
};

export type AmbientSunLightingState = {
  ambientElevationDeg: number;
  ambientDarkness01: number;
};

export type ShadowSunElevationOverride = {
  sunElevationOverrideEnabled?: boolean;
  sunElevationOverrideDeg?: number;
  shadowSunAzimuthDeg?: number;
};

type Vec2 = { x: number; y: number };

const SEGMENT_HOURS = SHADOW_SUN_V1_SOLAR_NOON_HOUR - SHADOW_SUN_V1_DAYLIGHT_START_HOUR;
const DEG_TO_RAD = Math.PI / 180;
const AMBIENT_DAWN_DUSK_ELEVATION_DEG = 18.35399922132087;
const AMBIENT_NIGHT_PEAK_ELEVATION_DEG = 5.823683030314081;

const HORIZONTAL_NE: Vec2 = { x: 1, y: 0 };
const HORIZONTAL_SE: Vec2 = { x: 0, y: 1 };
const HORIZONTAL_SW: Vec2 = { x: -1, y: 0 };
const HORIZONTAL_E: Vec2 = normalize2({ x: 1, y: 1 });
const HORIZONTAL_S: Vec2 = normalize2({ x: -1, y: 1 });

const DIRECTION_LABEL_VECTORS: ReadonlyArray<{ label: ShadowSunDirectionLabel; vector: Vec2 }> = [
  { label: "NE", vector: HORIZONTAL_NE },
  { label: "E", vector: HORIZONTAL_E },
  { label: "SE", vector: HORIZONTAL_SE },
  { label: "S", vector: HORIZONTAL_S },
  { label: "SW", vector: HORIZONTAL_SW },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

function normalize2(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1e-6) return { x: 1, y: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function normalizeSegmentT(timeHour: number, startHour: number): number {
  return clamp((timeHour - startHour) / SEGMENT_HOURS, 0, 1);
}

function resolveHorizontalDirection(timeHour: number): Vec2 {
  if (timeHour <= SHADOW_SUN_V1_SOLAR_NOON_HOUR) {
    const t = normalizeSegmentT(timeHour, SHADOW_SUN_V1_DAYLIGHT_START_HOUR);
    return normalize2(lerp2(HORIZONTAL_NE, HORIZONTAL_SE, t));
  }
  const t = normalizeSegmentT(timeHour, SHADOW_SUN_V1_SOLAR_NOON_HOUR);
  return normalize2(lerp2(HORIZONTAL_SE, HORIZONTAL_SW, t));
}

function resolveElevationDeg(timeHour: number): number {
  if (timeHour <= SHADOW_SUN_V1_SOLAR_NOON_HOUR) {
    const t = normalizeSegmentT(timeHour, SHADOW_SUN_V1_DAYLIGHT_START_HOUR);
    return lerp(0, SHADOW_SUN_V1_MAX_ELEVATION_DEG, t);
  }
  const t = normalizeSegmentT(timeHour, SHADOW_SUN_V1_SOLAR_NOON_HOUR);
  return lerp(SHADOW_SUN_V1_MAX_ELEVATION_DEG, 0, t);
}

function formatElevationStepKey(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const asFixed = rounded.toFixed(2);
  return asFixed.endsWith(".00")
    ? asFixed.slice(0, -3)
    : asFixed.endsWith("0")
      ? asFixed.slice(0, -1)
      : asFixed;
}

function buildStepKey(
  timeHour: number,
  overrideEnabled: boolean,
  elevationDeg: number,
  azimuthDeg: number,
): string {
  return `sun-v1:t${formatShadowSunTimeLabel(timeHour)}${buildShadowSunV1StepKeySuffix({
    sunElevationOverrideEnabled: overrideEnabled,
    sunElevationResolvedDeg: elevationDeg,
    shadowSunAzimuthDeg: azimuthDeg,
  })}`;
}

function clampShadowSunAzimuthDeg(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return -1;
  if (numeric < 0) return -1;
  return Math.round(numeric) % 360;
}

function resolveDirectionLabel(horizontalDirection: Vec2): ShadowSunDirectionLabel {
  let bestLabel: ShadowSunDirectionLabel = "SE";
  let bestDot = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < DIRECTION_LABEL_VECTORS.length; i++) {
    const candidate = DIRECTION_LABEL_VECTORS[i];
    const alignment = dot2(horizontalDirection, candidate.vector);
    if (alignment > bestDot) {
      bestDot = alignment;
      bestLabel = candidate.label;
    }
  }
  return bestLabel;
}

function azimuthToDirection(azimuthDeg: number): Vec2 {
  const rad = azimuthDeg * DEG_TO_RAD;
  return normalize2({ x: Math.sin(rad), y: -Math.cos(rad) });
}

function buildProjectionDirection(forward: { x: number; y: number; z: number }): Vec2 {
  const zDenominator = Math.max(Math.abs(forward.z), SHADOW_SUN_V1_PROJECTION_Z_EPSILON);
  let projectionX = -forward.x / zDenominator;
  let projectionY = -forward.y / zDenominator;
  const projectionScale = Math.hypot(projectionX, projectionY);
  if (projectionScale > SHADOW_SUN_V1_MAX_PROJECTION_SCALE) {
    const scale = SHADOW_SUN_V1_MAX_PROJECTION_SCALE / projectionScale;
    projectionX *= scale;
    projectionY *= scale;
  }
  return { x: projectionX, y: projectionY };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - (2 * t));
}

function clampShadowSunClockTimeHour(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SHADOW_SUN_V1_TIME_HOUR;
  return clamp(numeric, 0, 24);
}

export function shadowSunCastsShadowsAtTime(timeHour: number): boolean {
  const clampedHour = clampShadowSunClockTimeHour(timeHour);
  return clampedHour > SHADOW_SUN_V1_DAYLIGHT_START_HOUR && clampedHour < SHADOW_SUN_V1_DAYLIGHT_END_HOUR;
}

export function clampShadowSunTimeHour(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SHADOW_SUN_V1_TIME_HOUR;
  return clamp(numeric, SHADOW_SUN_V1_DAYLIGHT_START_HOUR, SHADOW_SUN_V1_DAYLIGHT_END_HOUR);
}

export function resolveShadowSunAmbientElevationDeg(timeHour: number): number {
  const clampedHour = clampShadowSunClockTimeHour(timeHour);
  const normalizedHour = clampedHour >= 24 ? 0 : clampedHour;
  if (normalizedHour < 1) {
    return lerp(
      AMBIENT_DAWN_DUSK_ELEVATION_DEG,
      AMBIENT_NIGHT_PEAK_ELEVATION_DEG,
      smoothstep(19, 25, normalizedHour + 24),
    );
  }
  if (normalizedHour < SHADOW_SUN_V1_DAYLIGHT_START_HOUR) {
    return lerp(
      AMBIENT_NIGHT_PEAK_ELEVATION_DEG,
      AMBIENT_DAWN_DUSK_ELEVATION_DEG,
      smoothstep(1, SHADOW_SUN_V1_DAYLIGHT_START_HOUR, normalizedHour),
    );
  }
  if (normalizedHour <= SHADOW_SUN_V1_SOLAR_NOON_HOUR) {
    return lerp(
      AMBIENT_DAWN_DUSK_ELEVATION_DEG,
      SHADOW_SUN_V1_MAX_ELEVATION_DEG,
      smoothstep(SHADOW_SUN_V1_DAYLIGHT_START_HOUR, SHADOW_SUN_V1_SOLAR_NOON_HOUR, normalizedHour),
    );
  }
  if (normalizedHour <= SHADOW_SUN_V1_DAYLIGHT_END_HOUR) {
    return lerp(
      SHADOW_SUN_V1_MAX_ELEVATION_DEG,
      AMBIENT_DAWN_DUSK_ELEVATION_DEG,
      smoothstep(SHADOW_SUN_V1_SOLAR_NOON_HOUR, SHADOW_SUN_V1_DAYLIGHT_END_HOUR, normalizedHour),
    );
  }
  return lerp(
    AMBIENT_DAWN_DUSK_ELEVATION_DEG,
    AMBIENT_NIGHT_PEAK_ELEVATION_DEG,
    smoothstep(SHADOW_SUN_V1_DAYLIGHT_END_HOUR, 25, normalizedHour),
  );
}

export function resolveAmbientDarkness01FromElevationDeg(ambientElevationDeg: number): number {
  const elevation01 = clamp01(
    (ambientElevationDeg - SHADOW_SUN_V1_AMBIENT_MIN_ELEVATION_DEG)
    / (SHADOW_SUN_V1_MAX_ELEVATION_DEG - SHADOW_SUN_V1_AMBIENT_MIN_ELEVATION_DEG),
  );
  return 0 ;//- smoothstep(0, 1, elevation01);
}

export function clampShadowSunElevationOverrideDeg(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG;
  return clamp(
    numeric,
    SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG,
    SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG,
  );
}

export function formatShadowSunTimeLabel(timeHour: number): string {
  const clampedHour = clampShadowSunClockTimeHour(timeHour);
  const totalMinutes = Math.floor((clampedHour * 60) + 1e-6);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
}

export function buildShadowSunV1StepKeySuffix(input: {
  sunElevationOverrideEnabled?: boolean;
  sunElevationOverrideDeg?: number;
  sunElevationResolvedDeg?: number;
  shadowSunAzimuthDeg?: number;
}): string {
  const overrideEnabled = input.sunElevationOverrideEnabled === true;
  const azimuthDeg = clampShadowSunAzimuthDeg(input.shadowSunAzimuthDeg);
  const elevationDeg = overrideEnabled
    ? (
      Number.isFinite(input.sunElevationResolvedDeg)
        ? clampShadowSunElevationOverrideDeg(input.sunElevationResolvedDeg)
        : clampShadowSunElevationOverrideDeg(input.sunElevationOverrideDeg)
    )
    : null;
  return `${overrideEnabled && elevationDeg !== null ? `:e${formatElevationStepKey(elevationDeg)}` : ""}${azimuthDeg >= 0 ? `:a${azimuthDeg}` : ""}`;
}

export function getShadowSunV1Model(
  timeHour: number,
  elevationOverride?: ShadowSunElevationOverride,
): ShadowSunV1Model {
  const rawTimeHour = clampShadowSunClockTimeHour(timeHour);
  const normalizedHour = clampShadowSunTimeHour(rawTimeHour);
  const castsShadows = shadowSunCastsShadowsAtTime(rawTimeHour);
  const azimuthDeg = clampShadowSunAzimuthDeg(elevationOverride?.shadowSunAzimuthDeg);
  const horizontalDirection = azimuthDeg >= 0
    ? azimuthToDirection(azimuthDeg)
    : resolveHorizontalDirection(normalizedHour);
  const timeOfDayElevationDeg = castsShadows ? resolveElevationDeg(normalizedHour) : 0;
  const overrideEnabled = castsShadows && elevationOverride?.sunElevationOverrideEnabled === true;
  const elevationDeg = overrideEnabled
    ? clampShadowSunElevationOverrideDeg(elevationOverride?.sunElevationOverrideDeg)
    : timeOfDayElevationDeg;
  const forward = castsShadows
    ? (() => {
      const elevationRad = elevationDeg * DEG_TO_RAD;
      const horizontalScale = Math.cos(elevationRad);
      return {
        x: horizontalDirection.x * horizontalScale,
        y: horizontalDirection.y * horizontalScale,
        z: -Math.sin(elevationRad),
      };
    })()
    : { x: 0, y: 0, z: -1 };
  return {
    timeHour: normalizedHour,
    timeLabel: formatShadowSunTimeLabel(rawTimeHour),
    elevationDeg,
    directionLabel: resolveDirectionLabel(horizontalDirection),
    forward,
    projectionDirection: castsShadows ? buildProjectionDirection(forward) : { x: 0, y: 0 },
    castsShadows,
    stepKey: `${buildStepKey(rawTimeHour, overrideEnabled, elevationDeg, azimuthDeg)}${castsShadows ? "" : ":night"}`,
  };
}

export function getShadowSunV1LightingState(
  timeHour: number,
  elevationOverride?: ShadowSunElevationOverride,
): {
  sunModel: ShadowSunV1Model;
  ambientSunLighting: AmbientSunLightingState;
} {
  const sunModel = getShadowSunV1Model(timeHour, elevationOverride);
  const ambientElevationDeg = resolveShadowSunAmbientElevationDeg(timeHour);
  return {
    sunModel,
    ambientSunLighting: {
      ambientElevationDeg,
      ambientDarkness01: resolveAmbientDarkness01FromElevationDeg(ambientElevationDeg),
    },
  };
}
