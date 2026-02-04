// src/game/world.ts
import { RNG } from "./util/rng";
import { createSpatialHash, type SpatialHash } from "./util/spatialHash";
import type { StageDef } from "./content/stages";
import type { GameEvent } from "./events";
import { KENNEY_TILE_WORLD } from "./visual/kenneyTiles";
import { getSpawnWorld } from "./map/kenneyMap";

import type { WeaponId } from "./content/weapons";

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

export type World = {
  // -------------------------
  // Core
  // -------------------------
  state: GameState;
  runState: RunState;
  rng: RNG;

  // Event queue (audio, hits, kills, pickups, etc.)
  events: GameEvent[];

  // -------------------------
  // Stage / floor
  // -------------------------
  stage: StageDef | null;
  stageId: StageId;
  stageTime: number;

  // Floor index (0..2) and timers
  floorIndex: number;
  floorDuration: number; // seconds until boss for this stage
  phaseTime: number; // seconds since current phase began
  transitionTime: number; // seconds remaining in TRANSITION

  // Total run time
  time: number;

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
  px: number;
  py: number;

  // Continuous elevation (Milestone B/C). Typically map-driven.
  pz: number;

  pvx: number;
  pvy: number;

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

  // -------------------------
  // Weapons + items
  // -------------------------
  weapons: { id: WeaponId; level: number; cdLeft: number }[];
  items: { id: any; level: number }[];

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
  ex: number[];
  ey: number[];
  evx: number[];
  evy: number[];
  eHp: number[];
  eHpMax: number[];
  eR: number[];
  eSpeed: number[];
  eDamage: number[];

  // Poison (enemy status)
  ePoisonT: number[];
  ePoisonDps: number[];
  ePoisonedOnDeath: boolean[];

  // Enemy spatial hash (perf)
  enemySpatialHash: SpatialHash;

  // -------------------------
  // Zones
  // -------------------------
  zAlive: boolean[];
  zKind: number[];
  zx: number[];
  zy: number[];
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
  prx: number[];
  pry: number[];

  // Milestone C: projectile height (continuous)
  prZ: number[];
  // Milestone C: can this projectile hit the player?
  prHitsPlayer: boolean[];

  prvx: number[];
  prvy: number[];
  prDamage: number[];
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
  xx: number[];
  xy: number[];
  xValue: number[];
  xDropId: string[];

  // Boss reward gating
  bossRewardPending: boolean;

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

export function createWorld(args: CreateWorldArgs): World {
  const rng = new RNG((args.seed ?? 1337) >>> 0);

  const stage = cloneStage(args.stage);

  const w: World = {
    // Core
    state: "MENU",
    runState: "FLOOR",
    rng,
    events: [],

    // Stage / floor
    stage,
    stageId: stage.id,
    stageTime: 0,

    floorIndex: 0,
    floorDuration: stage.duration,
    phaseTime: 0,
    transitionTime: 0,

    time: 0,

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
    px: 0,
    py: 0,
    pz: 0,
    pvx: 0,
    pvy: 0,
    playerR: 18,

    activeFloorH: 0,

    baseMoveSpeed: 260,
    basePickupRadius: 90,

    pSpeed: 260,
    pickupRadius: 90,

    playerHp: 100,
    playerHpMax: 100,

    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,

    baseCritChance: 0.25,
    critChanceBonus: 0,
    critMultiplier: 2.0,

    kills: 0,

    // Weapons + items
    weapons: [],
    items: [],

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
    ex: [],
    ey: [],
    evx: [],
    evy: [],
    eHp: [],
    eHpMax: [],
    eR: [],
    eSpeed: [],
    eDamage: [],

    ePoisonT: [],
    ePoisonDps: [],
    ePoisonedOnDeath: [],

    enemySpatialHash: createSpatialHash(128),

    // Zones
    zAlive: [],
    zKind: [],
    zx: [],
    zy: [],
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
    prx: [],
    pry: [],
    prZ: [],
    prHitsPlayer: [],
    prvx: [],
    prvy: [],
    prDamage: [],
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
    xx: [],
    xy: [],
    xValue: [],
    xDropId: [],

    // Boss / chest / magnet
    bossRewardPending: false,
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
    w.px = sp.x;
    w.py = sp.y;
    w.pz = sp.z;
    w.activeFloorH = sp.h | 0;
  }

  return w;
}


export function clearEvents(w: World) {
  w.events.length = 0;
}

export function emitEvent(w: World, ev: GameEvent) {
  w.events.push(ev);
}
