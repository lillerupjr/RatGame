import { World, createWorld, clearEvents } from "./world";
import { InputState, createInputState, inputSystem } from "./systems/input";
import { movementSystem } from "./systems/movement";
import { spawnSystem } from "./systems/spawn";
import { combatSystem } from "./systems/combat";
import { collisionsSystem } from "./systems/collisions";
import { projectilesSystem } from "./systems/projectiles";
import { pickupsSystem } from "./systems/pickups";
import { xpSystem } from "./systems/xp";
import { renderSystem } from "./systems/render";
import { zonesSystem } from "./systems/zones";
import { onKillExplodeSystem } from "./systems/onKillExplode";

import { getUpgradePool, UpgradeDef } from "./content/upgrades";
import { formatTimeMMSS } from "./util/time";
import type { WeaponId } from "./content/weapons";
import { registry } from "./content/registry";
import { spawnEnemy, ENEMY_TYPE } from "./factories/enemyFactory";
import { poisonSystem } from "./systems/poison";

type HudRefs = {
  root: HTMLDivElement;
  timePill: HTMLSpanElement;
  killsPill: HTMLSpanElement;
  hpPill: HTMLSpanElement;
  lvlPill: HTMLSpanElement;
};

type LevelUpRefs = {
  root: HTMLDivElement;
  choices: HTMLDivElement;
  sub: HTMLDivElement;
};

type CreateGameArgs = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hud: HudRefs;
  ui: { menuEl: HTMLDivElement; levelupEl: LevelUpRefs };
};

