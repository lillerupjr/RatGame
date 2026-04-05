import type { EnemyAiType } from "../content/enemies";
import type {
  HostileBodyConfig,
  HostileDeathEffectConfig,
  HostileMovementConfig,
  HostilePresentationConfig,
  HostileRewardsConfig,
  HostileStatsConfig,
} from "../hostiles/hostileTypes";

export const BossId = {
  RAT_KING: "RAT_KING",
} as const;

export type BossId = (typeof BossId)[keyof typeof BossId];

export type BossAbilityLoadoutEntry = {
  abilityId: string;
  weight?: number;
  constraints?: string[];
  cooldownGroup?: string;
  priority?: number;
};

export type BossDefinition = {
  id: BossId;
  name: string;
  aiType: EnemyAiType;
  stats: HostileStatsConfig;
  body: HostileBodyConfig;
  rewards?: HostileRewardsConfig;
  presentation?: HostilePresentationConfig;
  movement: HostileMovementConfig;
  abilityLoadout: BossAbilityLoadoutEntry[];
  deathEffects?: HostileDeathEffectConfig[];
  ui?: {
    title?: string;
    accent?: string;
  };
  metadata?: Record<string, unknown>;
};

export type BossEncounterStatus = "ACTIVE" | "DEFEATED";

export type BossEncounterState = {
  id: string;
  bossId: BossId;
  enemyIndex: number;
  objectiveId?: string;
  status: BossEncounterStatus;
  cooldowns: Record<string, number>;
  globalCooldownLeftSec: number;
  lastAbilityId: string | null;
};

export type BossRuntimeState = {
  nextEncounterSeq: number;
  activeEncounterId: string | null;
  encounters: BossEncounterState[];
  enemyIndexToEncounterId: (string | undefined)[];
  objectiveToEncounterId: Record<string, string | undefined>;
};

export type SpawnBossEncounterResult = {
  encounterId: string;
  bossId: BossId;
  enemyIndex: number;
};
