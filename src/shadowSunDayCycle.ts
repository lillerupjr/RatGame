import {
  SHADOW_SUN_V1_DAYLIGHT_END_HOUR,
  SHADOW_SUN_V1_DAYLIGHT_START_HOUR,
  clampShadowSunTimeHour,
} from "./shadowSunV1";

export const SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS = [
  1,
  2,
  4,
  8,
  16,
  32,
  64,
] as const;

export type ShadowSunDayCycleSpeedMultiplier =
  (typeof SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS)[number];

export const SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS = [
  96,
  144,
  288,
] as const;

export type ShadowSunDayCycleStepsPerDay =
  (typeof SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS)[number];

export const SHADOW_SUN_CYCLE_MODE_OPTIONS = [
  "full24h",
  "dayOnly",
] as const;

export type ShadowSunCycleMode = (typeof SHADOW_SUN_CYCLE_MODE_OPTIONS)[number];

export const DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER: ShadowSunDayCycleSpeedMultiplier = 1;
export const DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY: ShadowSunDayCycleStepsPerDay = 96;
export const DEFAULT_SHADOW_SUN_CYCLE_MODE: ShadowSunCycleMode = "full24h";
export const SHADOW_SUN_DAY_CYCLE_BASE_RATE_INGAME_MINUTES_PER_REAL_SECOND = 1;
export const SHADOW_SUN_DAY_CYCLE_BASE_RATE_LABEL = "1s=1m";
export const SHADOW_SUN_DAY_CYCLE_FULL_DAY_START_MINUTE = 0;
export const SHADOW_SUN_DAY_CYCLE_FULL_DAY_END_MINUTE = 24 * 60;
export const SHADOW_SUN_DAY_CYCLE_FULL_DAY_WINDOW_MINUTES =
  SHADOW_SUN_DAY_CYCLE_FULL_DAY_END_MINUTE - SHADOW_SUN_DAY_CYCLE_FULL_DAY_START_MINUTE;
export const SHADOW_SUN_DAY_CYCLE_DAYLIGHT_START_MINUTE = SHADOW_SUN_V1_DAYLIGHT_START_HOUR * 60;
export const SHADOW_SUN_DAY_CYCLE_DAYLIGHT_END_MINUTE = SHADOW_SUN_V1_DAYLIGHT_END_HOUR * 60;
export const SHADOW_SUN_DAY_CYCLE_DAYLIGHT_WINDOW_MINUTES =
  SHADOW_SUN_DAY_CYCLE_DAYLIGHT_END_MINUTE - SHADOW_SUN_DAY_CYCLE_DAYLIGHT_START_MINUTE;

type ShadowSunCycleRange = {
  startMinute: number;
  endMinute: number;
  windowMinutes: number;
};

export function clampShadowSunDayCycleStepsPerDay(value: unknown): ShadowSunDayCycleStepsPerDay {
  const numeric = Number(value);
  for (let i = 0; i < SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS.length; i++) {
    const stepsPerDay = SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS[i];
    if (numeric === stepsPerDay) return stepsPerDay;
  }
  return DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY;
}

export function clampShadowSunDayCycleSpeedMultiplier(value: unknown): ShadowSunDayCycleSpeedMultiplier {
  const numeric = Number(value);
  for (let i = 0; i < SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS.length; i++) {
    const multiplier = SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS[i];
    if (numeric === multiplier) return multiplier;
  }
  return DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER;
}

export function clampShadowSunCycleMode(value: unknown): ShadowSunCycleMode {
  if (value === "dayOnly") return "dayOnly";
  return DEFAULT_SHADOW_SUN_CYCLE_MODE;
}

export function formatShadowSunDayCycleSpeedLabel(multiplier: number): string {
  return `${clampShadowSunDayCycleSpeedMultiplier(multiplier)}x`;
}

export function formatShadowSunDayCycleStepsPerDayLabel(stepsPerDay: number): string {
  return `${clampShadowSunDayCycleStepsPerDay(stepsPerDay)}`;
}

export function formatShadowSunCycleModeLabel(cycleMode: ShadowSunCycleMode): string {
  return cycleMode === "dayOnly" ? "Day only" : "Full 24H";
}

