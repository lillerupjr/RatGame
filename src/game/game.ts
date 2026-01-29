// src/game/game.ts
import { World, createWorld, clearEvents, emitEvent } from "./world";

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
import { bossSystem } from "./systems/boss";
import { audioSystem } from "./systems/audio";
import { preloadSfx } from "./audio/sfx";

import { getUpgradePool, UpgradeDef } from "./content/upgrades";
import { formatTimeMMSS } from "./util/time";
import type { WeaponId } from "./content/weapons";
import { registry } from "./content/registry";
import { spawnEnemy, ENEMY_TYPE } from "./factories/enemyFactory";
import { poisonSystem } from "./systems/poison";
import { recomputeDerivedStats } from "./stats/derivedStats";
import {buildStaticRunMap, getReachable, type RunMap, type MapNode} from "./map/runMap";
import { preloadPlayerSprites } from "./visual/playerSprites";
import { preloadBackgrounds } from "./visual/background";
import { getProjectileSpriteByKind, preloadProjectileSprites } from "./visual/projectileSprites";
import { setMusicStage, stopMusic } from "./audio/music";


type HudRefs = {
  root: HTMLDivElement;
  timePill: HTMLSpanElement;
  killsPill: HTMLSpanElement;
  hpPill: HTMLSpanElement;
  lvlPill: HTMLSpanElement;

  // NEW: inventory HUD
  weaponSlots: HTMLDivElement;
  itemSlots: HTMLDivElement;
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
  ui: {
    menuEl: HTMLDivElement;

    // Run end overlay (WIN / LOSE)
    endEl: {
      root: HTMLDivElement;
      title: HTMLDivElement;
      sub: HTMLDivElement;
      btn: HTMLButtonElement;
    };

    levelupEl: {
      root: HTMLDivElement;
      choices: HTMLDivElement;
      sub: HTMLDivElement;
    };
    mapEl: {
      root: HTMLDivElement;
      sub: HTMLDivElement;
      svg: SVGSVGElement;
      hit: HTMLDivElement;
    };
  };
};


