import type { World } from "../../../engine/world/world";
import { formatShadowSunTimeLabel } from "../../../shadowSunV1";
import {
  DEFAULT_SHADOW_SUN_CYCLE_MODE,
  SHADOW_SUN_DAY_CYCLE_BASE_RATE_LABEL,
  DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY,
  advanceShadowSunDayCycleMinuteCursor,
  clampShadowSunCycleMode,
  clampShadowSunDayCycleSpeedMultiplier,
  clampShadowSunDayCycleStepsPerDay,
  convertRealSecondsToShadowSunDayCycleMinutes,
  dayCycleMinuteCursorToShadowSunTimeHour,
  formatShadowSunCycleModeLabel,
  formatShadowSunDayCycleTimeLabelFromMinutes,
  getShadowSunDayCycleStepSpanMinutes,
  resolveShadowSunDayCycleStepIndex,
  shadowSunHourToDayCycleMinuteCursor,
  stepIndexToShadowSunDayCycleMinuteCursor,
  type ShadowSunCycleMode,
  type ShadowSunDayCycleSpeedMultiplier,
  type ShadowSunDayCycleStepsPerDay,
} from "../../../shadowSunDayCycle";

type ShadowSunDayCycleRuntimeState = {
  lastEnabled: boolean;
  lastManualSeedHour: number;
  lastCycleMode: ShadowSunCycleMode;
  lastStepsPerDay: ShadowSunDayCycleStepsPerDay;
  currentWindowMinuteCursor: number;
  lastStepIndex: number;
};

export type ShadowSunDayCycleDebugStatus = {
  enabled: boolean;
  cycleMode: ShadowSunCycleMode;
  cycleModeLabel: string;
  multiplier: ShadowSunDayCycleSpeedMultiplier;
  stepsPerDay: ShadowSunDayCycleStepsPerDay;
  stepIndex: number;
  stepSpanMinutes: number;
  baseRateLabel: string;
  manualSeedLabel: string;
  continuousTimeLabel: string;
  quantizedTimeLabel: string;
  effectiveTimeLabel: string;
  advancing: boolean;
  stepChanged: boolean;
  advancementClamped: boolean;
};

export type ResolvedShadowSunDayCycleRuntime = {
  continuousTimeHour: number;
  effectiveTimeHour: number;
  quantizedTimeHour: number;
  shadowStepKeyOverride?: string;
  status: ShadowSunDayCycleDebugStatus;
};

const dayCycleStateByWorld = new WeakMap<World, ShadowSunDayCycleRuntimeState>();

function getOrCreateShadowSunDayCycleRuntimeState(
  world: World,
  manualSeedHour: number,
): ShadowSunDayCycleRuntimeState {
  const seededMinuteCursor = shadowSunHourToDayCycleMinuteCursor(manualSeedHour);
  let state = dayCycleStateByWorld.get(world);
  if (state) return state;

  state = {
    lastEnabled: false,
    lastManualSeedHour: manualSeedHour,
    lastCycleMode: DEFAULT_SHADOW_SUN_CYCLE_MODE,
    lastStepsPerDay: DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY,
    currentWindowMinuteCursor: seededMinuteCursor,
    lastStepIndex: 0,
  };
  dayCycleStateByWorld.set(world, state);
  return state;
}

