export const SHADOW_SUN_V1_DAYLIGHT_START_HOUR = 7;
export const SHADOW_SUN_V1_SOLAR_NOON_HOUR = 13;
export const SHADOW_SUN_V1_DAYLIGHT_END_HOUR = 19;
export const SHADOW_SUN_V1_MAX_ELEVATION_DEG = 55;
export const SHADOW_SUN_V1_MAX_PROJECTION_SCALE = 6;
export const SHADOW_SUN_V1_PROJECTION_Z_EPSILON = 1e-3;
export const DEFAULT_SHADOW_SUN_V1_TIME_HOUR = SHADOW_SUN_V1_SOLAR_NOON_HOUR;

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
  stepKey: string;
};

type Vec2 = { x: number; y: number };

const SEGMENT_HOURS = SHADOW_SUN_V1_SOLAR_NOON_HOUR - SHADOW_SUN_V1_DAYLIGHT_START_HOUR;
const DEG_TO_RAD = Math.PI / 180;

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

export function clampShadowSunTimeHour(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SHADOW_SUN_V1_TIME_HOUR;
  return clamp(
    Math.round(numeric),
    SHADOW_SUN_V1_DAYLIGHT_START_HOUR,
    SHADOW_SUN_V1_DAYLIGHT_END_HOUR,
  );
}

export function formatShadowSunTimeLabel(timeHour: number): string {
  const hour = clampShadowSunTimeHour(timeHour);
  return `${`${hour}`.padStart(2, "0")}:00`;
}

export function getShadowSunV1Model(timeHour: number): ShadowSunV1Model {
  const normalizedHour = clampShadowSunTimeHour(timeHour);
  const horizontalDirection = resolveHorizontalDirection(normalizedHour);
  const elevationDeg = resolveElevationDeg(normalizedHour);
  const elevationRad = elevationDeg * DEG_TO_RAD;
  const horizontalScale = Math.cos(elevationRad);
  const forward = {
    x: horizontalDirection.x * horizontalScale,
    y: horizontalDirection.y * horizontalScale,
    z: -Math.sin(elevationRad),
  };
  return {
    timeHour: normalizedHour,
    timeLabel: formatShadowSunTimeLabel(normalizedHour),
    elevationDeg,
    directionLabel: resolveDirectionLabel(horizontalDirection),
    forward,
    projectionDirection: buildProjectionDirection(forward),
    stepKey: `sun-v1:h${normalizedHour}`,
  };
}
