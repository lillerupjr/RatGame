import { RNG } from "./util/rng";
import { StageDef } from "./content/stages";
import { registry } from "./content/registry";
import type { GameEvent } from "./events";
import type { ItemId } from "./content/items";
import type { WeaponId } from "./content/weapons";
import type { EnemyType } from "./content/enemies";

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
  items: { id: import("./content/items").ItemId; level: number }[];

  // Entities (arrays for ECS-lite)
  eAlive: boolean[];
  eType: EnemyType[]; // 1 chaser, 2 runner, 3 bruiser, 99 boss
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
  pKind: number; // reserved (not used yet)
  prjKind: number[]; // 1 knife, 2 pistol
  prx: number[];
  pry: number[];
  prvx: number[];
  prvy: number[];
  prDamage: number[];
  prR: number[];
  prPierce: number[]; // remaining pierces
  prIsmelee: boolean[]; // is melee attack
  prCone: number[]; // cone angle (radians) for melee slashes
  prMeleeRange: number[]; // reach for melee cone (distance from player)
  prDirX: number[]; // direction X for melee projectiles (locked at spawn)
  prDirY: number[]; // direction Y for melee projectiles (locked at spawn)
  prTtl: number[];    // seconds remaining

  // Pickups (XP gems)
  xAlive: boolean[];
  xx: number[];
  xy: number[];
  xValue: number[];

  prStartX: number[];
  prStartY: number[];
  prMaxDist: number[]; // 0 = unlimited
  // Progression
  level: number;
  xp: number;
  xpToNext: number;

  pendingLevelUps: number;

  // Aim (used when no target exists)
  lastAimX: number;
  lastAimY: number;

  // Player weapons (max 4)
  weapons: { id: import("./content/weapons").WeaponId; level: number; cdLeft: number }[];


  dmgMult: number;
  fireRateMult: number;

};


export function createWorld(args: { seed: number; stage: StageDef }): World {
  const w: World = {
    events: [],
    state: "MENU",
    rng: new RNG(args.seed),
    stage: args.stage,

    time: 0,
    kills: 0,
    prStartX: [],
    prStartY: [],
    prMaxDist: [], // 0 = unlimited

    px: 0,
    py: 0,
    pvx: 0,
    pvy: 0,
    baseMoveSpeed: 210,
    basePickupRadius: 70,

    // derived (will be recomputed)
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

    weapons: [
      { id: defaultStarter, level: 1, cdLeft: 0 },
    ],


    dmgMult: 1,
    fireRateMult: 1,
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


export function recomputeDerivedStats(w: World) {
  // Reset derived stats to base
  w.pSpeed = w.baseMoveSpeed;
  w.pickupRadius = w.basePickupRadius;

  // Reset multipliers
  w.dmgMult = 1;
  w.fireRateMult = 1;

  // Apply all items
  for (const inst of w.items) {
    const def = registry.item(inst.id as ItemId);
    def.apply(w, inst.level);
  }
}
export function emitEvent(w: World, e: import("./events").GameEvent) {
  w.events.push(e);
}

export function clearEvents(w: World) {
  w.events.length = 0;
}