export function resolveShadowSunDayCycleRuntime(args: {
  world: World;
  manualSeedHour: number;
  enabled: boolean;
  cycleMode: unknown;
  speedMultiplier: number;
  stepsPerDay: number;
  dtRealSec: number;
}): ResolvedShadowSunDayCycleRuntime {
  const manualSeedHour = args.manualSeedHour;
  const cycleMode = clampShadowSunCycleMode(args.cycleMode);
  const multiplier = clampShadowSunDayCycleSpeedMultiplier(args.speedMultiplier);
  const stepsPerDay = clampShadowSunDayCycleStepsPerDay(args.stepsPerDay);
  const state = getOrCreateShadowSunDayCycleRuntimeState(args.world, manualSeedHour);
  const manualSeedLabel = formatShadowSunTimeLabel(manualSeedHour);
  const stepSpanMinutes = getShadowSunDayCycleStepSpanMinutes(stepsPerDay, cycleMode);

  const buildResolved = (input: {
    enabled: boolean;
    advancing: boolean;
    continuousMinuteCursor: number;
    stepChanged: boolean;
    advancementClamped: boolean;
  }): ResolvedShadowSunDayCycleRuntime => {
    const continuousMinuteCursor = input.continuousMinuteCursor;
    const stepIndex = resolveShadowSunDayCycleStepIndex(continuousMinuteCursor, stepsPerDay, cycleMode);
    const quantizedMinuteCursor = stepIndexToShadowSunDayCycleMinuteCursor(stepIndex, stepsPerDay, cycleMode);
    const continuousTimeHour = dayCycleMinuteCursorToShadowSunTimeHour(continuousMinuteCursor, cycleMode);
    const quantizedTimeHour = dayCycleMinuteCursorToShadowSunTimeHour(quantizedMinuteCursor, cycleMode);
    const continuousTimeLabel = formatShadowSunDayCycleTimeLabelFromMinutes(continuousMinuteCursor, cycleMode);
    const quantizedTimeLabel = formatShadowSunDayCycleTimeLabelFromMinutes(quantizedMinuteCursor, cycleMode);
    const shadowStepKeyOverride = input.enabled
      ? `sun-v1:cont:${cycleMode}:spd${stepsPerDay}:step${stepIndex}`
      : undefined;

    state.lastEnabled = input.enabled;
    state.lastManualSeedHour = manualSeedHour;
    state.lastCycleMode = cycleMode;
    state.lastStepsPerDay = stepsPerDay;
    state.currentWindowMinuteCursor = continuousMinuteCursor;
    state.lastStepIndex = stepIndex;

    return {
      continuousTimeHour,
      effectiveTimeHour: quantizedTimeHour,
      quantizedTimeHour,
      shadowStepKeyOverride,
      status: {
        enabled: input.enabled,
        cycleMode,
        cycleModeLabel: formatShadowSunCycleModeLabel(cycleMode),
        multiplier,
        stepsPerDay,
        stepIndex,
        stepSpanMinutes,
        baseRateLabel: SHADOW_SUN_DAY_CYCLE_BASE_RATE_LABEL,
        manualSeedLabel,
        continuousTimeLabel,
        quantizedTimeLabel,
        effectiveTimeLabel: quantizedTimeLabel,
        advancing: input.advancing,
        stepChanged: input.stepChanged,
        advancementClamped: input.advancementClamped,
      },
    };
  };

  if (!args.enabled) {
    return buildResolved({
      enabled: false,
      advancing: false,
      continuousMinuteCursor: shadowSunHourToDayCycleMinuteCursor(manualSeedHour, cycleMode),
      stepChanged: false,
      advancementClamped: false,
    });
  }

  const needsReseed =
    !state.lastEnabled
    || state.lastManualSeedHour !== manualSeedHour
    || state.lastCycleMode !== cycleMode
    || state.lastStepsPerDay !== stepsPerDay;
  if (needsReseed) {
    state.currentWindowMinuteCursor = shadowSunHourToDayCycleMinuteCursor(manualSeedHour, cycleMode);
  }

  const advancing = args.world.state === "RUN";
  let advancementClamped = false;
  if (advancing) {
    const rawDeltaMinutes = convertRealSecondsToShadowSunDayCycleMinutes(args.dtRealSec, multiplier);
    const appliedDeltaMinutes = Math.min(rawDeltaMinutes, stepSpanMinutes);
    advancementClamped = appliedDeltaMinutes < rawDeltaMinutes;
    state.currentWindowMinuteCursor = advanceShadowSunDayCycleMinuteCursor(
      state.currentWindowMinuteCursor,
      appliedDeltaMinutes,
      cycleMode,
    );
  }

  const nextStepIndex = resolveShadowSunDayCycleStepIndex(state.currentWindowMinuteCursor, stepsPerDay, cycleMode);
  return buildResolved({
    enabled: true,
    advancing,
    continuousMinuteCursor: state.currentWindowMinuteCursor,
    stepChanged: needsReseed || nextStepIndex !== state.lastStepIndex,
    advancementClamped,
  });
}
