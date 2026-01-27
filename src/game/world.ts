// src/game/world.ts
import { RNG } from "./util/rng";
import { StageDef } from "./content/stages";
import { registry } from "./content/registry";
import type { GameEvent } from "./events";
import type { ItemId } from "./content/items";
import type { WeaponId } from "./content/weapons";
import type { EnemyType } from "./content/enemies";
import {recomputeDerivedStats} from "./stats/derivedStats";

export type GameState = "MENU" | "RUN" | "LEVELUP" | "LOSE" | "WIN";

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

  time: number;
  kills: number;

  // Player
  px: number;
  py: number;
  pvx: number;
  pvy: number;

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
  eR: number[];
  eSpeed: number[];
  eDamage: number[];

  // Projectiles
  pAlive: boolean[];
  pKind: number; // reserved
  prjKind: number[];
  prx: number[];
  pry: number[];
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

  prStartX: number[];
  prStartY: number[];
  prMaxDist: number[]; // 0 = unlimited

  // NEW: Orbital projectiles (Knuckle Ring)
  prIsOrbital: boolean[];
  prOrbAngle: number[];
  prOrbBaseRadius: number[];
  prOrbBaseAngVel: number[];

  // Pickups (XP gems)
  xAlive: boolean[];
  xx: number[];
  xy: number[];
  xValue: number[];

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
};

export function createWorld(args: { seed: number; stage: StageDef }): World {
  const w: World = {
    events: [],
    state: "MENU",
    rng: new RNG(args.seed),
    stage: args.stage,

    time: 0,
    kills: 0,

    px: 0,
    py: 0,
    pvx: 0,
    pvy: 0,

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
    eR: [],
    eSpeed: [],
    eDamage: [],

    pAlive: [],
    pKind: 0,
    prjKind: [],
    prx: [],
    pry: [],
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
    prStartX: [],
    prStartY: [],
    prMaxDist: [],

    // orbital
    prIsOrbital: [],
    prOrbAngle: [],
    prOrbBaseRadius: [],
    prOrbBaseAngVel: [],

    xAlive: [],
    xx: [],
    xy: [],
    xValue: [],

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
  };

  recomputeDerivedStats(w);
  return w;
}


export function spawnXp(w: World, x: number, y: number, value: number) {
  const i = w.xAlive.length;
  w.xAlive.push(true); // all XP gems start alive
  w.xx.push(x); // x position
  w.xy.push(y); // y position
  w.xValue.push(value); // XP value
  return i;
}


export function emitEvent(w: World, e: import("./events").GameEvent) {
  w.events.push(e);
}

export function clearEvents(w: World) {
  w.events.length = 0;
}
