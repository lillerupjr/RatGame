import { World, createWorld } from "./world";
import { InputState, createInputState, inputSystem } from "./systems/input";
import { movementSystem } from "./systems/movement";
import { spawnSystem } from "./systems/spawn";
import { combatSystem } from "./systems/combat";
import { collisionsSystem } from "./systems/collisions";
import { pickupsSystem } from "./systems/pickups";
import { xpSystem } from "./systems/xp";
import { renderSystem } from "./systems/render";
import { stageDocks } from "./content/stages";
import { formatTimeMMSS } from "./util/time";

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

type UpgradeId = "DMG" | "FIRE_RATE" | "PICKUP_RADIUS" | "MOVE_SPEED";
type UpgradeDef = { id: UpgradeId; title: string; desc: string };

const UPGRADES: UpgradeDef[] = [
  { id: "DMG", title: "+Damage", desc: "Bigger numbers. Faster deaths." },
  { id: "FIRE_RATE", title: "+Fire Rate", desc: "Weapons fire more often." },
  { id: "PICKUP_RADIUS", title: "+Pickup Radius", desc: "Vacuum XP from farther away." },
  { id: "MOVE_SPEED", title: "+Move Speed", desc: "Run faster. Live longer." },
];

export function createGame(args: CreateGameArgs) {
  const input: InputState = createInputState();
  let world: World = createWorld({ seed: 1337, stage: stageDocks });

  let currentChoices: UpgradeId[] = [];

  function resetRun() {
    world = createWorld({
      seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      stage: stageDocks,
    });
    currentChoices = [];
    hideLevelUp();
  }

  function startRun() {
    resetRun();
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
    // 3 unique random choices from the 4 upgrade pool
    const pool = [...UPGRADES.map((u) => u.id)];
    currentChoices = [];
    while (currentChoices.length < 3 && pool.length > 0) {
      const idx = world.rng.int(0, pool.length - 1);
      currentChoices.push(pool[idx]);
      pool.splice(idx, 1);
    }
  }

  function renderChoices() {
    const container = args.ui.levelupEl.choices;
    container.innerHTML = "";

    for (const id of currentChoices) {
      const def = UPGRADES.find((u) => u.id === id)!;

      const btn = document.createElement("button");
      btn.className = "choiceBtn";
      btn.dataset.upgrade = id;

      const t = document.createElement("div");
      t.className = "choiceTitle";
      t.textContent = def.title;

      const d = document.createElement("div");
      d.className = "choiceDesc";
      d.textContent = def.desc;

      btn.appendChild(t);
      btn.appendChild(d);
      container.appendChild(btn);
    }
  }

  function applyUpgrade(id: UpgradeId) {
    // Conservative early-game scaling (tune later)
    switch (id) {
      case "DMG":
        world.dmgMult *= 1.15;
        break;
      case "FIRE_RATE":
        world.fireRateMult *= 1.12;
        break;
      case "PICKUP_RADIUS":
        world.pickupRadius += 18;
        break;
      case "MOVE_SPEED":
        world.pSpeed += 18;
        break;
    }
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
    collisionsSystem(world, dt);
    pickupsSystem(world, dt);
    xpSystem(world, dt);

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
    if (t?.id === "startBtn" || t?.tagName === "BUTTON") {
      args.ui.menuEl.hidden = true;
      args.hud.root.hidden = false;
      startRun();
    }
  });

  // Level-up choice click
  args.ui.levelupEl.root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest("button") as HTMLButtonElement | null;
    if (!btn) return;
    const id = btn.dataset.upgrade as UpgradeId | undefined;
    if (!id) return;

    applyUpgrade(id);
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
