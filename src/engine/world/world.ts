// src/game/world.ts
import { RNG } from "../../game/util/rng";
import { createSpatialHash, type SpatialHash } from "../../game/util/spatialHash";
import type { StageDef } from "../../game/content/stages";
import type { GameEvent } from "../../game/events";
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
import type { ZoneTrialObjectiveState } from "../../game/objectives/zoneObjectiveTypes";

import type { WeaponId } from "../../game/content/weapons";

/**
 * NOTE:
 * game.ts already uses world.state = "MAP", so GameState MUST include "MAP".
 */
export type GameState =
    | "MENU"
    | "RUN"
    | "MAP"
    | "CHEST"
    | "LEVELUP"
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
  showBuildingMaskDebug: boolean;
  buildingMaskDebugView: "OFF" | "SOURCE" | "INVERSE" | "COMBINED";
  occlusionMaskCanvas?: HTMLCanvasElement | null;
  occlusionMaskCtx?: CanvasRenderingContext2D | null;
  inverseBuildingSliceMaskCanvas?: HTMLCanvasElement | null;
  inverseBuildingSliceMaskCtx?: CanvasRenderingContext2D | null;
  combinedOcclusionMaskCanvas?: HTMLCanvasElement | null;
  combinedOcclusionMaskCtx?: CanvasRenderingContext2D | null;
  debugBuildingMaskCanvas?: HTMLCanvasElement | null;
  debugBuildingMaskCtx?: CanvasRenderingContext2D | null;
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

export type World = {
  // -------------------------
  // Core
  // -------------------------
  state: GameState;
  runState: RunState;
  rng: RNG;

  // Event queue (audio, hits, kills, pickups, etc.)
  events: GameEvent[];

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
  zoneTrialObjective: ZoneTrialObjectiveState | null;

  // -------------------------
  // Stage / floor
  // -------------------------
  stage: StageDef | null;
  stageId: StageId;
  stageTime: number;
  runSeed: number;

  // Floor index (0..2) and timers
  floorIndex: number;
  floorArchetype: FloorArchetype;
  currentFloorIntent: FloorIntent | null;
  floorDuration: number; // seconds until boss for this stage
  phaseTime: number; // seconds since current phase began
  transitionTime: number; // seconds remaining in TRANSITION

  // Total run time
  time: number;
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
    xpMult: number;
  };

  // Legacy map compatibility (if you still use it)
  runMap?: any;
  mapCurrentNodeId?: string | null;
  mapPendingNextFloorIndex?: number;

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
  gold: number;

  // Vendor economy (scaffold)
  vendorOffers: { kind: "RELIC" | "UPGRADE" | "HEAL" | "REROLL"; id: string; cost: number }[];
  vendorPurchases: string[];
  pendingAdvanceToNextFloor: boolean;
  relics: string[];
  relicEffects: { xpMult: number; hpBonus: number };
  npcs: NpcActor[];
  neutralMobs: NeutralAnimatedMob[];

  // -------------------------
  // Weapons + items
  // -------------------------
  weapons: { id: WeaponId; level: number; cdLeft: number }[];
  items: { id: any; level: number }[];
  combatCardIds: string[];
  primaryWeaponCdLeft: number;

  // -------------------------
  // XP / Level
  // -------------------------
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevelUps: number;

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
  eHp: number[];
  eHpMax: number[];
  eR: number[];
  eSpeed: number[];
  eDamage: number[];
  ezVisual: number[];
  ezLogical: number[];

  // Poison (enemy status)
  ePoisonT: number[];
  ePoisonDps: number[];
  ePoisonedOnDeath: boolean[];
  eSpawnTriggerId: (string | undefined)[];

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
  prR: number[];
  prPierce: number[];
  prIsmelee: boolean[];
  prCone: number[];
  prMeleeRange: number[];
  prDirX: number[];
  prDirY: number[];
  prTtl: number[];
  prBouncesLeft: number[];

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

  // Boss reward gating
  bossRewardPending: boolean;
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
  floatTextTtl: number[];
  floatTextIsCrit: boolean[];

  // -------------------------
  // DPS tracking (render.ts expects these)
  // -------------------------
  dpsEnabled: boolean;
  dpsSamples: { t: number; dmg: number }[];
  dpsTotalDamage: number;
  dpsStartTime: number;
  dpsRecentDamage: number[];
  dpsRecentTimes: number[];
};

