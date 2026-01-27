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

import { getUpgradePool, UpgradeDef } from "./content/upgrades";
import { formatTimeMMSS } from "./util/time";
import type { WeaponId } from "./content/weapons";
import { registry } from "./content/registry";

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
  let world: World = createWorld({ seed: 1337, stage: registry.stage("DOCKS") });

  let currentChoices: UpgradeDef[] = [];

  function resetRun() {
    world = createWorld({
      seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      stage: registry.stage("DOCKS"),
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
      args.hud.timePill.textContent = formatTimeMMSS(world.time);
      args.hud.killsPill.textContent = `Kills: ${world.kills}`;
      args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
      args.hud.lvlPill.textContent = `Lv: ${world.level}`;
      return;
    }

    if (world.state !== "RUN") return;

    world.time += dt;

    movementSystem(world, input, dt);
    spawnSystem(world, dt);
    combatSystem(world, dt);
    projectilesSystem(world, dt);
    collisionsSystem(world, dt);
    zonesSystem(world, dt);
    pickupsSystem(world, dt);
    xpSystem(world, dt);
    // Clear events AFTER all consumers ran this frame
    clearEvents(world)

    // Enter level-up state if needed
    if (world.pendingLevelUps > 0) {
      showLevelUp();
      return;
    }

    // Simple lose condition
    if (world.playerHp <= 0) {
      world.state = "LOSE";
      args.ui.menuEl.hidden = false;
      args.hud.root.hidden = true;
      hideLevelUp();
      (args.ui.menuEl.querySelector(".title") as HTMLElement).textContent = "You died.";
      (args.ui.menuEl.querySelector("button") as HTMLButtonElement).textContent = "Restart";
    }

    // HUD
    args.hud.timePill.textContent = formatTimeMMSS(world.time);
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