export function getShadowSunCycleRange(cycleMode: ShadowSunCycleMode): ShadowSunCycleRange {
  if (clampShadowSunCycleMode(cycleMode) === "dayOnly") {
    return {
      startMinute: SHADOW_SUN_DAY_CYCLE_DAYLIGHT_START_MINUTE,
      endMinute: SHADOW_SUN_DAY_CYCLE_DAYLIGHT_END_MINUTE,
      windowMinutes: SHADOW_SUN_DAY_CYCLE_DAYLIGHT_WINDOW_MINUTES,
    };
  }
  return {
    startMinute: SHADOW_SUN_DAY_CYCLE_FULL_DAY_START_MINUTE,
    endMinute: SHADOW_SUN_DAY_CYCLE_FULL_DAY_END_MINUTE,
    windowMinutes: SHADOW_SUN_DAY_CYCLE_FULL_DAY_WINDOW_MINUTES,
  };
}

export function shadowSunHourToDayCycleMinuteCursor(
  timeHour: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const numeric = Number(timeHour);
  const normalizedHour = clampShadowSunCycleMode(cycleMode) === "dayOnly"
    ? clampShadowSunTimeHour(numeric)
    : Math.max(0, Math.min(24, Number.isFinite(numeric) ? numeric : SHADOW_SUN_V1_DAYLIGHT_START_HOUR));
  return clampShadowSunDayCycleMinuteCursor(normalizedHour * 60, cycleMode);
}

export function clampShadowSunDayCycleMinuteCursor(
  value: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const range = getShadowSunCycleRange(cycleMode);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return range.startMinute;
  return Math.max(range.startMinute, Math.min(range.endMinute, numeric));
}

export function dayCycleMinuteCursorToShadowSunTimeHour(
  minuteCursor: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  return clampShadowSunDayCycleMinuteCursor(minuteCursor, cycleMode) / 60;
}

export function advanceShadowSunDayCycleMinuteCursor(
  minuteCursor: number,
  deltaInGameMinutes: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const range = getShadowSunCycleRange(cycleMode);
  const current = clampShadowSunDayCycleMinuteCursor(minuteCursor, cycleMode);
  const delta = Math.max(0, Number.isFinite(deltaInGameMinutes) ? deltaInGameMinutes : 0);
  if (delta <= 0) return current;

  const advanced = current + delta;
  if (advanced < range.endMinute) return advanced;

  const wrappedOffset = (advanced - range.startMinute) % range.windowMinutes;
  return range.startMinute + wrappedOffset;
}

export function getShadowSunDayCycleStepSpanMinutes(
  stepsPerDay: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  return getShadowSunCycleRange(cycleMode).windowMinutes / clampShadowSunDayCycleStepsPerDay(stepsPerDay);
}

export function convertRealSecondsToShadowSunDayCycleMinutes(
  dtRealSec: number,
  multiplier: number,
): number {
  const seconds = Math.max(0, Number.isFinite(dtRealSec) ? dtRealSec : 0);
  return (
    seconds
    * SHADOW_SUN_DAY_CYCLE_BASE_RATE_INGAME_MINUTES_PER_REAL_SECOND
    * clampShadowSunDayCycleSpeedMultiplier(multiplier)
  );
}

export function formatShadowSunDayCycleTimeLabelFromMinutes(
  minuteCursor: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): string {
  const totalMinutes = Math.floor(clampShadowSunDayCycleMinuteCursor(minuteCursor, cycleMode) + 1e-6);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
}

export function normalizeShadowSunDayCycleTimeOfDay01(
  minuteCursor: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const range = getShadowSunCycleRange(cycleMode);
  return (
    (clampShadowSunDayCycleMinuteCursor(minuteCursor, cycleMode) - range.startMinute)
    / range.windowMinutes
  );
}

export function resolveShadowSunDayCycleStepIndex(
  minuteCursor: number,
  stepsPerDay: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const normalizedTimeOfDay01 = normalizeShadowSunDayCycleTimeOfDay01(minuteCursor, cycleMode);
  const clampedStepsPerDay = clampShadowSunDayCycleStepsPerDay(stepsPerDay);
  return Math.min(
    clampedStepsPerDay - 1,
    Math.floor(normalizedTimeOfDay01 * clampedStepsPerDay),
  );
}

export function stepIndexToShadowSunDayCycleMinuteCursor(
  stepIndex: number,
  stepsPerDay: number,
  cycleMode: ShadowSunCycleMode = DEFAULT_SHADOW_SUN_CYCLE_MODE,
): number {
  const range = getShadowSunCycleRange(cycleMode);
  const clampedStepsPerDay = clampShadowSunDayCycleStepsPerDay(stepsPerDay);
  const clampedStepIndex = Math.max(0, Math.min(clampedStepsPerDay - 1, Math.floor(stepIndex)));
  return range.startMinute + ((clampedStepIndex / clampedStepsPerDay) * range.windowMinutes);
}