export type CreateWorldArgs = {
  seed?: number;
  stage: StageDef;
};

function cloneStage(stage: StageDef): StageDef {
  // IMPORTANT: stage spawns are mutated at runtime (t -> Infinity), so clone them.
  return { ...stage, spawns: stage.spawns.map((s) => ({ ...s })) };
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
    zoneTrialObjective: null,

    // Stage / floor
    stage,
    stageId: stage.id,
    stageTime: 0,
    runSeed: args.seed ?? 1337,

    floorIndex: 0,
    floorArchetype: "SURVIVE",
    currentFloorIntent: null,
    floorDuration: stage.duration,
    phaseTime: 0,
    transitionTime: 0,

    time: 0,
    lighting: {
      darknessAlpha: 0.5,
      ambientTint: undefined,
      ambientTintStrength: 0,
      groundYScale: 0.65,
      occlusionEnabled: true,
      showBuildingMaskDebug: false,
      buildingMaskDebugView: "OFF",
      occlusionMaskCanvas: null,
      occlusionMaskCtx: null,
      inverseBuildingSliceMaskCanvas: null,
      inverseBuildingSliceMaskCtx: null,
      combinedOcclusionMaskCanvas: null,
      combinedOcclusionMaskCtx: null,
      debugBuildingMaskCanvas: null,
      debugBuildingMaskCtx: null,
    },

    // Delve / route
    delveMap: null,
    delveDepth: 1,
    delveScaling: {
      hpMult: 1,
      damageMult: 1,
      spawnRateMult: 1,
      xpMult: 1,
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

    baseMoveSpeed: 300,
    basePickupRadius: 90,

    pSpeed: 260,
    pickupRadius: 90,

    playerHp: 100,
    playerHpMax: 100,

    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,

    baseCritChance: 0.05,
    critChanceBonus: 0,
    critMultiplier: 2.0,

    kills: 0,
    gold: 0,
    vendorOffers: [],
    vendorPurchases: [],
    pendingAdvanceToNextFloor: false,
    relics: [],
    relicEffects: {
      xpMult: 1,
      hpBonus: 0,
    },
    npcs: [],
    neutralMobs: [],

    // Weapons + items
    weapons: [],
    items: [],
    combatCardIds: [],
    primaryWeaponCdLeft: 0,

    // XP / Level
    level: 1,
    xp: 0,
    xpToNext: 6,
    pendingLevelUps: 0,

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
    eHp: [],
    eHpMax: [],
    eR: [],
    eSpeed: [],
    eDamage: [],
    ezVisual: [],
    ezLogical: [],

    ePoisonT: [],
    ePoisonDps: [],
    ePoisonedOnDeath: [],
    eSpawnTriggerId: [],

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
    prR: [],
    prPierce: [],
    prIsmelee: [],
    prCone: [],
    prMeleeRange: [],
    prDirX: [],
    prDirY: [],
    prTtl: [],
    prBouncesLeft: [],
    prWallBounce: [],
    prNoCollide: [],

    prHasTarget: [],
    prTargetX: [],
    prTargetY: [],

    prStartX: [],
    prStartY: [],
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

    // Boss / chest / magnet
    bossRewardPending: false,
    bossZoneSpawned: [],
    magnetActive: false,
    magnetTimer: 0,
    chestOpenRequested: false,

    // Floating combat text
    floatTextX: [],
    floatTextY: [],
    floatTextValue: [],
    floatTextColor: [],
    floatTextTtl: [],
    floatTextIsCrit: [],

    // DPS tracking
    dpsEnabled: true,
    dpsSamples: [],
    dpsTotalDamage: 0,
    dpsStartTime: 0,
    dpsRecentDamage: [],
    dpsRecentTimes: [],
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
  w.events.push(ev);
}
