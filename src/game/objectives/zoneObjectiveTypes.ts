export type ZoneObjective = {
  id: number;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  killTarget: number;
  killCount: number;
  completed: boolean;
};

export type ZoneTrialObjectiveState = {
  zones: ZoneObjective[];
  totalZones: number;
  completedZones: number;
  completed: boolean;
  completionSignalEmitted: boolean;
};

export type ZoneTrialConfig = {
  zoneCount: number;
  zoneSize: number;
  killTargetPerZone: number;
  killTargetMin: number;
  killTargetMax: number;
};

export const DEFAULT_ZONE_TRIAL_CONFIG: ZoneTrialConfig = {
  zoneCount: 3,
  zoneSize: 4,
  killTargetPerZone: 8,
  killTargetMin: 4,
  killTargetMax: 20,
};

export function isTileInsideZone(tx: number, ty: number, zone: ZoneObjective): boolean {
  return (
    tx >= zone.tileX &&
    ty >= zone.tileY &&
    tx < zone.tileX + zone.tileW &&
    ty < zone.tileY + zone.tileH
  );
}