export function createGame(args: CreateGameArgs) {
  const input: InputState = createInputState();
  let world: World = createWorld({ seed: 1337, stage: cloneStage() });

  let currentChoices: UpgradeDef[] = [];

  const FLOORS_PER_RUN = 3;
  const TRANSITION_SECS = 5.0;

  function cloneStage() {
    // IMPORTANT: stage spawns are mutated (t is set to Infinity) at runtime.
    // So each floor needs a fresh cloned stage definition.
    const base = registry.stage("DOCKS");
    return { ...base, spawns: base.spawns.map((s) => ({ ...s })) };
  }

  function clearFloorEntities(w: World) {
    // Keep player stats/items/weapons/xp/level; wipe transient entities.
    w.eAlive = [];
    w.eType = [];
    w.ex = [];
    w.ey = [];
    w.evx = [];
    w.evy = [];
    w.eHp = [];
    w.eHpMax = [];
    w.eR = [];
    w.eSpeed = [];
    w.eDamage = [];
    w.ePoisonT = [];
    w.ePoisonDps = [];
    w.ePoisonedOnDeath = [];

    w.zAlive = [];
    w.zKind = [];
    w.zx = [];
    w.zy = [];
    w.zR = [];
    w.zDamage = [];
    w.zTickEvery = [];
    w.zTickLeft = [];
    w.zTtl = [];
    w.zFollowPlayer = [];

    w.pAlive = [];
    w.prjKind = [];
    w.prx = [];
    w.pry = [];
    w.prvx = [];
    w.prvy = [];
    w.prDamage = [];
    w.prR = [];
    w.prPierce = [];
    w.prIsmelee = [];
    w.prCone = [];
    w.prMeleeRange = [];
    w.prDirX = [];
    w.prDirY = [];
    w.prTtl = [];

    w.prStartX = [];
    w.prStartY = [];
    w.prMaxDist = [];
    w.prLastHitEnemy = [];
    w.prLastHitCd = [];

    w.prPoisonDps = [];
    w.prPoisonDur = [];

    w.prIsOrbital = [];
    w.prOrbAngle = [];
    w.prOrbBaseRadius = [];
    w.prOrbBaseAngVel = [];

    w.xAlive = [];
    w.xx = [];
    w.xy = [];
    w.xValue = [];
  }

  function bossAlive(w: World): boolean {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      if (w.eType[i] === ENEMY_TYPE.BOSS) return true;
    }
    return false;
  }

  function enterFloor(w: World, floorIndex: number) {
    w.floorIndex = floorIndex;
    w.runState = "FLOOR";
    w.floorDuration = 20; // Adjust this
    w.phaseTime = 0;
    w.transitionTime = 0;
    w.stage = cloneStage();
    clearFloorEntities(w);
  }

  function enterBoss(w: World) {
    w.runState = "BOSS";
    w.phaseTime = 0;
    w.transitionTime = 0;

    // Clean slate for the boss encounter (feels fair + deterministic).
    clearFloorEntities(w);

    const a = w.rng.range(0, Math.PI * 2);
    const r = 320;
    spawnEnemy(w, ENEMY_TYPE.BOSS, w.px + Math.cos(a) * r, w.py + Math.sin(a) * r);
  }

  function enterTransition(w: World) {
    w.runState = "TRANSITION";
    w.phaseTime = 0;
    w.transitionTime = TRANSITION_SECS;

    // Clear remaining enemies/projectiles so transition is calm.
    clearFloorEntities(w);
  }

  function completeRun(w: World) {
    w.runState = "RUN_COMPLETE";
    w.state = "WIN";

    args.ui.menuEl.hidden = false;
    args.hud.root.hidden = true;
    hideLevelUp();
    (args.ui.menuEl.querySelector(".title") as HTMLElement).textContent = "Run complete!";
    (args.ui.menuEl.querySelector("button") as HTMLButtonElement).textContent = "Restart";
  }

  function resetRun() {
    world = createWorld({
      seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      stage: cloneStage(),
    });
    currentChoices = [];
    hideLevelUp();
  }

  function startRun(starterWeapon?: WeaponId) {
    resetRun();

    // Override starter weapon if provided (from menu picker)
    if (starterWeapon) {
      world.weapons = [{ id: starterWeapon, level: 1, cdLeft: 0 }];
    }

    world.state = "RUN";
    enterFloor(world, 0);
  }

  function showLevelUp() {
    world.state = "LEVELUP";
    args.ui.levelupEl.root.hidden = false;
    args.ui.levelupEl.sub.textContent = `Choose an upgrade (${world.pendingLevelUps} pending)`;
    rollChoices();
    renderChoices();
  }

  function hideLevelUp() {
    args.ui.levelupEl.root.hidden = true;
  }

  function rollChoices() {
    const pool = getUpgradePool(world).slice();
    currentChoices = [];

    // Pick 3 unique upgrades
    while (currentChoices.length < 3 && pool.length > 0) {
      const idx = world.rng.int(0, pool.length - 1);
      currentChoices.push(pool[idx]);
      pool.splice(idx, 1);
    }
  }

  function renderChoices() {
    const container = args.ui.levelupEl.choices;
    container.innerHTML = "";

    for (const def of currentChoices) {
      const btn = document.createElement("button");
      btn.className = "choiceBtn";
      btn.dataset.upgrade = def.id;

      const titleRow = document.createElement("div");
      titleRow.className = "choiceTitle";
      const prefix = def.isEvolution ? "EVOLUTION — " : "";
      titleRow.textContent = def.getRankText
          ? `${prefix}${def.title} (${def.getRankText(world)})`
          : `${prefix}${def.title}`;

      const d = document.createElement("div");
      d.className = "choiceDesc";
      d.textContent = def.desc;

      btn.appendChild(titleRow);
      btn.appendChild(d);
      container.appendChild(btn);
    }
  }

  function hudTimeText(w: World): string {
    const floor = `F${(w.floorIndex ?? 0) + 1}/3`;
    switch (w.runState) {
      case "FLOOR":
        return `${floor} ${formatTimeMMSS(w.phaseTime)} / ${formatTimeMMSS(w.floorDuration)}`;
      case "BOSS":
        return `${floor} BOSS ${formatTimeMMSS(w.phaseTime)}`;
      case "TRANSITION":
        return `${floor} TRANSITION ${Math.ceil(w.transitionTime)}s`;
      default:
        return `${floor} ${formatTimeMMSS(w.phaseTime)}`;
    }
  }

  function applyUpgrade(def: UpgradeDef) {
    def.apply(world);
    // If an upgrade changed items/stats, ensure derived stats are up to date.
    // (Safe even if nothing changed.)
    // recomputeDerivedStats is already called by item upgrades, but keeping this is future-proof.
  }

  function update(dt: number) {
    // Always poll input (so movement is responsive immediately after closing menus)
    inputSystem(input, args.canvas);

    // Handle level-up pause
    if (world.state === "LEVELUP") {
      // HUD still updates while paused
      args.hud.timePill.textContent = hudTimeText(world);
      args.hud.killsPill.textContent = `Kills: ${world.kills}`;
      args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
      args.hud.lvlPill.textContent = `Lv: ${world.level}`;
      return;
    }

    if (world.state !== "RUN") return;

    // total run time (optional for future meta / analytics)
    world.time += dt;

    // phase time (drives FLOOR/BOSS/TRANSITION)
    world.phaseTime += dt;

    // RunState progression
    if (world.runState === "FLOOR" && world.phaseTime >= world.floorDuration) {
      enterBoss(world);
    } else if (world.runState === "BOSS") {
      // If boss was killed, advance
      if (!bossAlive(world)) {
        if (world.floorIndex >= FLOORS_PER_RUN - 1) {
          completeRun(world);
          return;
        }
        enterTransition(world);
      }
    } else if (world.runState === "TRANSITION") {
      world.transitionTime = Math.max(0, world.transitionTime - dt);
      if (world.transitionTime <= 0) {
        enterFloor(world, world.floorIndex + 1);
      }
    }

    movementSystem(world, input, dt);
    spawnSystem(world, dt);
    combatSystem(world, dt);
    projectilesSystem(world, dt);
    collisionsSystem(world, dt);
    poisonSystem(world, dt);
    onKillExplodeSystem(world, dt); // explode on kill
    zonesSystem(world, dt);
    pickupsSystem(world, dt);
    xpSystem(world, dt);

    // Clear events AFTER all consumers ran this frame
    clearEvents(world);

    // Enter level-up state if needed
    if (world.pendingLevelUps > 0) {
      showLevelUp();
      return;
    }

    // Simple lose condition
    if (world.playerHp <= 0) {
      world.runState = "GAME_OVER";
      world.state = "LOSE";
      args.ui.menuEl.hidden = false;
      args.hud.root.hidden = true;
      hideLevelUp();
      (args.ui.menuEl.querySelector(".title") as HTMLElement).textContent = "You died.";
      (args.ui.menuEl.querySelector("button") as HTMLButtonElement).textContent = "Restart";
    }

    // HUD
    args.hud.timePill.textContent = hudTimeText(world);
    args.hud.killsPill.textContent = `Kills: ${world.kills}`;
    args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
    args.hud.lvlPill.textContent = `Lv: ${world.level}`;
  }

  function render() {
    renderSystem(world, args.ctx, args.canvas);
  }

  // Menu click starts/restarts
  args.ui.menuEl.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t?.closest("button") as HTMLButtonElement | null;
    if (!btn) return;

    if (btn.id === "startBtn") {
      const starter = btn.dataset.weapon as WeaponId | undefined;

      args.ui.menuEl.hidden = true;
      args.hud.root.hidden = false;
      startRun(starter);
    }
  });

  // Level-up choice click
  args.ui.levelupEl.root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest("button") as HTMLButtonElement | null;
    if (!btn) return;
    const id = btn.dataset.upgrade;
    if (!id) return;

    const def = currentChoices.find((c) => c.id === id);
    if (!def) return;

    applyUpgrade(def);
    world.pendingLevelUps = Math.max(0, world.pendingLevelUps - 1);

    if (world.pendingLevelUps > 0) {
      args.ui.levelupEl.sub.textContent = `Choose an upgrade (${world.pendingLevelUps} pending)`;
      rollChoices();
      renderChoices();
      return;
    }

    hideLevelUp();
    world.state = "RUN";
  });

  return { update, render, startRun };
}
