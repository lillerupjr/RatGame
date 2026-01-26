import { RNG } from "./util/rng";
import { StageDef } from "./content/stages";

export type GameState = "MENU" | "RUN" | "LEVELUP" | "LOSE" | "WIN";

export type World = {
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
  pSpeed: number;
  playerHp: number;
  playerHpMax: number;
  pickupRadius: number;

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

  // Weapon timers
  knifeCd: number;
  pistolCd: number;
  dmgMult: number;
  fireRateMult: number;
};

export function createWorld(args: { seed: number; stage: StageDef }): World {
  const w: World = {
    state: "MENU",
    rng: new RNG(args.seed),
    stage: args.stage,

    time: 0,
    kills: 0,

    px: 0,
    py: 0,
    pvx: 0,
    pvy: 0,
    pSpeed: 210,
    playerHp: 100,
    playerHpMax: 100,
    pickupRadius: 70,

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

    xAlive: [],
    xx: [],
    xy: [],
    xValue: [],

    level: 1,
    xp: 0,
    xpToNext: 10,
    pendingLevelUps: 0,

    knifeCd: 0,
    pistolCd: 0,
    dmgMult: 1,
    fireRateMult: 1,
  };

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
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    dmg: number,
    r: number,
    pierce: number
) {
  const i = w.pAlive.length;
  w.pAlive.push(true);
  w.prjKind.push(kind);
  w.prx.push(x);
  w.pry.push(y);
  w.prvx.push(vx);
  w.prvy.push(vy);
  w.prDamage.push(dmg);
  w.prR.push(r);
  w.prPierce.push(pierce);
  return i;
}

export function spawnXp(w: World, x: number, y: number, value: number) {
  const i = w.xAlive.length;
  w.xAlive.push(true);
  w.xx.push(x);
  w.xy.push(y);
  w.xValue.push(value);
  return i;
}