export function createGame(args: CreateGameArgs) {

  const input: InputState = createInputState();
  let world: World = createWorld({ seed: 1337, stage: cloneStage("DOCKS") });
  setMusicStage("DOCKS");

  preloadBackgrounds();
  preloadPlayerSprites();
  preloadProjectileSprites();
  preloadSfx();


  let currentChoices: UpgradeDef[] = [];

  const FLOORS_PER_RUN = 3;
  const TRANSITION_SECS = 0;

  function cloneStage(stageId: "DOCKS" | "SEWERS" | "CHINATOWN") {
    // IMPORTANT: stage spawns are mutated (t is set to Infinity) at runtime.
    // So each floor needs a fresh cloned stage definition.
    const base = registry.stage(stageId);
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
    w.zDamagePlayer = [];

    // if your World has zDamagePlayer, keep this reset (safe even if unused)
    // @ts-ignore
    if ("zDamagePlayer" in w) (w as any).zDamagePlayer = [];

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
    // NEW: bounce mechanic arrays must be cleared too (keep index alignment!)
    // @ts-ignore
    if ("prBouncesLeft" in w) (w as any).prBouncesLeft = [];
    // @ts-ignore
    if ("prWallBounce" in w) (w as any).prWallBounce = [];
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

    // NEW: bazooka evolution aftershock payload
    (w as any).prAftershockN = [];
    (w as any).prAftershockDelay = [];
    (w as any).prAftershockRingR = [];
    (w as any).prAftershockWaves = [];
    (w as any).prAftershockRingStep = [];

    // NEW: explosion payload
    (w as any).prExplodeR = [];
    (w as any).prExplodeDmg = [];
    (w as any).prExplodeTtl = [];

    w.prIsOrbital = [];
    w.prOrbAngle = [];
    w.prOrbBaseRadius = [];
    w.prOrbBaseAngVel = [];

    // NEW: bouncer arrays must stay index-aligned with all projectile arrays
    (w as any).prBouncesLeft = [];
    (w as any).prWallBounce = [];

    w.xAlive = [];
    w.xKind = [];
    w.xx = [];
    w.xy = [];
    w.xValue = [];
    w.xDropId = [];
  }

  function bossAlive(w: World): boolean {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      if (w.eType[i] === ENEMY_TYPE.BOSS) return true;
    }
    return false;
  }

  function enterFloor(w: World, floorIndex: number, stageId?: string) {
    w.floorIndex = floorIndex;
    w.runState = "FLOOR";
    w.phaseTime = 0;
    w.transitionTime = 0;

    // If stageId provided (map-driven), use it; otherwise fallback (legacy behavior).
    const sid =
        stageId ??
        (floorIndex === 0 ? "DOCKS" : floorIndex === 1 ? "SEWERS" : "CHINATOWN");

    w.stage = cloneStage(sid as any);
    setMusicStage(sid as any);

    w.stage = cloneStage(sid as any);

    // Drive floor timing from stage
    w.floorDuration = w.stage.duration;

    clearFloorEntities(w);

    emitEvent(w, { type: "SFX", id: "FLOOR_START", vol: 0.9, rate: 1 });
  }

  function enterBoss(w: World) {
    w.runState = "BOSS";
    w.phaseTime = 0;
    w.transitionTime = 0;

    emitEvent(w, { type: "SFX", id: "BOSS_START", vol: 1.0, rate: 1 });

    // Ensure boss reward gate is reset for this encounter (if present on World)
    (w as any).bossRewardPending = false;
    (w as any).chestOpenRequested = false;

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
    // WIN CONDITION: beat floor 3 boss (i.e., floorIndex 2) AFTER boss chest is collected.
    w.runState = "RUN_COMPLETE";
    w.state = "WIN";

    args.ui.endEl.title.textContent = "Run Complete";
    args.ui.endEl.sub.textContent =
        `You beat the floor 3 boss.\n` +
        `Time: ${formatTimeMMSS(w.time)} · Kills: ${w.kills}`;

    args.ui.endEl.root.hidden = false;
    args.ui.menuEl.hidden = true;
    args.hud.root.hidden = true;
    hideLevelUp();
  }


  function resetRun() {
    world = createWorld({
      seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      stage: cloneStage("DOCKS"),
    });
    currentChoices = [];
    hideLevelUp();
  }

  function startRun(starterWeapon?: WeaponId) {
    resetRun();

    if (starterWeapon) {
      world.weapons = [{ id: starterWeapon, level: 1, cdLeft: 0 }];
    }

    // Build act graph (static for now; later this becomes the generator output)
    const g = buildStaticRunMap() as RunMap;
    (world as any).runMap = g;
    (world as any).mapCurrentNodeId = null;
    (world as any).mapPendingNextFloorIndex = 0;

    // Pick starting node
    showMap("Pick a starting location.");
  }


  function showLevelUp() {
    world.state = "LEVELUP";
    args.ui.levelupEl.root.hidden = false;
    (args.ui.levelupEl.root.querySelector(".title") as HTMLElement).textContent = "Level Up";
    args.ui.levelupEl.sub.textContent = `Choose an upgrade (${world.pendingLevelUps} pending)`;
    rollChoices();
    renderChoices();
  }

  function showMap(subText: string) {
    world.state = "MAP";
    args.ui.mapEl.root.hidden = false;
    args.hud.root.hidden = true;

    args.ui.mapEl.sub.textContent = subText;

    const g = (world as any).runMap as RunMap;
    const fromId = (world as any).mapCurrentNodeId as string | null;

    // Reachable set (clickable)
    const reachable = new Set(getReachable(g, fromId).map((n) => n.id));

    // --- Layout: convert node.row/col into SVG + percent positions ---
    // Fixed grid layout (future-proof): always use g.cols x g.rows for positioning,
    // even if we currently have only 3 nodes.
    const cols = Math.max(1, g.cols | 0);
    const rows = Math.max(1, g.rows | 0);

    // Safe clamp in case a node has col/row outside the grid
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // Visual margins in SVG coords (1000x520)
    const x0 = 140, x1 = 860;
    const y0 = 90,  y1 = 430;

    const pos = new Map<string, { x: number; y: number }>();
    for (const n of g.nodes) {
      const c = clamp(n.col | 0, 0, cols - 1);
      const r = clamp(n.row | 0, 0, rows - 1);

      const tx = cols > 1 ? c / (cols - 1) : 0.5;
      const ty = rows > 1 ? r / (rows - 1) : 0.5;

      const x = x0 + (x1 - x0) * tx;
      const y = y0 + (y1 - y0) * ty;

      pos.set(n.id, { x, y });
    }


    // --- Draw SVG edges + nodes (visuals) ---
    const svg = args.ui.mapEl.svg;
    const edgeLines = g.edges
        .map((e) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return "";
          return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round" />`;
        })
        .join("");

    const nodeCircles = g.nodes
        .map((n) => {
          const p = pos.get(n.id)!;
          const isReach = reachable.has(n.id);
          const isChosen = (world as any).mapCurrentNodeId === n.id;

          const fill = isChosen
              ? "rgba(255,255,255,0.32)"
              : isReach
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.10)";

          const stroke = isReach
              ? "rgba(255,255,255,0.42)"
              : "rgba(255,255,255,0.18)";

          return `
        <circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="4" />
        <text x="${p.x}" y="${p.y + 52}" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.92)" font-weight="800">${n.title}</text>
      `;
        })
        .join("");

    svg.innerHTML = `
    <rect x="0" y="0" width="1000" height="520" fill="rgba(0,0,0,0)" />
    ${edgeLines}
    ${nodeCircles}
  `;

    // --- Hit layer buttons (clickable, but we show all nodes) ---
    const hit = args.ui.mapEl.hit;
    hit.innerHTML = "";

    // Convert SVG coords to % so it scales with the container.
    const toPct = (x: number, y: number) => ({ left: (x / 1000) * 100, top: (y / 520) * 100 });

    for (const n of g.nodes) {
      const p = pos.get(n.id)!;
      const { left, top } = toPct(p.x, p.y);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mapHitBtn";
      btn.dataset.nodeId = n.id;
      btn.style.left = `${left}%`;
      btn.style.top = `${top}%`;

      const isReach = reachable.has(n.id) || (!fromId && reachable.has(n.id));
      btn.disabled = !isReach;

      btn.innerHTML = `
      <div class="mapHitTitle">${n.title}</div>
      <div class="mapHitDesc">${btn.disabled ? "Locked" : "Select"} · Boss at end</div>
    `;

      hit.appendChild(btn);
    }
  }

  function hideMap() {
    args.ui.mapEl.root.hidden = true;
    args.hud.root.hidden = false;
  }


  function showChestPopup(message: string) {
    world.state = "CHEST";
    args.ui.levelupEl.root.hidden = false;
    (args.ui.levelupEl.root.querySelector(".title") as HTMLElement).textContent = "Boss Chest";
    args.ui.levelupEl.sub.textContent = message;

    const container = args.ui.levelupEl.choices;
    container.innerHTML = "";

    const btn = document.createElement("button");
    btn.className = "choiceBtn";
    btn.dataset.chestContinue = "1";

    const titleRow = document.createElement("div");
    titleRow.className = "choiceTitle";
    titleRow.textContent = "Continue";

    const d = document.createElement("div");
    d.className = "choiceDesc";
    d.textContent = "Resume the run.";

    btn.appendChild(titleRow);
    btn.appendChild(d);
    container.appendChild(btn);
  }

  function hideLevelUp() {
    args.ui.levelupEl.root.hidden = true;
    (args.ui.levelupEl.root.querySelector(".title") as HTMLElement).textContent = "Level Up";
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
    // recomputeDerivedStats is already called by item upgrades, but keeping this is future-proof.
  }

  // ----- HUD inventory helpers -----
  function renderSlots(
      container: HTMLDivElement,
      insts: Array<{ id: any; level: number }>,
      getTitle: (id: any) => string
  ) {
    const slots = Array.from(container.querySelectorAll<HTMLElement>(".slot"));

    for (let i = 0; i < 4; i++) {
      const slot = slots[i];
      if (!slot) continue;

      const titleEl = slot.querySelector(".slotTitle") as HTMLElement | null;
      const subEl = slot.querySelector(".slotSub") as HTMLElement | null;

      const inst = insts[i];

      if (inst) {
        if (titleEl) titleEl.textContent = getTitle(inst.id);
        if (subEl) subEl.textContent = `Lv ${inst.level}`;
        slot.classList.remove("empty");
      } else {
        if (titleEl) titleEl.textContent = "—";
        if (subEl) subEl.textContent = "";
        slot.classList.add("empty");
      }
    }
  }

  function updateHud() {
    args.hud.timePill.textContent = formatTimeMMSS(world.time);
    args.hud.killsPill.textContent = `Kills: ${world.kills}`;
    args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
    args.hud.lvlPill.textContent = `Lv: ${world.level}`;

    // 4 weapon slots + 4 item slots, order = array order
    renderSlots(args.hud.weaponSlots, world.weapons as any, (id) => registry.weapon(id as any).title);
    renderSlots(args.hud.itemSlots, world.items as any, (id) => registry.item(id as any).title);
  }
  // ---------------------------------

  function update(dt: number) {

    // Always poll input (so movement is responsive immediately after closing menus)
    inputSystem(input, args.canvas);

    // Handle pause states
    if (world.state === "LEVELUP" || world.state === "CHEST" || world.state === "MAP") {
      // HUD still updates while paused
      args.hud.timePill.textContent = hudTimeText(world);
      args.hud.killsPill.textContent = `Kills: ${world.kills}`;
      args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
      args.hud.lvlPill.textContent = `Lv: ${world.level}`;
      updateHud();
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
      // If boss was killed, advance (but wait for the boss chest to be collected)
      if (!bossAlive(world)) {
        const pending = (world as any).bossRewardPending as boolean | undefined;
        if (pending) {
          // Do nothing; chest must be picked up first
        } else {
          if (world.floorIndex >= FLOORS_PER_RUN - 1) {
            completeRun(world);
            return;
          }
          // Between floors: show route map selection
          (world as any).mapPendingNextFloorIndex = (world.floorIndex ?? 0) + 1;

          showMap("Choose your next zone.\n(There is a boss at the end of every floor.)");
          return;
        }
      }
    } else if (world.runState === "TRANSITION") {
      world.transitionTime = Math.max(0, world.transitionTime - dt);
      if (world.transitionTime <= 0) {
        enterFloor(world, (world.floorIndex ?? 0) + 1);
      }
    }

    movementSystem(world, input, dt);
    spawnSystem(world, dt);
    combatSystem(world, dt);
    projectilesSystem(world, dt);
    collisionsSystem(world, dt);
    poisonSystem(world, dt);
    onKillExplodeSystem(world, dt); // NEW: explode on kill (can add more kills)
    bossSystem(world, dt);          // NEW: boss mechanics (telegraphs/hazards/dash)
    zonesSystem(world, dt);
    pickupsSystem(world, dt);
    xpSystem(world, dt);

    // SFX consumes events before any early-return branches
    audioSystem(world, dt);

    // If a chest was opened this frame, roll/apply reward and pause with a popup
    if ((world as any).chestOpenRequested) {

      (world as any).chestOpenRequested = false;

      const pool = getUpgradePool(world);

      // 1) EVOLUTION ALWAYS WINS
      const evoChoices = pool.filter((u) => u.isEvolution && u.isAvailable(world));
      if (evoChoices.length > 0) {
        const evo = evoChoices[world.rng.int(0, evoChoices.length - 1)];
        applyUpgrade(evo);
        showChestPopup(`EVOLUTION — ${evo.title}\n${evo.desc}`);
        clearEvents(world);
        return;
      }

      // 2) Otherwise: upgrade an already-owned weapon or item directly
      type Candidate = { kind: "weapon"; index: number } | { kind: "item"; index: number };
      const candidates: Candidate[] = [];

      const MAX_WPN_LV = registry.maxWeaponLevel();
      const MAX_ITEM_LV = registry.maxItemLevel();

      for (let i = 0; i < world.weapons.length; i++) {
        const wpn = world.weapons[i];
        if (wpn.level < MAX_WPN_LV) candidates.push({ kind: "weapon", index: i });
      }

      for (let i = 0; i < world.items.length; i++) {
        const it = world.items[i];
        if (it.level < MAX_ITEM_LV) candidates.push({ kind: "item", index: i });
      }

      if (candidates.length === 0) {
        showChestPopup("Nothing happened. (All owned upgrades are maxed.)");
        clearEvents(world);
        return;
      }

      const pick = candidates[world.rng.int(0, candidates.length - 1)];

      if (pick.kind === "weapon") {
        const inst = world.weapons[pick.index];
        inst.level = Math.min(MAX_WPN_LV, inst.level + 1);

        const def = registry.weapon(inst.id);
        showChestPopup(`Upgrade — ${def.title}\nLevel ${inst.level}/${MAX_WPN_LV}`);
      } else {
        const inst = world.items[pick.index];
        inst.level = Math.min(MAX_ITEM_LV, inst.level + 1);

        recomputeDerivedStats(world);

        const def = registry.item(inst.id);
        showChestPopup(`Upgrade — ${def.title}\nLevel ${inst.level}/${MAX_ITEM_LV}`);
      }

      clearEvents(world);
      return;
    }

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

      emitEvent(world, { type: "SFX", id: "RUN_LOSE", vol: 1.0, rate: 1 });
      audioSystem(world, dt);
      clearEvents(world);

      // Show proper Game Over screen
      args.ui.endEl.title.textContent = "Game Over";
      args.ui.endEl.sub.textContent =
          `You died on floor ${Math.max(1, (world.floorIndex ?? 0) + 1)}.\n` +
          `Time: ${formatTimeMMSS(world.time)} · Kills: ${world.kills}`;

      args.ui.endEl.root.hidden = false;
      args.ui.menuEl.hidden = true;
      args.hud.root.hidden = true;
      hideLevelUp();
      return;
    }


    // HUD
    args.hud.timePill.textContent = hudTimeText(world);
    args.hud.killsPill.textContent = `Kills: ${world.kills}`;
    args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
    args.hud.lvlPill.textContent = `Lv: ${world.level}`;
    updateHud();
  }

  function render() {
    renderSystem(world, args.ctx, args.canvas);
  }

  // Menu click starts
  args.ui.menuEl.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t?.closest("button") as HTMLButtonElement | null;
    if (!btn) return;

    if (btn.id === "startBtn") {
      const starter = btn.dataset.weapon as WeaponId | undefined;

      args.ui.menuEl.hidden = true;
      args.ui.endEl.root.hidden = true;
      args.hud.root.hidden = false;
      startRun(starter);
    }
  });

  // End screen button -> back to menu
  args.ui.endEl.root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t?.closest("button") as HTMLButtonElement | null;
    if (!btn) return;
    if (btn.id !== "endBtn") return;

    args.ui.endEl.root.hidden = true;
    args.hud.root.hidden = true;

    // Back to menu (weapon select is already there)
    args.ui.menuEl.hidden = false;
    hideLevelUp();
  });

  args.ui.mapEl.root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest("button") as HTMLButtonElement | null;
    if (!btn) return;

    const nodeId = btn.dataset.nodeId;
    if (!nodeId) return;

    const g = (world as any).runMap as RunMap;
    const node = g.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Commit choice
    (world as any).mapCurrentNodeId = node.id;

    const nextFloor = (world as any).mapPendingNextFloorIndex as number;

    hideMap();
    world.state = "RUN";

    // Enter chosen floor/zone (boss is still at end of the floor like today)
    enterFloor(world, nextFloor, node.zoneId);
  });

  // Level-up choice click
  args.ui.levelupEl.root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest("button") as HTMLButtonElement | null;
    if (!btn) return;

    // Chest popup: single "Continue"
    if (btn.dataset.chestContinue === "1") {
      hideLevelUp();

      // If map overlay is up, do NOT resume gameplay yet.
      if (!args.ui.mapEl.root.hidden) {
        // Stay in MAP state (player must pick next node)
        world.state = "MAP";
        return;
      }

      world.state = "RUN";
      return;
    }

    // Normal level-up choice
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
