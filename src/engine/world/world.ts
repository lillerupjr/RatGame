// src/game/world.ts
import { RNG } from "../../game/util/rng";
import { createSpatialHash, type SpatialHash } from "../../game/util/spatialHash";
import type { StageDef } from "../../game/content/stages";
import type { DamageMeta, GameEvent, PendingRelicDaggerShot, PendingRelicRetrigger } from "../../game/events";
import { KENNEY_TILE_WORLD } from "../render/kenneyTiles";
import { getSpawnWorld } from "../../game/map/compile/kenneyMap";
import { recomputeDerivedStats } from "../../game/stats/derivedStats";
import { anchorFromWorld } from "../../game/coords/anchor";
import type { TriggerInstance } from "../../game/triggers/triggerTypes";
import type { TriggerSignal } from "../../game/triggers/triggerSignals";
import type { ObjectiveDef, ObjectiveEvent, ObjectiveState } from "../../game/systems/progression/objective";
import type { ObjectiveSpec } from "../../game/systems/progression/objectiveSpec";
import type { FloorArchetype } from "../../game/map/floorArchetype";
import type { FloorIntent } from "../../game/map/floorIntent";
import type { TriggerDef } from "../../game/triggers/triggerTypes";
import type { Dir8 } from "../render/sprites/dir8";
import type { EnemyAilmentsState } from "../../game/combat_mods/ailments/enemyAilments";
import type { CardRewardState } from "../../game/combat_mods/rewards/cardRewardFlow";
import type { RelicRewardState } from "../../game/combat_mods/rewards/relicRewardFlow";
import type { FloorRewardBudget } from "../../game/rewards/floorRewardBudget";
import type { RunEvent } from "../../game/rewards/runEvents";
import type { RewardTicket } from "../../game/rewards/rewardTickets";
import type { VendorState } from "../../game/vendor/vendorState";
import type { EnemyBrainState } from "../../game/systems/enemies/brain";
import { createDpsMetrics, type DpsMetricsState } from "../../game/balance/dpsMetrics";
import { getSettings } from "../../settings/settingsStore";
import { DEFAULT_XP_LEVEL_BASE } from "../../settings/systemOverrides";
import type {
  HostileSpawnDebugSnapshot,
  HostileSpawnDirectorState,
} from "../../game/systems/spawn/hostileSpawnDirector";

import type { RelicInstance } from "../../game/content/relics";

/**
 * NOTE:
 * game.ts already uses world.state = "MAP", so GameState MUST include "MAP".
 */
export type GameState =
    | "MENU"
    | "RUN"
    | "MAP"
    | "REWARD"
    | "PAUSED"
    | "LOSE"
    | "WIN";

/**
 * Run phase inside the RUN game-state.
 * (game.ts uses these values.)
 */
export type RunState = "FLOOR" | "BOSS" | "TRANSITION" | "RUN_COMPLETE"  | "GAME_OVER";

export type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";
export type WorldLightingState = {
  darknessAlpha: number;
  ambientTint?: string;
  ambientTintStrength?: number;
  groundYScale?: number;
  occlusionEnabled: boolean;
};

export type NpcActor = {
  id: string;
  kind: "vendor" | "healer";
  tx: number;
  ty: number;
  wx: number;
  wy: number;
  dirBase: Dir8;
  dirCurrent: Dir8;
  faceRestoreAtMs: number | null;
  shadowRadiusX?: number;
  shadowRadiusY?: number;
  castsShadow?: boolean;
};

export type NeutralAnimatedMob = {
  id: string;
  kind: "PIGEON";
  pos: { wx: number; wy: number; wzOffset: number };
  anim: {
    frameIndex: number;
    fps: number;
    loop: boolean;
    elapsed: number;
    clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND";
  };
  behavior: {
    state: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND";
    stateTimerSec: number;
    targetTileX: number;
    targetTileY: number;
    lastPlayerDist2: number;
    lastTargetDist2: number;
    rngState?: number;
  };
  params: {
    walkTriggerTiles: number;
    safeDistanceTiles: number;
    targetMinDistanceTiles: number;
    targetMaxDistanceTiles: number;
    targetAngleJitterDeg: number;
    flySpeedTilesPerSec: number;
    targetReachedThresholdTiles: number;
    flyHeight: number;
    takeoffTimeSec: number;
    landTimeSec: number;
    epsilon: number;
  };
  spriteFrames: HTMLImageElement[];
  render: {
    anchorX: number;
    anchorY: number;
    scale: number;
    flipX: boolean;
    screenDir: Dir8;
  };
  debug: {
    frameLogsRemaining: number;
    renderLogged: boolean;
  };
  shadowRadiusX?: number;
  shadowRadiusY?: number;
  castsShadow?: boolean;
};

