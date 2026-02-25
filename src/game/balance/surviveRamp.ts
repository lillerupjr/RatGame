export interface SurviveRampConfig {
  durationSec: number;
  basePowerPerSecond: number;
  rampStrength: number;
  waveChunkStart: number;
  waveChunkEnd: number;
  waveDelayStartSec: number;
  waveDelayEndSec: number;
  eliteStartTimeSec: number;
  eliteChance: number;
}

export const SURVIVE_RAMP_CONFIG: SurviveRampConfig = {
  durationSec: 120,
  basePowerPerSecond: 1.4,
  rampStrength: 3.2,
  waveChunkStart: 3,
  waveChunkEnd: 6,
  waveDelayStartSec: 1.0,
  waveDelayEndSec: 0.55,
  eliteStartTimeSec: 60,
  eliteChance: 0.10,
};

const SURVIVE_PRESSURE_CAP_MULT = 2.0;

export function buildSurviveSpawnOverrides(nowSec: number, cfg: SurviveRampConfig = SURVIVE_RAMP_CONFIG) {
  const progress = Math.min(1, Math.max(0, nowSec / cfg.durationSec));
  const rampUncapped = 1 + progress * progress * cfg.rampStrength;
  const ramp = Math.min(SURVIVE_PRESSURE_CAP_MULT, rampUncapped);
  const powerPerSecondOverride = cfg.basePowerPerSecond * ramp;
  const waveChunkOverride = Math.floor(
    cfg.waveChunkStart + (cfg.waveChunkEnd - cfg.waveChunkStart) * progress
  );
  const waveDelayOverride =
    cfg.waveDelayStartSec + (cfg.waveDelayEndSec - cfg.waveDelayStartSec) * progress;
  const eliteChanceOverride = nowSec >= cfg.eliteStartTimeSec ? cfg.eliteChance : 0;

  return {
    progress,
    ramp,
    powerPerSecondOverride,
    waveChunkOverride,
    waveDelayOverride,
    eliteChanceOverride,
  };
}
