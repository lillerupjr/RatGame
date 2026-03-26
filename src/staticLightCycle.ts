export const STATIC_LIGHT_CYCLE_OVERRIDE_OPTIONS = ["automatic", "on", "off"] as const;

export type StaticLightCycleOverride = (typeof STATIC_LIGHT_CYCLE_OVERRIDE_OPTIONS)[number];

export const STATIC_LIGHTS_AUTOMATIC_ON_HOUR = 17;
export const STATIC_LIGHTS_AUTOMATIC_OFF_HOUR = 9;

export function clampStaticLightCycleOverride(value: unknown): StaticLightCycleOverride {
  if (value === "on" || value === "off") return value;
  return "automatic";
}

export function formatStaticLightCycleOverrideLabel(value: StaticLightCycleOverride): string {
  if (value === "on") return "On";
  if (value === "off") return "Off";
  return "Automatic";
}

export function areStaticLightsActiveForSunHour(
  timeHour: number,
  override: StaticLightCycleOverride,
): boolean {
  const mode = clampStaticLightCycleOverride(override);
  if (mode === "on") return true;
  if (mode === "off") return false;

  const normalizedHour = Number.isFinite(timeHour) ? ((timeHour % 24) + 24) % 24 : 13;
  return normalizedHour >= STATIC_LIGHTS_AUTOMATIC_ON_HOUR || normalizedHour < STATIC_LIGHTS_AUTOMATIC_OFF_HOUR;
}