export type WorldTimeState = {
  dtReal: number;
  dtSim: number;
  timeScale: number;
  timeScaleTarget: number;
  timeScaleSlew: number;
};

export type DeathFxState = {
  active: boolean;
  tReal: number;
  durationReal: number;
  aFlash: number;
  aDesat: number;
  aVignette: number;
  aDark: number;
  aTitle: number;
  aBlack: number;
};

export type CameraFollowState = {
  posX: number;
  posY: number;
  targetX: number;
  targetY: number;
  followHalfLifeSec: number;
};

export type World = {
  // -------------------------
  // Core
  // -------------------------
  state: GameState;
  runState: RunState;
  rng: RNG;

  // Event queue (audio, hits, kills, pickups, etc.)
  events: GameEvent[];
  eventQueue: GameEvent[];

  // Trigger registry and signal queue
  triggerMapId: string | null;
  triggerRegistry: TriggerInstance[];
  triggerSignals: TriggerSignal[];
  overlayTriggerDefs: TriggerDef[];
  overlayTriggerVersion: number;
  triggerRegistryVersion: number;

  // Objective registry and events
  objectiveDefs: ObjectiveDef[];
  objectiveStates: ObjectiveState[];
  objectiveEvents: ObjectiveEvent[];
  currentObjectiveSpec: ObjectiveSpec | null;
  zoneTrial?: {
    originTx?: number;
    originTy?: number;
    zones: Array<{ tx: number; ty: number; w: number; h: number; completed: boolean }>;
  };
  bossTriple?: {
    spawnPointsWorld: Array<{ x: number; y: number }>;
    completed: boolean[];
  };

  // -------------------------
  // Stage / floor
  // -------------------------
  stage: StageDef | null;
  stageId: StageId;
  stageTime: number;
  runSeed: number;
  runHeat: number;
  mapDepth: number;

  // Floor index (0..2) and timers
  floorIndex: number;
  floorArchetype: FloorArchetype;
  currentFloorIntent: FloorIntent | null;
  floorDuration: number; // seconds until boss for this stage
  phaseTime: number; // seconds since current phase began
  transitionTime: number; // seconds remaining in TRANSITION
  hostileSpawnDirector: HostileSpawnDirectorState;
  hostileSpawnDebug: HostileSpawnDebugSnapshot | null;

  // Total run time
  time: number;
  timeSec: number;
  timeState: WorldTimeState;
  camera: CameraFollowState;
  deathFx: DeathFxState;
  run: {
    runGold: number;
    xp: number;
    level: number;
    xpToNextLevel: number;
  };
  lighting: WorldLightingState;

  // -------------------------
  // Delve / route (kept loose to avoid circular deps)
  // -------------------------
  delveMap: any | null;
  delveDepth: number;
  delveScaling: {
    hpMult: number;
    damageMult: number;
    spawnRateMult: number;
  };

  // -------------------------
  // Room Challenges
  // -------------------------
  // Room data from procedural map (null if no procedural map loaded)
  roomData: { 
    id: number; 
    cx: number; 
    cy: number; 
    width: number; 
    height: number;
    level: number;
    challengeType: string;
    killsRequired: number;
  }[] | null;
  
  // Current room the player is in (-1 if not in any room)
  currentRoomId: number;
  
  // Challenge state for current room
  roomChallengeActive: boolean;     // Is a challenge currently active?
  roomChallengeKillsNeeded: number; // Kills needed to complete challenge
  roomChallengeKillsCount: number;  // Kills so far in this challenge
  roomChallengeLocked: boolean;     // Is the room exit locked?

  // -------------------------
  // Player
  // -------------------------
  // Grid-authoritative position (screen-aligned logical grid)
  pgxi: number;
  pgyi: number;
  pgox: number;
  pgoy: number;

  // Continuous elevation (Milestone B/C). Typically map-driven.
  pz: number;
  pzVisual: number;
  pzLogical: number;

  pvx: number;
  pvy: number;
  /** Vertical velocity (for jumping/falling). Positive = upward. */
  pvz: number;
  /** Whether the player is currently on the ground (can jump). */
  isGrounded: boolean;

  // Collision radius
  playerR: number;

  // Active integer floor height (used by zones / collisions gating)
  activeFloorH: number;

  // Base stats
  baseMoveSpeed: number;
  basePickupRadius: number;

  // Derived stats (recomputed from items)
  pSpeed: number;
  pickupRadius: number;

  // Player combat stats
  playerHp: number;
  playerHpMax: number;
  basePlayerHpMax: number;
  maxArmor: number;
  currentArmor: number;

  dmgMult: number;
  fireRateMult: number;
  areaMult: number;
  durationMult: number;

  // Crit stats
  baseCritChance: number;
  critChanceBonus: number;
  critMultiplier: number;

  // Run stats
  kills: number;
  momentumValue: number;
  momentumMax: number;
  momentumWasFull: boolean;
  fullMomentumActive: boolean;
  momentumLastGainTime: number;

  // Vendor economy (scaffold)
  vendorOffers: { kind: "RELIC" | "UPGRADE" | "HEAL" | "REROLL"; id: string; cost: number }[];
  vendorPurchases: string[];
  vendor: VendorState | null;
  pendingAdvanceToNextFloor: boolean;
  relics: string[];
  relicInstances?: RelicInstance[];
  starterLuckyChamberShotCounter?: number;
  relicRetriggerQueue: PendingRelicRetrigger[];
  relicDaggerQueue: PendingRelicDaggerShot[];
  relicEffects: { hpBonus: number };
  npcs: NpcActor[];
  neutralMobs: NeutralAnimatedMob[];

  // -------------------------
  // Items + cards
  // -------------------------
  items: { id: any; level: number }[];
  cards: string[];
  combatCardIds: string[];
  cardReward: CardRewardState;
  relicReward: RelicRewardState;
  floorRewardBudget: FloorRewardBudget;
  cardRewardBudgetTotal: number;
  cardRewardBudgetUsed: number;
  cardRewardClaimKeys: string[];
  lastCardRewardClaimKey: string | null;
  runEvents: RunEvent[];
  rewardTickets: RewardTicket[];
  activeRewardTicketId: string | null;
  rewardTicketSeq: number;
  floorEndCountdownSec: number;
  floorEndCountdownActive: boolean;
  floorEndCountdownStartedKey: string | null;
  floorClearCommitted: boolean;
  objectiveRewardClaimedKey: string | null;
  zoneRewardClaimedKey?: string | null;
  zoneRewardClaimedKeys?: string[];
  primaryWeaponCdLeft: number;
  playerBeamActive: boolean;
  playerBeamStartX: number;
  playerBeamStartY: number;
  playerBeamEndX: number;
  playerBeamEndY: number;
  playerBeamDirX: number;
  playerBeamDirY: number;
  playerBeamUvOffset: number;
  playerBeamWidthPx: number;
  playerBeamGlowIntensity: number;
  playerBeamDpsPhys: number;
  playerBeamDpsFire: number;
  playerBeamDpsChaos: number;
  playerBeamDamageMeta?: DamageMeta;
  dotTickAcc: number;

  // -------------------------
  // Level (compatibility mirror of run.level)
  // -------------------------
  level: number;

  // Aim cache (used for melee cone / fallback aim)
  lastAimX: number;
  lastAimY: number;

  // -------------------------
  // Enemies
  // -------------------------
  eAlive: boolean[];
  eType: number[];
  // Grid-authoritative positions
  egxi: number[];
  egyi: number[];
  egox: number[];
  egoy: number[];
  evx: number[];
  evy: number[];
  eFaceX: number[];
  eFaceY: number[];
  eBaseLife: number[];
  eHp: number[];
  eHpMax: number[];
  eR: number[];
  eSpeed: number[];
  eDamage: number[];
  ezVisual: number[];
  ezLogical: number[];
  eBrain: (EnemyBrainState | undefined)[];

  // Poison (enemy status)
  ePoisonT: number[];
  ePoisonDps: number[];
  ePoisonedOnDeath: boolean[];
  eSpawnTriggerId: (string | undefined)[];
  eAilments: (EnemyAilmentsState | undefined)[];

  // Enemy spatial hash (perf)
  enemySpatialHash: SpatialHash;

  // -------------------------
  // Zones
  // -------------------------
  zAlive: boolean[];
  zKind: number[];
  // Grid-authoritative positions
  zgxi: number[];
  zgyi: number[];
  zgox: number[];
  zgoy: number[];
  zR: number[];
  zDamage: number[];
  zTickEvery: number[];
  zTickLeft: number[];
  zTtl: number[];
  zFollowPlayer: boolean[];
  zDamagePlayer: number[];
  zEnemyDamageMeta: (DamageMeta | undefined)[];
  zPlayerDamageMeta: (DamageMeta | undefined)[];

  // -------------------------
  // Projectiles
  // -------------------------
  pAlive: boolean[];
  prHidden: boolean[]; // Phase 3: render-only hide (e.g., underground)
  pKind: number; // reserved
  prjKind: number[];
  // Grid-authoritative positions
  prgxi: number[];
  prgyi: number[];
  prgox: number[];
  prgoy: number[];

  // Milestone C: projectile height (continuous)
  prZ: number[];
  prZVisual: number[];
  prZLogical: number[];
  // Milestone C: can this projectile hit the player?
  prHitsPlayer: boolean[];

  prvx: number[];
  prvy: number[];
  prDamage: number[];
  prDmgPhys: number[];
  prDmgFire: number[];
  prDmgChaos: number[];
  prCritChance: number[];
  prCritMulti: number[];
  prChanceBleed: number[];
  prChanceIgnite: number[];
  prChancePoison: number[];
  prR: number[];
  prPierce: number[];
  prIsmelee: boolean[];
  prCone: number[];
  prMeleeRange: number[];
  prDirX: number[];
  prDirY: number[];
  prSpawnTime: number[];
  prTtl: number[];
  prBouncesLeft: number[];
  prDamageMeta: (DamageMeta | undefined)[];

  // Bounces off camera bounds
  prWallBounce: boolean[];

  // Special: skip enemy collision (e.g., bazooka rocket that explodes via target)
  prNoCollide: boolean[];

  // Static target / explode-on-arrival
  prHasTarget: boolean[];
  prTargetX: number[];
  prTargetY: number[];

  prStartX: number[];
  prStartY: number[];
  prPlayerFireX: number[];
  prPlayerFireY: number[];
  prMaxDist: number[];

  // Anti-multi-hit guard
  prLastHitEnemy: number[];
  prLastHitCd: number[];

  // Poison payload
  prPoisonDps: number[];
  prPoisonDur: number[];

  // Bazooka evolution aftershocks
  prAftershockN: number[];
  prAftershockDelay: number[];
  prAftershockRingR: number[];
  prAftershockWaves: number[];
  prAftershockRingStep: number[];

  // Explosion payload
  prExplodeR: number[];
  prExplodeDmg: number[];
  prExplodeTtl: number[];

  // Orbitals
  prIsOrbital: boolean[];
  prOrbAngle: number[];
  prOrbBaseRadius: number[];
  prOrbBaseAngVel: number[];

  // Fission (projectile-projectile)
  prFission: boolean[];
  prFissionCd: number[];

  // -------------------------
  // Pickups
  // -------------------------
  xAlive: boolean[];
  xKind: number[];
  // Grid-authoritative positions
  xgxi: number[];
  xgyi: number[];
  xgox: number[];
  xgoy: number[];
  xValue: number[];
  xDropId: string[];

  // -------------------------
  // VFX entities
  // -------------------------
  vfxAlive: boolean[];
  vfxX: number[];
  vfxY: number[];
  vfxRadius: number[];
  vfxElapsed: number[];
  vfxTtl: number[];
  vfxClipId: number[];
  vfxLoop: boolean[];
  vfxFollowEnemy: number[];   // -1 = no follow
  vfxOffsetYPx: number[];
  vfxScale: number[];

  // Boss reward bookkeeping
  bossZoneSpawned: string[];

  // Magnet effect (pull XP to player)
  magnetActive: boolean;
  magnetTimer: number;

  // Chest handshake (system -> game.ts)
  chestOpenRequested: boolean;

  // -------------------------
  // Floating combat text
  // -------------------------
  floatTextX: number[];
  floatTextY: number[];
  floatTextValue: number[];
  floatTextColor: string[];
  floatTextSize: number[];
  floatTextTtl: number[];
  floatTextIsCrit: boolean[];
  floatTextIsPlayer: boolean[];
  uiFloatTextSeed: number;

  // -------------------------
  // DPS tracking (render.ts expects these)
  // -------------------------
  dpsEnabled: boolean;
  dpsSamples: { t: number; dmg: number }[];
  dpsTotalDamage: number;
  dpsStartTime: number;
  dpsRecentDamage: number[];
  dpsRecentTimes: number[];

  metrics: {
    dps: DpsMetricsState;
  };
};

