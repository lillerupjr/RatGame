// src/game/world.ts
import { RNG } from "./util/rng";
import { StageDef } from "./content/stages";
import { registry } from "./content/registry";
import type { GameEvent } from "./events";
import type { ItemId } from "./content/items";
import type { WeaponId } from "./content/weapons";
import type { EnemyType } from "./content/enemies";
import { recomputeDerivedStats } from "./stats/derivedStats";
import { createSpatialHash, type SpatialHash } from "./util/spatialHash";

export type GameState = "MENU" | "RUN" | "MAP" | "LEVELUP" | "CHEST" | "LOSE" | "WIN";

// Run progression state machine (active only while state === "RUN")
export type RunState = "FLOOR" | "BOSS" | "TRANSITION" | "GAME_OVER" | "RUN_COMPLETE";

const defaultStarter = ((): WeaponId => {
  const ids = registry.weaponIds();
  if (ids.includes("KNIFE" as WeaponId)) return "KNIFE";
  return ids[0] ?? "KNIFE";
})();

export type World = {
  events: GameEvent[];
  state: GameState;
  rng: RNG;
  stage: StageDef;
  floorDuration: number;

  // Route map (Slay-the-Spire style, shown between floors)
  runMap: any; // typed in game.ts via map module to avoid circular deps here
  mapCurrentNodeId: string | null;
  mapPendingNextFloorIndex: number; // which floor index we are selecting for

  // Delve system (infinite progression)
  delveMap: any; // DelveMap type, avoiding circular deps
  delveDepth: number;  // current depth (1 = starting depth)
  delveScaling: {
    hpMult: number;
    damageMult: number;
    spawnRateMult: number;
    xpMult: number;
  };

  // Run structure
  runState: RunState;
  floorIndex: number;      // 0..2 (3 floors) - now also used as depth indicator
  phaseTime: number;       // seconds since current phase started (FLOOR/BOSS/TRANSITION)
  transitionTime: number;  // seconds remaining in TRANSITION

  time: number;
  kills: number;

  // Player
  px: number;
  py: number;
  // Player elevation in "height levels" (0/1/2...). For now this is map-driven.
  pz: number;

  pvx: number;
  pvy: number;
  // Player collision radius (shared by render/collisions/zones)
  playerR: number;

  // Active floor height level (only this height is rendered/interactive; stairs are a special case)
  activeFloorH: number;

  // Base stats (never modified directly by upgrades)
  baseMoveSpeed: number;
  basePickupRadius: number;

  // Derived stats (recomputed from items)
  pSpeed: number;
  pickupRadius: number;

  playerHp: number;
  playerHpMax: number;

  // Items (max 4)
  items: { id: ItemId; level: number }[];

  // Entities (arrays for ECS-lite)
  eAlive: boolean[];
  eType: EnemyType[];
  ex: number[];
  ey: number[];
  evx: number[];
  evy: number[];
  eHp: number[];
  eHpMax: number[]; // NEW
  eR: number[];
  eSpeed: number[];
  eDamage: number[];

  // NEW: Poison status
  ePoisonT: number[];    // seconds remaining
  ePoisonDps: number[];  // damage per second
  ePoisonedOnDeath: boolean[];

  // Zones (auras / ground effects)
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

  // NEW: zones can optionally damage the player (boss hazards)
  zDamagePlayer: number[];

  // Projectiles
  pAlive: boolean[];
  pKind: number; // reserved
  prjKind: number[];
  prx: number[];
  pry: number[];
  // Milestone C: projectile height (continuous Z)
  prz: number[];
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
  // If true, projectile also bounces off the screen edges (camera view bounds).
  prWallBounce: boolean[];

  // NEW: projectiles that should not collide with enemies (Bazooka rocket)
  prNoCollide: boolean[];

  // NEW: static target + explode-on-arrival
  prHasTarget: boolean[];
  prTargetX: number[];
  prTargetY: number[];

  prStartX: number[];
  prStartY: number[];
  prMaxDist: number[]; // 0 = unlimited
  prLastHitEnemy: number[]; // last enemy index hit
  prLastHitCd: number[];    // seconds remaining until it can hit that same enemy again


  prPoisonDps: number[];  // NEW
  prPoisonDur: number[];  // NEW

  // NEW: Bazooka evolution aftershock payload (index-aligned with projectiles)
  prAftershockN: number[];       // 0 = none
  prAftershockDelay: number[];   // seconds
  prAftershockRingR: number[];   // radius around initial explosion
  prAftershockWaves: number[];
  prAftershockRingStep: number[];


  // NEW: explosion payload (bazooka etc.)
  prExplodeR: number[];     // 0 = no explosion
  prExplodeDmg: number[];   // damage per tick (we'll tick once instantly)
  prExplodeTtl: number[];   // visual TTL for the explosion ring


  // NEW: Orbital projectiles (Knuckle Ring)
  prIsOrbital: boolean[];
  prOrbAngle: number[];
  prOrbBaseRadius: number[];
  prOrbBaseAngVel: number[];

  // NEW: Nuclear Fission (projectile-projectile collision spawns new projectiles)
  prFission: boolean[];     // true = this projectile can fission
  prFissionCd: number[];    // cooldown before it can fission again (prevents infinite spawns)

  // Pickups (XP gems + drops)
  // xKind: 1 = XP, 2 = CHEST
  xAlive: boolean[];
  xKind: number[];
  xx: number[];
  xy: number[];
  xValue: number[];     // XP amount for XP gems, 0 for chests
  xDropId: string[];    // "" for XP gems, "BOSS_CHEST" for chests

  // Boss reward gating (prevents transition clearing the chest)
  bossRewardPending: boolean;

  // Magnet effect (pulls all XP to player, e.g., after boss kill)
  magnetActive: boolean;
  magnetTimer: number;  // seconds remaining

  // Chest pickup handshake (system -> game.ts)
  chestOpenRequested: boolean;

  // Progression
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevelUps: number;

  // Aim (used when no target exists)
  lastAimX: number;
  lastAimY: number;

  // Player weapons (max 4)
  weapons: { id: WeaponId; level: number; cdLeft: number }[];

  // Derived multipliers
  dmgMult: number;
  fireRateMult: number;

  // NEW: for orbit weapons/items
  areaMult: number;
  durationMult: number;

  // Critical hit stats
  baseCritChance: number;  // base crit chance (0.25 = 25%)
  critChanceBonus: number; // bonus crit chance from items
  critMultiplier: number;  // crit damage multiplier (default 2.0)

  // Floating combat text
  floatTextX: number[];
  floatTextY: number[];
  floatTextValue: number[];
  floatTextColor: string[];
  floatTextTtl: number[];
  floatTextIsCrit: boolean[];

  // DPS Tracking
  dpsEnabled: boolean;        // Toggle for DPS meter display
  dpsTotalDamage: number;     // Total damage dealt
  dpsStartTime: number;       // When DPS tracking started
  dpsRecentDamage: number[];  // Damage samples for recent DPS (last few seconds)
  dpsRecentTimes: number[];   // Timestamps for recent samples

  // Spatial hash for efficient collision detection
  enemySpatialHash: SpatialHash;
};

