import type { DamageMeta } from "../events";
import type { EnemyAiType } from "../content/enemies";
import type {
  BossAbilityId,
  BossAbilityKind,
  BossAbilityPhase,
  BossAnimationHookSet,
} from "./bossAbilities";
import type { BossArenaSequenceRuntimeState } from "./bossArenaTypes";
import type { AnimatedSurfaceId } from "../systems/presentation/animatedSurfaces/animatedSurfaceTypes";
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
  startedAtSec: number;
  durationSec?: number;
};

export type BossBeamRuntimeState = {
  lockedDirX: number;
  lockedDirY: number;
  startWorldX: number;
  startWorldY: number;
  endWorldX: number;
  endWorldY: number;
  maxRangePx: number;
  widthPx: number;
  visualScale: number;
  damagePerTick: number;
  tickEverySec: number;
  tickLeftSec: number;
  loopClipId: number;
  endingClipId: number;
};

export type BossWorldEffect = {
  id: string;
  spriteId: string;
  worldX: number;
  worldY: number;
  projectionMode?: "flat_quad" | "ground_iso";
  tileTx?: number;
  tileTy?: number;
  zOffsetPx?: number;
  baseScale: number;
  alpha?: number;
  pulse?: {
    minScale: number;
    maxScale: number;
    cycleSec: number;
  };
};

export type BossBurstSequenceRuntimeState = {
  burstCount: number;
  burstSpacingSec: number;
  telegraphLeadSec: number;
  burstsTelegraphed: number;
  burstsExploded: number;
  burstTiles: Array<{ tx: number; ty: number }>;
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
  arenaSequence: BossArenaSequenceRuntimeState | null;
  worldEffects: BossWorldEffect[];
  burstSequence: BossBurstSequenceRuntimeState | null;
  beam: BossBeamRuntimeState | null;
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
  surfaceId?: AnimatedSurfaceId;
  renderOverlay?: boolean;
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
  nextAbilityCursor: number;
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