export type CreateWorldArgs = {
  seed?: number;
  stage: StageDef;
};

function cloneStage(stage: StageDef): StageDef {
  return { ...stage };
}

/** Initialize a new World with seeded RNG and stage state. */
export function createWorld(args: CreateWorldArgs): World {
  const rng = new RNG((args.seed ?? 1337) >>> 0);

  const stage = cloneStage(args.stage);

  const w: World = {
    // Core
    state: "MENU",
    runState: "FLOOR",
    rng,
    events: [],
    eventQueue: [],

    triggerMapId: null,
    triggerRegistry: [],
    triggerSignals: [],
    overlayTriggerDefs: [],
    overlayTriggerVersion: 0,
    triggerRegistryVersion: 0,

    objectiveDefs: [],
    objectiveStates: [],
    objectiveEvents: [],
    currentObjectiveSpec: null,

    // Stage / floor
    stage,
    stageId: stage.id,
    stageTime: 0,
    runSeed: args.seed ?? 1337,
    runHeat: 0,
    mapDepth: 1,

    floorIndex: 0,
    floorArchetype: "SURVIVE",
    currentFloorIntent: null,
    floorDuration: stage.duration,
    phaseTime: 0,
    transitionTime: 0,
    hostileSpawnDirector: {
      budget: 0,
      spawnCooldownSec: 0,
      burstCooldownSec: 12,
      rngSeed: ((args.seed ?? 1337) ^ 0x9e3779b9) >>> 0,
    },
    hostileSpawnDebug: null,

    time: 0,
    timeSec: 0,
    timeState: {
      dtReal: 0,
      dtSim: 0,
      timeScale: 1,
      timeScaleTarget: 1,
      timeScaleSlew: 12,
    },
    camera: {
      posX: 0,
      posY: 0,
      targetX: 0,
      targetY: 0,
      followHalfLifeSec: 0.08,
    },
    deathFx: {
      active: false,
      tReal: 0,
      durationReal: 2,
      aFlash: 0,
      aDesat: 0,
      aVignette: 0,
      aDark: 0,
      aTitle: 0,
      aBlack: 0,
    },
    run: {
      runGold: 0,
      xp: 0,
      level: 1,
      xpToNextLevel: Math.max(1, Math.round(getSettings().system?.xpLevelBase ?? DEFAULT_XP_LEVEL_BASE)),
    },
    lighting: {
      darknessAlpha: 0.5,
      ambientTint: undefined,
      ambientTintStrength: 0,
      groundYScale: 0.65,
      occlusionEnabled: true,
    },

    // Delve / route
    delveMap: null,
    delveDepth: 1,
    delveScaling: {
      hpMult: 1,
      damageMult: 1,
      spawnRateMult: 1,
    },

    // Room Challenges
    roomData: null,
    currentRoomId: -1,
    roomChallengeActive: false,
    roomChallengeKillsNeeded: 0,
    roomChallengeKillsCount: 0,
    roomChallengeLocked: false,

    // Player
    pgxi: 0,
    pgyi: 0,
    pgox: 0,
    pgoy: 0,
    pz: 0,
    pzVisual: 0,
    pzLogical: 0,
    pvx: 0,
    pvy: 0,
    pvz: 0,
    isGrounded: true,
    playerR: 18,

    activeFloorH: 0,

    baseMoveSpeed: 240,
    basePickupRadius: 180,

    pSpeed: 260,
    pickupRadius: 180,

    playerHp: 100,
    playerHpMax: 100,
    basePlayerHpMax: 100,
    maxArmor: 50,
    currentArmor: 0,

    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,

    baseCritChance: 0.05,
    critChanceBonus: 0,
    critMultiplier: 2.0,

    kills: 0,
    momentumValue: 0,
    momentumMax: 20,
    momentumWasFull: false,
    fullMomentumActive: false,
    momentumLastGainTime: 0,
    vendorOffers: [],
    vendorPurchases: [],
    vendor: null,
    pendingAdvanceToNextFloor: false,
    relics: [],
    relicInstances: [],
    starterLuckyChamberShotCounter: 0,
    relicRetriggerQueue: [],
    relicDaggerQueue: [],
    relicEffects: {
      hpBonus: 0,
    },
    npcs: [],
    neutralMobs: [],

    // Items + cards
    items: [],
    cards: [],
    combatCardIds: [],
    cardReward: {
      active: false,
      source: "ZONE_TRIAL",
      options: [],
    },
    relicReward: {
      active: false,
      source: "OBJECTIVE_COMPLETION",
      options: [],
    },
    floorRewardBudget: {
      mode: "NORMAL",
      nonObjectiveCardsRemaining: 0,
      objectiveCardAvailable: true,
      fired: Object.create(null),
    },
    cardRewardBudgetTotal: 0,
    cardRewardBudgetUsed: 0,
    cardRewardClaimKeys: [],
    lastCardRewardClaimKey: null,
    runEvents: [],
    rewardTickets: [],
    activeRewardTicketId: null,
    rewardTicketSeq: 0,
    floorEndCountdownSec: 0,
    floorEndCountdownActive: false,
    floorEndCountdownStartedKey: null,
    floorClearCommitted: false,
    objectiveRewardClaimedKey: null,
    zoneRewardClaimedKey: null,
    zoneRewardClaimedKeys: [],
    primaryWeaponCdLeft: 0,
    playerBeamActive: false,
    playerBeamStartX: 0,
    playerBeamStartY: 0,
    playerBeamEndX: 0,
    playerBeamEndY: 0,
    playerBeamDirX: 1,
    playerBeamDirY: 0,
    playerBeamUvOffset: 0,
    playerBeamWidthPx: 0,
    playerBeamGlowIntensity: 0,
    playerBeamDpsPhys: 0,
    playerBeamDpsFire: 0,
    playerBeamDpsChaos: 0,
    playerBeamDamageMeta: undefined,
    dotTickAcc: 0,

    // Level
    level: 1,

    // Aim
    lastAimX: 1,
    lastAimY: 0,

    // Enemies
    eAlive: [],
    eType: [],
    egxi: [],
    egyi: [],
    egox: [],
    egoy: [],
    evx: [],
    evy: [],
    eFaceX: [],
    eFaceY: [],
    eBaseLife: [],
    eHp: [],
    eHpMax: [],
    eR: [],
    eSpeed: [],
    eDamage: [],
    ezVisual: [],
    ezLogical: [],
    eBrain: [],

    ePoisonT: [],
    ePoisonDps: [],
    ePoisonedOnDeath: [],
    eSpawnTriggerId: [],
    eAilments: [],

    enemySpatialHash: createSpatialHash(128),

    // Zones
    zAlive: [],
    zKind: [],
    zgxi: [],
    zgyi: [],
    zgox: [],
    zgoy: [],
    zR: [],
    zDamage: [],
    zTickEvery: [],
    zTickLeft: [],
    zTtl: [],
    zFollowPlayer: [],
    zDamagePlayer: [],
    zEnemyDamageMeta: [],
    zPlayerDamageMeta: [],

    // Projectiles
    pAlive: [],
    prHidden: [],
    pKind: 0,
    prjKind: [],
    prgxi: [],
    prgyi: [],
    prgox: [],
    prgoy: [],
    prZ: [],
    prZVisual: [],
    prZLogical: [],
    prHitsPlayer: [],
    prvx: [],
    prvy: [],
    prDamage: [],
    prDmgPhys: [],
    prDmgFire: [],
    prDmgChaos: [],
    prCritChance: [],
    prCritMulti: [],
    prChanceBleed: [],
    prChanceIgnite: [],
    prChancePoison: [],
    prR: [],
    prPierce: [],
    prIsmelee: [],
    prCone: [],
    prMeleeRange: [],
    prDirX: [],
    prDirY: [],
    prSpawnTime: [],
    prTtl: [],
    prBouncesLeft: [],
    prDamageMeta: [],
    prWallBounce: [],
    prNoCollide: [],

    prHasTarget: [],
    prTargetX: [],
    prTargetY: [],

    prStartX: [],
    prStartY: [],
    prPlayerFireX: [],
    prPlayerFireY: [],
    prMaxDist: [],

    prLastHitEnemy: [],
    prLastHitCd: [],

    prPoisonDps: [],
    prPoisonDur: [],

    prAftershockN: [],
    prAftershockDelay: [],
    prAftershockRingR: [],
    prAftershockWaves: [],
    prAftershockRingStep: [],

    prExplodeR: [],
    prExplodeDmg: [],
    prExplodeTtl: [],

    prIsOrbital: [],
    prOrbAngle: [],
    prOrbBaseRadius: [],
    prOrbBaseAngVel: [],

    prFission: [],
    prFissionCd: [],

    // Pickups
    xAlive: [],
    xKind: [],
    xgxi: [],
    xgyi: [],
    xgox: [],
    xgoy: [],
    xValue: [],
    xDropId: [],

    // VFX entities
    vfxAlive: [],
    vfxX: [],
    vfxY: [],
    vfxRadius: [],
    vfxElapsed: [],
    vfxTtl: [],
    vfxClipId: [],
    vfxLoop: [],
    vfxFollowEnemy: [],
    vfxOffsetYPx: [],
    vfxScale: [],

    // Boss / chest / magnet
    bossZoneSpawned: [],
    magnetActive: false,
    magnetTimer: 0,
    chestOpenRequested: false,

    // Floating combat text
    floatTextX: [],
    floatTextY: [],
    floatTextValue: [],
    floatTextColor: [],
    floatTextSize: [],
    floatTextTtl: [],
    floatTextIsCrit: [],
    floatTextIsPlayer: [],
    uiFloatTextSeed: 0,

    // DPS tracking
    dpsEnabled: true,
    dpsSamples: [],
    dpsTotalDamage: 0,
    dpsStartTime: 0,
    dpsRecentDamage: [],
    dpsRecentTimes: [],
    metrics: {
      dps: createDpsMetrics(),
    },
  };

  // Map-authored player spawn (SPAWN/P<number> tile)
  {
    const sp = getSpawnWorld(KENNEY_TILE_WORLD);
    const anchor = anchorFromWorld(sp.x, sp.y, KENNEY_TILE_WORLD);
    w.pgxi = anchor.gxi;
    w.pgyi = anchor.gyi;
    w.pgox = anchor.gox;
    w.pgoy = anchor.goy;

    w.pz = sp.z;
    w.pzVisual = sp.z;
    w.pzLogical = sp.h | 0;
    w.activeFloorH = sp.h | 0;
  }

  recomputeDerivedStats(w);

  return w;
}

function gridFromAnchor(gxi: number, gyi: number, gox: number, goy: number) {
  return { gx: gxi + gox, gy: gyi + goy };
}

/** Return the player's logical grid position (gx/gy) from anchors. */
export function gridAtPlayer(w: World) {
  return gridFromAnchor(w.pgxi, w.pgyi, w.pgox, w.pgoy);
}

/** Clear all queued game events for the frame. */
export function clearEvents(w: World) {
  w.events.length = 0;
}

/** Enqueue a game event for downstream systems. */
export function emitEvent(w: World, ev: GameEvent) {
  if (import.meta.env.DEV) {
    if (ev.type === "ENEMY_HIT" || ev.type === "ENEMY_KILLED" || ev.type === "PLAYER_HIT") {
      const meta = (ev as any).damageMeta as DamageMeta | undefined;
      if (!meta || !meta.category || !meta.cause || !meta.instigator) {
        console.warn("[DamageMeta] Missing/invalid damageMeta on event", ev);
      }
    }
  }
  w.events.push(ev);
}