export function createWorld(args: { seed: number; stage: StageDef }): World {

  const w: World = {
    events: [],
    state: "MENU",
    rng: new RNG(args.seed),

    // IMPORTANT: stage spawns are mutated at runtime (t -> Infinity), so clone them.
    stage: { ...args.stage, spawns: args.stage.spawns.map((s) => ({ ...s })) },

    runState: "FLOOR",
    floorIndex: 0,
    phaseTime: 0,
    transitionTime: 0,
    floorDuration: 0,

    // Map / route
    runMap: null,
    mapCurrentNodeId: null,
    mapPendingNextFloorIndex: 0,

    // Delve system
    delveMap: null,
    delveDepth: 1,
    delveScaling: {
      hpMult: 1,
      damageMult: 1,
      spawnRateMult: 1,
      xpMult: 1,
    },

    time: 0,
    kills: 0,

    px: 0,
    py: 0,
    // map-driven elevation (Milestone B)
    pz: 0,

    pvx: 0,
    pvy: 0,
    playerR: 14,

    // map-driven "active floor" (Milestone B)
    activeFloorH: 0,

    baseMoveSpeed: 210,
    basePickupRadius: 70,

    // derived
    pSpeed: 210,
    pickupRadius: 70,

    playerHp: 100,
    playerHpMax: 100,

    items: [],

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

    pAlive: [],
    pKind: 0,
    prjKind: [],
    prx: [],
    pry: [],
    prvx: [],
    // Milestone C
    prz: [],
    prvy: [],
    prDamage: [],
    prR: [],

    prPierce: [],
    prWallBounce: [],

    // NEW
    prNoCollide: [],
    prHasTarget: [],
    prTargetX: [],
    prTargetY: [],

    prIsmelee: [],
    prCone: [],
    prMeleeRange: [],

    prDirX: [],
    prDirY: [],
    prTtl: [],
    prBouncesLeft: [],

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

    xAlive: [],
    xKind: [],
    xx: [],
    xy: [],
    xValue: [],
    xDropId: [],

    bossRewardPending: false,
    magnetActive: false,
    magnetTimer: 0,
    chestOpenRequested: false,
    level: 1,
    xp: 0,
    xpToNext: 10,
    pendingLevelUps: 0,

    lastAimX: 1,
    lastAimY: 0,

    weapons: [{ id: defaultStarter, level: 1, cdLeft: 0 }],

    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,

    // Critical hit stats
    baseCritChance: 0.25,  // 25% base crit chance
    critChanceBonus: 0,
    critMultiplier: 2.0,

    // Floating combat text
    floatTextX: [],
    floatTextY: [],
    floatTextValue: [],
    floatTextColor: [],
    floatTextTtl: [],
    floatTextIsCrit: [],

    // DPS Tracking (set dpsEnabled to false to disable)
    dpsEnabled: true,      // Toggle this to show/hide DPS meter
    dpsTotalDamage: 0,
    dpsStartTime: 0,
    dpsRecentDamage: [],
    dpsRecentTimes: [],

    // Spatial hash for efficient collision detection
    enemySpatialHash: createSpatialHash(128),
  };

  // Ensure derived stats consistent with items (even if empty).
  recomputeDerivedStats(w);

  return w;
}

export function emitEvent(w: World, e: GameEvent) {
  w.events.push(e);
}

export function clearEvents(w: World) {
  w.events.length = 0;
}
