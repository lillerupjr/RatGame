import { RNG } from "./util/rng";
import { StageDef } from "./content/stages";
import { ITEMS } from "./content/items";
import type { GameEvent } from "./events";

export type GameState = "MENU" | "RUN" | "LEVELUP" | "LOSE" | "WIN";

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
  eType: number[]; // 1 chaser, 2 runner, 3 bruiser, 99 boss
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
      // Starter weapon
      { id: "KNIFE", level: 1, cdLeft: 0 },
    ],


    dmgMult: 1,
    fireRateMult: 1,
  };

  recomputeDerivedStats(w);
  return w;
}

export function spawnEnemy(w: World, type: number, x: number, y: number) {
  const i = w.eAlive.length;
  w.eAlive.push(true);
  w.eType.push(type);
  w.ex.push(x);
  w.ey.push(y);
  w.evx.push(0);
  w.evy.push(0);

  // Stats by type (tune later)
  if (type === 1) {
    w.eHp.push(20);
    w.eR.push(14);
    w.eSpeed.push(90);
    w.eDamage.push(10);
  } else if (type === 2) {
    w.eHp.push(12);
    w.eR.push(12);
    w.eSpeed.push(130);
    w.eDamage.push(8);
  } else {
    w.eHp.push(60);
    w.eR.push(18);
    w.eSpeed.push(70);
    w.eDamage.push(16);
  }
  return i;
}

export function spawnProjectile(
    w: World, 
    kind: number, // projectile kind: 1 knife, 2 pistol
    x: number,// x position
    y: number, // y position
    vx: number, // x velocity
    vy: number, // y velocity
    dmg: number, // damage
    r: number, // radius
    pierce: number, // pierce count
    ismelee: boolean = false, //is the projectile melee (sword slash) or an actual projectile
    coneAngle: number = Math.PI / 6, // melee cone angle
    meleeRange: number = r // melee reach distance
) {
  const i = w.pAlive.length;
  w.pAlive.push(true); // all projectiles start alive
  w.prjKind.push(kind); // projectile kind
  w.prx.push(x); // x position
  w.pry.push(y); // y position
  w.prvx.push(vx); // x velocity
  w.prvy.push(vy); // y velocity
  w.prDamage.push(dmg); // damage
  w.prR.push(r); // radius
  w.prPierce.push(pierce); // pierce count
  w.prIsmelee.push(ismelee); // is melee
  w.prCone.push(coneAngle); // cone angle
  w.prMeleeRange.push(meleeRange); // cone reach
  return i;
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
    const def = ITEMS[inst.id];
    def.apply(w, inst.level);
  }
}
export function emitEvent(w: World, e: import("./events").GameEvent) {
  w.events.push(e);
}

export function clearEvents(w: World) {
  w.events.length = 0;
}
