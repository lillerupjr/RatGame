import type { DamageMeta } from "../events";
import type { EnemyAiType } from "../content/enemies";
import type {
  BossAbilityId,
  BossAbilityKind,
  BossAbilityPhase,
  BossAnimationHookSet,
} from "./bossAbilities";
import type {
  HostileBodyConfig,
  HostileDeathEffectConfig,
  HostileMovementConfig,
  HostilePresentationConfig,
  HostileRewardsConfig,
  HostileStatsConfig,
} from "../hostiles/hostileTypes";

export const BossId = {
  CHEM_GUY: "chem_guy",
} as const;

export type BossId = (typeof BossId)[keyof typeof BossId];

export type BossAbilityLoadoutEntry = {
  abilityId: BossAbilityId;
  weight?: number;
  constraints?: string[];
  cooldownGroup?: string;
  priority?: number;
};

export type BossDefinition = {
  id: BossId;
  name: string;
  aiType: EnemyAiType;
  engageDistanceTiles: number;
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

export type BossAnimationRequest = {
  clip: string;
  loop: boolean;
};

export type BossCastRuntimeState = {
  castId: string;
  abilityId: BossAbilityId;
  kind: BossAbilityKind;
  phase: BossAbilityPhase;
  phaseElapsedSec: number;
  phaseDurationSec: number;
  castElapsedSec: number;
  originWorld: { x: number; y: number };
  targetWorld: { x: number; y: number } | null;
  targetTile: { tx: number; ty: number } | null;
  selectedTiles: Array<{ tx: number; ty: number }>;
  arenaEffectIds: string[];
  animationHooks: BossAnimationHookSet | null;
  animationRequest: BossAnimationRequest | null;
};

export type ArenaTileEffectState = "WARNING" | "ACTIVE";

export type ArenaTileEffect = {
  id: string;
  encounterId: string;
  abilityId: BossAbilityId;
  tiles: Array<{ tx: number; ty: number }>;
  state: ArenaTileEffectState;
  ttlSec: number;
  tickEverySec: number;
  tickLeftSec: number;
  damagePlayer: number;
  playerDamageMeta?: DamageMeta;
};

export type BossEncounterStatus = "ACTIVE" | "DEFEATED";
export type BossActivationState = "DORMANT" | "ACTIVE";

export type BossEncounterState = {
  id: string;
  bossId: BossId;
  enemyIndex: number;
  objectiveId?: string;
  status: BossEncounterStatus;
  activationState: BossActivationState;
  activeCast: BossCastRuntimeState | null;
  requestedAnimation: BossAnimationRequest | null;
  cooldowns: Record<BossAbilityId, number>;
  globalCooldownLeftSec: number;
  lastAbilityId: BossAbilityId | null;
};

export type BossRuntimeState = {
  nextEncounterSeq: number;
  nextCastSeq: number;
  nextArenaEffectSeq: number;
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
