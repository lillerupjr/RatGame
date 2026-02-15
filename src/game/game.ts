// src/game/game.ts
import { World, createWorld, clearEvents, emitEvent, gridAtPlayer } from "../engine/world/world";

import { InputState, createInputState, inputSystem, clearInputEdges } from "./systems/sim/input";
import { movementSystem } from "./systems/sim/movement";
import { spawnSystem } from "./systems/spawn/spawn";
import { combatSystem } from "./systems/sim/combat";
import { collisionsSystem } from "./systems/sim/collisions";
import { projectilesSystem } from "./systems/sim/projectiles";
import { pickupsSystem } from "./systems/progression/pickups";
import { xpSystem } from "./systems/progression/xp";
import { renderSystem } from "./systems/presentation/render";
import { zonesSystem } from "./systems/sim/zones";
import { onKillExplodeSystem } from "./systems/sim/onKillExplode";
import { bossSystem } from "./systems/progression/boss";
import { audioSystem } from "./systems/presentation/audio";
import { preloadSfx } from "../engine/audio/sfx";
import { roomChallengeSystem } from "./systems/progression/roomChallenge";
import { triggerSystem } from "./systems/progression/triggerSystem";
import { objectiveSystem } from "./systems/progression/objective";
import { outcomeSystem } from "./systems/progression/outcomeSystem";
import { goldSystem } from "./systems/progression/gold";
import { vendorSystem } from "./systems/progression/vendorSystem";
import { bossZoneSpawnSystem } from "./systems/progression/bossZoneSpawn";

import { getUpgradePool, UpgradeDef } from "./content/upgrades";
import { formatTimeMMSS } from "./util/time";
import type { WeaponId } from "./content/weapons";
import { registry } from "./content/registry";
import { spawnEnemyGrid, ENEMY_TYPE } from "./factories/enemyFactory";
import { gridToWorld, worldToGrid } from "./coords/grid";
import { anchorFromWorld } from "./coords/anchor";
import { poisonSystem } from "./systems/sim/poison";
import { fissionSystem } from "./systems/sim/fission";
import { recomputeDerivedStats } from "./stats/derivedStats";
import {buildStaticRunMap, getReachable, type RunMap, type MapNode} from "./map/runMap";
import { KENNEY_TILE_WORLD, preloadKenneyTiles } from "../engine/render/kenneyTiles";
import type { Dir8 } from "../engine/render/sprites/dir8";
import { dir8FromVector } from "../engine/render/sprites/dir8";

import { initializeRoomChallenges } from "./systems/progression/roomChallenge";

import {
  createDelveMap,
  ensureAdjacentNodes,
  getReachableNodes,
  moveToNode,
  getVisibleNodes,
  getVisibleEdges,
  getDepthScaling,
  getNodeDepth,
  type DelveMap,
  type DelveNode,
} from "./map/delveMap";
import type { FloorArchetype } from "./map/floorArchetype";
import type { FloorIntent } from "./map/floorIntent";
import { preloadPlayerSprites, setPlayerSkin } from "../engine/render/sprites/playerSprites";
import { preloadVendorNpcSprites } from "../engine/render/sprites/vendorSprites";
import { preloadBackgrounds } from "./render/background";
import { getProjectileSpriteByKind, preloadProjectileSprites } from "../engine/render/sprites/projectileSprites";
import { setMusicStage, stopMusic } from "../engine/audio/music";
import type { TableMapCell, TableMapDef } from "./map/formats/table/tableMapTypes";
import { AUTHORED_MAP_DEFS, getAuthoredMapDefByMapId } from "./map/authored/authoredMapRegistry";
import {
  activateMapDef,
  generateAndActivateFloorMap,
  generateAndActivateMazeFloorMap,
  getActiveMap,
  getActiveMapDef,
  getActiveRoomData,
  applyObjectivesFromActiveMap,
  getSpawnWorldFromActive,
} from "./map/proceduralMapBridge";
import { objectiveSpecFromFloorIntent } from "./map/floorObjectiveBinding";
import { mapSourceFromFloorIntent } from "./map/floorMapSourceBinding";
import { applyFloorOverlays } from "./map/floorOverlays";
import { setObjectives, setObjectivesFromSpec } from "./systems/progression/objective";
import { generateVendorOffers } from "./events/vendor";
import { RNG } from "./util/rng";
import { applyObjective } from "./map/objectiveTransforms";
import { objectiveIdFromArchetype } from "./map/objectivePlan";
import { DEFAULT_MAP_POOL } from "./map/mapIds";
import { OBJECTIVE_TRIGGER_IDS } from "./systems/progression/objectiveSpec";
import { getPlayableCharacter, PLAYABLE_CHARACTERS, type PlayableCharacterId } from "./content/playableCharacters";
import { getUserSettings } from "../userSettings";


type HudRefs = {
  root: HTMLDivElement;
  timePill: HTMLSpanElement;
  killsPill: HTMLSpanElement;
  hpPill: HTMLSpanElement;
  lvlPill: HTMLSpanElement;
  objectiveOverlay: HTMLDivElement;
  objectiveTitle: HTMLDivElement;
  objectiveStatus: HTMLDivElement;
  interactPrompt: HTMLDivElement;

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
    dialogEl: {
      root: HTMLDivElement;
      text: HTMLDivElement;
      choices: HTMLDivElement;
    };
  };
};


/** Create a game instance and return update/render/start handlers. */
export function createGame(args: CreateGameArgs) {

  // ------------------------------------------------------------
  // DEBUG: optional spawn override (OFF by default)
  // ------------------------------------------------------------
  const DEBUG_SPAWN_OFF_X = 0;   // world-space offset from map spawn
  const DEBUG_SPAWN_OFF_Y = 0;

  function applyDebugSpawn(w: World) {
    const DEBUG_FORCE_SPAWN = getUserSettings().debug.forceSpawnOverride;
    if (!DEBUG_FORCE_SPAWN) return;

    const pg = gridAtPlayer(w);
    const pw = gridToWorld(pg.gx, pg.gy, KENNEY_TILE_WORLD);
    const px = pw.wx + DEBUG_SPAWN_OFF_X;
    const py = pw.wy + DEBUG_SPAWN_OFF_Y;
    const anchor = anchorFromWorld(px, py, KENNEY_TILE_WORLD);
    w.pgxi = anchor.gxi;
    w.pgyi = anchor.gyi;
    w.pgox = anchor.gox;
    w.pgoy = anchor.goy;
    // Keep these sane when debugging spawn
    w.pvx = 0;
    w.pvy = 0;
    w.lastAimX = 1;
    w.lastAimY = 0;
  }

  const input: InputState = createInputState();
  type InteractableKind = "SHOP" | "REST";
  type Interactable = {
    id: string;
    kind: InteractableKind;
    tx: number;
    ty: number;
    wx: number;
    wy: number;
    rangeMode: "RADIUS" | "NEIGHBOR_8";
    radiusWorld: number;
    prompt: string;
  };
  type DialogChoice = {
    label: string;
    onSelect: () => void;
  };
  type DialogState = {
    text: string;
    choices: DialogChoice[];
    selectedIndex: number;
  };
  const dialogInputQueue = {
    move: 0,
    confirm: false,
    cancel: false,
  };
  let interactables: Interactable[] = [];
  let activeInteractableId: string | null = null;
  let activeDialog: DialogState | null = null;
  let pendingNpcFaceRestoreId: string | null = null;

  const staticMaps: TableMapDef[] = AUTHORED_MAP_DEFS;

  function getStaticMapById(id: string | undefined): TableMapDef | undefined {
    if (!id) return undefined;
    return getAuthoredMapDefByMapId(id);
  }

  function getDefaultStaticMap(): TableMapDef | undefined {
    return staticMaps[0];
  }

  function setDialog(dialog: DialogState | null) {
    activeDialog = dialog;
    if (!dialog) {
      if (pendingNpcFaceRestoreId) {
        const npc = world.npcs.find((n) => n.id === pendingNpcFaceRestoreId);
        if (npc) npc.faceRestoreAtMs = performance.now() + 3000;
        pendingNpcFaceRestoreId = null;
      }
      args.ui.dialogEl.root.hidden = true;
      args.ui.dialogEl.text.textContent = "";
      args.ui.dialogEl.choices.innerHTML = "";
      return;
    }
    args.ui.dialogEl.root.hidden = false;
    args.ui.dialogEl.text.textContent = dialog.text;
    args.ui.dialogEl.choices.innerHTML = "";
    for (let i = 0; i < dialog.choices.length; i++) {
      const row = document.createElement("div");
      row.className = i === dialog.selectedIndex ? "dialogChoice active" : "dialogChoice";
      row.textContent = dialog.choices[i].label;
      args.ui.dialogEl.choices.appendChild(row);
    }
  }

  function showInfoDialog(text: string) {
    setDialog({
      text,
      selectedIndex: 0,
      choices: [
        {
          label: "OK",
          onSelect: () => setDialog(null),
        },
      ],
    });
  }

  function completeObjectiveById(objectiveId: string) {
    for (let i = 0; i < world.objectiveDefs.length; i++) {
      const def = world.objectiveDefs[i];
      if (def.id !== objectiveId) continue;
      const st = world.objectiveStates[i];
      if (!st || st.status === "COMPLETED") continue;
      st.status = "COMPLETED";
      st.progress.signalCount = Math.max(1, st.progress.signalCount);
    }
  }

  function openInteractDialog(interactable: Interactable) {
    if (activeDialog) return;
    const npc = world.npcs.find((n) => n.tx === interactable.tx && n.ty === interactable.ty);
    if (npc) {
      const { playerTx, playerTy } = getPlayerTileAtCurrentPosition();
      const dx = playerTx - npc.tx;
      const dy = playerTy - npc.ty;
      if (!(dx === 0 && dy === 0)) {
        npc.dirCurrent = dir8FromTileDelta(dx, dy);
      }
      npc.faceRestoreAtMs = null;
      pendingNpcFaceRestoreId = npc.id;
    }
    if (interactable.kind === "SHOP") {
      setDialog({
        text: "Open shop?",
        selectedIndex: 0,
        choices: [
          {
            label: "Yes",
            onSelect: () => {
              world.pendingLevelUps += 1;
              completeObjectiveById(OBJECTIVE_TRIGGER_IDS.vendor);
              showInfoDialog("You have been granted a free level! (shop coming soon...)");
            },
          },
          {
            label: "No",
            onSelect: () => setDialog(null),
          },
        ],
      });
      return;
    }
    setDialog({
      text: "Heal to full?",
      selectedIndex: 0,
      choices: [
        {
          label: "Yes",
          onSelect: () => {
            world.playerHp = world.playerHpMax;
            completeObjectiveById(OBJECTIVE_TRIGGER_IDS.heal);
            showInfoDialog("You have been healed to full HP!");
          },
        },
        {
          label: "No",
          onSelect: () => setDialog(null),
        },
      ],
    });
  }

  function applyMapFeaturesFromCells(w: World) {
    interactables = [];
    activeInteractableId = null;
    w.npcs = [];
    args.hud.interactPrompt.hidden = true;
    const mapDef = getActiveMapDef();
    const compiled = getActiveMap();
    if (!mapDef || !compiled) return;
    const originTx = compiled.originTx | 0;
    const originTy = compiled.originTy | 0;
    const cells = mapDef.cells ?? [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as TableMapCell;
      const type = cell.type ?? "";
      if (type !== "interact_shop" && type !== "interact_rest" && type !== "npc_vendor" && type !== "npc_healer") continue;
      const tx = (cell.x | 0) + originTx;
      const ty = (cell.y | 0) + originTy;
      if (type === "npc_vendor" || type === "npc_healer") {
        const dirBase = ((cell.dir ?? "S").toUpperCase()) as Dir8;
        w.npcs.push({
          id: `${type}_${tx}_${ty}`,
          kind: type === "npc_vendor" ? "vendor" : "healer",
          tx,
          ty,
          wx: (tx + 0.5) * KENNEY_TILE_WORLD,
          wy: (ty + 0.5) * KENNEY_TILE_WORLD,
          dirBase,
          dirCurrent: dirBase,
          faceRestoreAtMs: null,
        });
        interactables.push({
          id: `${type}_interact_${tx}_${ty}`,
          kind: type === "npc_vendor" ? "SHOP" : "REST",
          tx,
          ty,
          wx: (tx + 0.5) * KENNEY_TILE_WORLD,
          wy: (ty + 0.5) * KENNEY_TILE_WORLD,
          rangeMode: "NEIGHBOR_8",
          radiusWorld: 0,
          prompt: "Interact: Press E",
        });
        continue;
      }
      interactables.push({
        id: `${type}_${tx}_${ty}`,
        kind: type === "interact_shop" ? "SHOP" : "REST",
        tx,
        ty,
        wx: (tx + 0.5) * KENNEY_TILE_WORLD,
        wy: (ty + 0.5) * KENNEY_TILE_WORLD,
        rangeMode: "RADIUS",
        radiusWorld: 1.25 * KENNEY_TILE_WORLD,
        prompt: "Interact: Press E",
      });
    }
  }

  function updateActiveInteractablePrompt() {
    if (world.state !== "RUN") {
      activeInteractableId = null;
      args.hud.interactPrompt.hidden = true;
      return;
    }
    if (activeDialog) {
      activeInteractableId = null;
      args.hud.interactPrompt.textContent = "Press E to choose";
      args.hud.interactPrompt.hidden = false;
      return;
    }
    const pg = gridAtPlayer(world);
    const pw = gridToWorld(pg.gx, pg.gy, KENNEY_TILE_WORLD);
    const { playerTx, playerTy } = getPlayerTileAtCurrentPosition();
    let best: Interactable | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < interactables.length; i++) {
      const it = interactables[i];
      let distSq = 0;
      if (it.rangeMode === "NEIGHBOR_8") {
        const cheb = Math.max(Math.abs(playerTx - it.tx), Math.abs(playerTy - it.ty));
        if (cheb > 1) continue;
        const dx = pw.wx - it.wx;
        const dy = pw.wy - it.wy;
        distSq = dx * dx + dy * dy;
      } else {
        const dx = pw.wx - it.wx;
        const dy = pw.wy - it.wy;
        distSq = dx * dx + dy * dy;
        if (distSq > it.radiusWorld * it.radiusWorld) continue;
      }
      if (!best || distSq < bestDistSq || (distSq === bestDistSq && it.id < best.id)) {
        best = it;
        bestDistSq = distSq;
      }
    }
    activeInteractableId = best?.id ?? null;
    if (best) {
      args.hud.interactPrompt.textContent = best.prompt;
      args.hud.interactPrompt.hidden = false;
    } else {
      args.hud.interactPrompt.hidden = true;
    }
  }

  function getPlayerTileAtCurrentPosition(): { playerTx: number; playerTy: number } {
    const pg = gridAtPlayer(world);
    const pw = gridToWorld(pg.gx, pg.gy, KENNEY_TILE_WORLD);
    return {
      playerTx: Math.floor(pw.wx / KENNEY_TILE_WORLD),
      playerTy: Math.floor(pw.wy / KENNEY_TILE_WORLD),
    };
  }

  function dir8FromTileDelta(dxTile: number, dyTile: number): Dir8 {
    // Convert tile-grid delta into screen-space vector under iso projection.
    // screenX ~ (tx - ty), screenY(down) ~ (tx + ty); convert Y to "up" for dir8FromVector.
    const screenX = dxTile - dyTile;
    const screenYUp = -(dxTile + dyTile);
    return dir8FromVector(screenX, screenYUp);
  }

  function updateNpcFacingRestore(nowMs: number) {
    for (let i = 0; i < world.npcs.length; i++) {
      const npc = world.npcs[i];
      if (npc.faceRestoreAtMs === null) continue;
      if (nowMs < npc.faceRestoreAtMs) continue;
      npc.dirCurrent = npc.dirBase;
      npc.faceRestoreAtMs = null;
    }
  }

  function handleDialogInput() {
    if (!activeDialog) return;
    if (dialogInputQueue.move !== 0) {
      const len = activeDialog.choices.length;
      activeDialog.selectedIndex = (activeDialog.selectedIndex + dialogInputQueue.move + len) % len;
      setDialog(activeDialog);
    }
    if (dialogInputQueue.cancel) {
      setDialog(null);
    } else if (dialogInputQueue.confirm) {
      const choice = activeDialog.choices[activeDialog.selectedIndex];
      choice?.onSelect();
      if (activeDialog) setDialog(activeDialog);
    }
    dialogInputQueue.move = 0;
    dialogInputQueue.confirm = false;
    dialogInputQueue.cancel = false;
  }

  window.addEventListener("keydown", (e) => {
    if (!activeDialog) return;
    if (e.repeat) return;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      dialogInputQueue.move = -1;
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      dialogInputQueue.move = 1;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" || e.key === "e" || e.key === "E") {
      dialogInputQueue.confirm = true;
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      dialogInputQueue.cancel = true;
      e.preventDefault();
    }
  });

  // Ensure a map is compiled before we create the World (spawn uses the active map).
  const initialMap = getDefaultStaticMap();
  if (initialMap) {
    activateMapDef(initialMap, 1337);
  }

  let world: World = createWorld({ seed: 1337, stage: cloneStage("DOCKS") });
  applyObjectivesFromActiveMap(world);
  applyMapFeaturesFromCells(world);
  applyDebugSpawn(world);

  setMusicStage("DOCKS");

  const defaultCharacter = PLAYABLE_CHARACTERS[0];
  if (defaultCharacter) {
    setPlayerSkin(defaultCharacter.idleSpriteKey);
  }

  preloadBackgrounds();
  preloadPlayerSprites();
  preloadVendorNpcSprites();
  preloadProjectileSprites();
  preloadSfx();
  preloadKenneyTiles();

  // NEW: Kenney iso tile (placeholder for Milestone A)
  // Uses the default map skin sprite set.
  // (safe even if missing; render will fallback)
  const anyW = (world as any);
  if (!anyW._kenneyTilesPreloaded) {
    anyW._kenneyTilesPreloaded = true;
    // Lazy import-style usage stays consistent with the rest of the project
    // (you can also import at top if you prefer)
  }

  // ---- FPS counter ----
  let fpsFrames = 0;
  let fpsLastTime = performance.now();
  let fpsValue = 0;
  // FPS tracking


  let currentChoices: UpgradeDef[] = [];

  const FLOORS_PER_RUN = 3;
  const TRANSITION_SECS = 0;
  const DETERMINISTIC_ARCHETYPES: FloorArchetype[] = [
    "SURVIVE",
    "TIME_TRIAL",
    "VENDOR",
    "HEAL",
    "BOSS_TRIPLE",
  ];
  const DETERMINISTIC_ZONES = ["DOCKS", "SEWERS", "CHINATOWN"] as const;

  type DeterministicChoice = {
    archetype: FloorArchetype;
    floorIndex: number;
    depth: number;
  };

  const hashString = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  };

  const isDeterministicDelveMode = () => !!(world as any).deterministicDelveMode;

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
    w.egxi = [];
    w.egyi = [];
    w.egox = [];
    w.egoy = [];
    w.evx = [];
    w.evy = [];
    w.eFaceX = [];
    w.eFaceY = [];
    w.eHp = [];
    w.eHpMax = [];
    w.eR = [];
    w.eSpeed = [];
    w.eDamage = [];
    w.ezVisual = [];
    w.ezLogical = [];
    w.ePoisonT = [];
    w.ePoisonDps = [];
    w.ePoisonedOnDeath = [];
    w.eSpawnTriggerId = [];

    w.zAlive = [];
    w.zKind = [];
    w.zgxi = [];
    w.zgyi = [];
    w.zgox = [];
    w.zgoy = [];
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
    w.prgxi = [];
    w.prgyi = [];
    w.prgox = [];
    w.prgoy = [];
    // Milestone C
    w.prZ = [];
    w.prZVisual = [];
    w.prZLogical = [];
    w.prHitsPlayer = [];
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
    // Milestone C: clear cached zone floor heights
    (w as any)._zFloorH = [];

    w.xAlive = [];
    w.xKind = [];
    w.xgxi = [];
    w.xgyi = [];
    w.xgox = [];
    w.xgoy = [];
    w.xValue = [];
    w.xDropId = [];

    // Clear floating combat text
    w.floatTextX = [];
    w.floatTextY = [];
    w.floatTextValue = [];
    w.floatTextColor = [];
    w.floatTextTtl = [];
    w.floatTextIsCrit = [];
    w.npcs = [];
  }

  function bossAlive(w: World): boolean {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      if (w.eType[i] === ENEMY_TYPE.BOSS) return true;
    }
    return false;
  }

  function enterFloor(w: World, floorIntent: FloorIntent) {
    setDialog(null);
    if (w.delveMap && !floorIntent.mapId) {
      console.error("[enterFloor] delve floor intent missing mapId");
      return;
    }
    w.floorIndex = floorIntent.floorIndex;
    w.floorArchetype = floorIntent.archetype;
    w.currentFloorIntent = floorIntent;
    w.runState = "FLOOR";
    w.phaseTime = 0;
    w.transitionTime = 0;

    const sid = floorIntent.zoneId;

    w.stage = cloneStage(sid as any);
    setMusicStage(sid as any);

    w.stage = cloneStage(sid as any);

    // Drive floor timing from stage
    w.floorDuration = w.stage.duration;

    const objectiveId = floorIntent.objectiveId ?? objectiveIdFromArchetype(floorIntent.archetype);

    if (floorIntent.mapId) {
      if (!floorIntent.objectiveId) {
        console.error("[enterFloor] missing objectiveId for planned floor");
        return;
      }
      const baseMap = getStaticMapById(floorIntent.mapId);
      if (!baseMap) {
        console.error(`[enterFloor] missing authored map for mapId="${floorIntent.mapId}"`);
        return;
      }
      if (floorIntent.variantSeed === undefined) {
        console.error("[enterFloor] missing variantSeed for planned floor");
        return;
      }
      const rng = new RNG(floorIntent.variantSeed);
      const finalMap = applyObjective(baseMap, floorIntent.objectiveId, rng);
      activateMapDef(finalMap, floorIntent.variantSeed);
    } else {
      const mapSource = mapSourceFromFloorIntent(floorIntent);
      const variantSeed = floorIntent.variantSeed;
      if (mapSource.type === "PROCEDURAL_ROOMS") {
        const mapSeed = variantSeed ?? w.rng.int(0, 0x7fffffff);
        generateAndActivateFloorMap(mapSeed, floorIntent.floorIndex, false, w);
      } else if (mapSource.type === "PROCEDURAL_MAZE") {
        const mapSeed = variantSeed ?? w.rng.int(0, 0x7fffffff);
        generateAndActivateMazeFloorMap(mapSeed, floorIntent.floorIndex, false);
      } else {
        const staticDef = getStaticMapById(mapSource.mapId) ?? getDefaultStaticMap();
        if (staticDef) {
          activateMapDef(staticDef, variantSeed ?? w.rng.int(0, 0x7fffffff));
        }
      }
    }
    const spawn = getSpawnWorldFromActive();
    const anchor = anchorFromWorld(spawn.x, spawn.y, KENNEY_TILE_WORLD);
    w.pgxi = anchor.gxi;
    w.pgyi = anchor.gyi;
    w.pgox = anchor.gox;
    w.pgoy = anchor.goy;
    w.pz = spawn.z;
    w.pzVisual = spawn.z;
    w.pzLogical = spawn.h | 0;
    w.activeFloorH = spawn.h | 0;

    applyFloorOverlays(w, floorIntent);

    clearFloorEntities(w);
    applyMapFeaturesFromCells(w);

    const objectiveSpec = objectiveSpecFromFloorIntent(floorIntent);
    w.currentObjectiveSpec = objectiveSpec;
    setObjectivesFromSpec(w, objectiveSpec);
    if (objectiveSpec.objectiveType === "SURVIVE_TIMER") {
      w.floorDuration = objectiveSpec.params.timeLimitSec;
    } else if (objectiveSpec.objectiveType === "TIME_TRIAL_ZONES") {
      w.floorDuration = objectiveSpec.params.timeLimitSec;
    }

    w.vendorOffers =
      floorIntent.archetype === "VENDOR" ? generateVendorOffers(floorIntent) : [];
    (w as any)._surviveBossSpawned = false;
    w.bossZoneSpawned = [];

    emitEvent(w, { type: "SFX", id: "FLOOR_START", vol: 0.9, rate: 1 });
  }

  function buildFloorIntentFromDelveNode(node: DelveNode, floorIndex: number): FloorIntent {
    return {
      nodeId: node.id,
      zoneId: node.zoneId,
      depth: getNodeDepth(node),
      floorIndex,
      archetype: node.floorArchetype,
      mapId: node.plan.mapId,
      objectiveId: node.plan.objectiveId,
      variantSeed: node.plan.variantSeed,
    };
  }

  function buildFloorIntentFromRunNode(node: MapNode, floorIndex: number): FloorIntent {
    return {
      nodeId: node.id,
      zoneId: node.zoneId,
      depth: floorIndex + 1,
      floorIndex,
      archetype: node.floorArchetype,
      objectiveId: objectiveIdFromArchetype(node.floorArchetype),
    };
  }

  function buildFallbackFloorIntent(w: World, floorIndex: number): FloorIntent {
    const zoneId = (w.stage?.id ?? w.stageId ?? "DOCKS") as any;
    return {
      nodeId: "LEGACY_FLOOR",
      zoneId,
      depth: floorIndex + 1,
      floorIndex,
      archetype: w.floorArchetype ?? "SURVIVE",
      objectiveId: objectiveIdFromArchetype(w.floorArchetype ?? "SURVIVE"),
    };
  }

  function deterministicVariantSeed(
    runSeed: number,
    floorIndex: number,
    depth: number,
    archetype: FloorArchetype,
    mapId?: string,
  ): number {
    return hashString(`${runSeed}:${floorIndex}:${depth}:${archetype}:${mapId ?? "AUTO"}`);
  }

  function buildDeterministicFloorIntent(choice: DeterministicChoice): FloorIntent {
    const mapId =
      choice.archetype === "VENDOR"
        ? "SHOP"
        : choice.archetype === "HEAL"
          ? "REST"
          : DEFAULT_MAP_POOL[
              hashString(
                `${world.runSeed}:${choice.floorIndex}:${choice.depth}:${choice.archetype}:mapPick`,
              ) % DEFAULT_MAP_POOL.length
            ];
    const zoneId = DETERMINISTIC_ZONES[choice.floorIndex % DETERMINISTIC_ZONES.length];
    return {
      nodeId: `DET_${choice.floorIndex}_${choice.depth}_${choice.archetype}`,
      zoneId,
      depth: choice.depth,
      floorIndex: choice.floorIndex,
      archetype: choice.archetype,
      mapId,
      objectiveId: objectiveIdFromArchetype(choice.archetype),
      variantSeed: deterministicVariantSeed(
        world.runSeed,
        choice.floorIndex,
        choice.depth,
        choice.archetype,
        mapId,
      ),
    };
  }

  function enterBoss(w: World) {
    w.runState = "BOSS";
    w.phaseTime = 0;
    w.transitionTime = 0;

    emitEvent(w, { type: "SFX", id: "BOSS_START", vol: 1.0, rate: 1 });

    // Ensure boss reward gate is reset for this encounter (if present on World)
    (w as any).bossRewardPending = false;
    (w as any).chestOpenRequested = false;
    w.magnetActive = false;
    w.magnetTimer = 0;

    // Clean slate for the boss encounter (feels fair + deterministic).
    //clearFloorEntities(w);

    const a = w.rng.range(0, Math.PI * 2);
    const r = 320;
    const pg = gridAtPlayer(w);
    const pw = gridToWorld(pg.gx, pg.gy, KENNEY_TILE_WORLD);
    const sx = pw.wx + Math.cos(a) * r;
    const sy = pw.wy + Math.sin(a) * r;
    const gp = worldToGrid(sx, sy, KENNEY_TILE_WORLD);
    spawnEnemyGrid(w, ENEMY_TYPE.BOSS, gp.gx, gp.gy, KENNEY_TILE_WORLD);
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


  function applyMapSelection(mapId: string | undefined, seed: number) {
    if (mapId === "PROC_ROOMS") {
      generateAndActivateFloorMap(seed, 0, false, undefined);
      return;
    }
    if (mapId === "PROC_MAZE") {
      generateAndActivateMazeFloorMap(seed, 0, false);
      return;
    }

    const staticDef = getStaticMapById(mapId) ?? getDefaultStaticMap();
    if (staticDef) {
      activateMapDef(staticDef, seed);
    }
  }

  function isMapMode(mapId: string | undefined): boolean {
    return !!mapId;
  }

  function previewMap(mapId?: string) {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    applyMapSelection(mapId, seed);
    applyMapFeaturesFromCells(world);
  }

  function resetRun(mapId?: string) {
    setDialog(null);
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    applyMapSelection(mapId, seed);
    world = createWorld({
      seed,
      stage: cloneStage("DOCKS"),
    });
    (world as any).deterministicDelveMode = false;
    const mapMode = isMapMode(mapId);
    (world as any).mapMode = mapMode;
    (world as any).runtimeStructureSlicingEnabled = false;
    (world as any).runtimeStructureSliceDebug = false;
    if (mapMode) {
      setObjectives(world, []);
    } else {
      applyObjectivesFromActiveMap(world);
    }
    applyMapFeaturesFromCells(world);

    // DEBUG: spawn offset
    applyDebugSpawn(world);

    currentChoices = [];
    hideLevelUp();
  }

  function startRun(characterId: PlayableCharacterId) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    setPlayerSkin(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(undefined);

    world.weapons = [{ id: character.startingWeaponId, level: 1, cdLeft: 0 }];

    // Initialize room challenges from the current map
    const roomData = getActiveRoomData();
    if (roomData && roomData.length > 0) {
      initializeRoomChallenges(world, roomData);
    }

    // Create infinite delve map
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const delve = createDelveMap(seed);
    world.delveMap = delve;
    world.delveDepth = 1;
    world.delveScaling = getDepthScaling(1);

    // Also keep legacy map for compatibility (will be phased out)
    const g = buildStaticRunMap() as RunMap;
    (world as any).runMap = g;
    (world as any).mapCurrentNodeId = null;
    (world as any).mapPendingNextFloorIndex = 0;

    // Pick starting node
    showDelveMap("Choose your starting location.\nGo deeper for greater challenge and rewards.");
  }

  function startDeterministicRun(characterId: PlayableCharacterId) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    setPlayerSkin(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(undefined);

    world.weapons = [{ id: character.startingWeaponId, level: 1, cdLeft: 0 }];
    world.delveMap = null;
    world.delveDepth = 1;
    world.delveScaling = getDepthScaling(1);
    world.runState = "FLOOR";
    world.state = "RUN";
    (world as any).deterministicDelveMode = true;

    args.ui.menuEl.hidden = true;
    args.ui.mapEl.root.hidden = false;
    args.ui.endEl.root.hidden = true;
    args.hud.root.hidden = false;
    hideLevelUp();

    showDeterministicFloorPicker(
      "Path Select mode: choose any floor type.",
      0,
      1,
    );
  }

  function startSandboxRun(characterId: PlayableCharacterId, mapId?: string) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    setPlayerSkin(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(mapId);

    world.weapons = [{ id: character.startingWeaponId, level: 1, cdLeft: 0 }];
    world.delveMap = null;
    world.delveDepth = 1;
    world.delveScaling = getDepthScaling(1);
    // IMPORTANT: sandbox must still run the sim.
    world.runState = "FLOOR";
    world.state = "RUN";

    // UI: ensure we’re not stuck in menus/overlays.
    args.ui.menuEl.hidden = true;
    args.ui.mapEl.root.hidden = true;
    args.ui.endEl.root.hidden = true;
    args.hud.root.hidden = false;
    hideLevelUp();
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

  function showDeterministicFloorPicker(subText: string, floorIndex: number, depth: number) {
    world.state = "MAP";
    args.ui.mapEl.root.hidden = false;
    args.hud.root.hidden = true;
    args.ui.mapEl.sub.textContent = subText;
    args.ui.mapEl.svg.innerHTML =
      `<rect x="0" y="0" width="1000" height="520" fill="rgba(0,0,0,0)" />`;
    const hit = args.ui.mapEl.hit;
    hit.innerHTML = "";
    for (let i = 0; i < DETERMINISTIC_ARCHETYPES.length; i++) {
      const archetype = DETERMINISTIC_ARCHETYPES[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mapHitBtn";
      btn.dataset.detFloorArchetype = archetype;
      btn.dataset.detFloorIndex = String(floorIndex);
      btn.dataset.detDepth = String(depth);
      const col = i % 2;
      const row = Math.floor(i / 2);
      btn.style.left = `${24 + col * 36}%`;
      btn.style.top = `${18 + row * 26}%`;
      const desc =
        archetype === "VENDOR"
          ? "SHOP map"
          : archetype === "HEAL"
            ? "REST map"
            : "Procedural";
      btn.innerHTML = `
        <div class="mapHitTitle">${archetype}</div>
        <div class="mapHitDesc">${desc} · Depth ${depth}</div>
      `;
      hit.appendChild(btn);
    }
  }

  function showDelveMap(subText: string) {
    world.state = "MAP";
    args.ui.mapEl.root.hidden = false;
    args.hud.root.hidden = true;
    args.ui.mapEl.sub.textContent = subText;

    const delve = world.delveMap as DelveMap;
    if (!delve) {
      // Fallback to old map system
      showMap(subText);
      return;
    }

    const seed = world.rng.int(0, 0x7fffffff);

    // Generate adjacent nodes from current position
    if (delve.currentNodeId) {
      ensureAdjacentNodes(delve, delve.currentNodeId, seed);
    }

    // Get visible nodes and edges
      const visibleNodes = getVisibleNodes(delve, 4);
      const visibleEdges = getVisibleEdges(delve, visibleNodes);
      const reachable = new Set(getReachableNodes(delve).map(n => n.id));

      const archetypeLabel = (archetype: FloorArchetype) => {
        switch (archetype) {
          case "SURVIVE":
            return "Survive";
          case "TIME_TRIAL":
            return "Time Trial";
          case "VENDOR":
            return "Vendor";
          case "HEAL":
            return "Heal";
          case "BOSS_TRIPLE":
            return "Boss Triple";
        }
      };

      const archetypeColor = (archetype: FloorArchetype, alpha: number) => {
        const palette: Record<FloorArchetype, { r: number; g: number; b: number }> = {
          SURVIVE: { r: 96, g: 210, b: 120 },
          TIME_TRIAL: { r: 255, g: 165, b: 64 },
          VENDOR: { r: 240, g: 210, b: 90 },
          HEAL: { r: 90, g: 200, b: 200 },
          BOSS_TRIPLE: { r: 235, g: 95, b: 95 },
        };
        const c = palette[archetype];
        return `rgba(${c.r},${c.g},${c.b},${alpha})`;
      };

    // Calculate bounds for positioning
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const n of visibleNodes) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }

    // Visual margins in SVG coords (1000x520)
    const x0 = 140, x1 = 860;
    const y0 = 90, y1 = 430;

    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);

    const pos = new Map<string, { x: number; y: number }>();
    for (const n of visibleNodes) {
      const tx = rangeX > 0 ? (n.x - minX) / rangeX : 0.5;
      // Invert Y so deeper nodes are at the bottom
      const ty = rangeY > 0 ? (n.y - minY) / rangeY : 0.5;

      const x = x0 + (x1 - x0) * tx;
      const y = y0 + (y1 - y0) * ty;

      pos.set(n.id, { x, y });
    }

    // --- Draw SVG edges + nodes ---
    const svg = args.ui.mapEl.svg;

    const edgeLines = visibleEdges
      .map((e) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return "";
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round" />`;
      })
      .join("");

    const nodeCircles = visibleNodes
      .map((n) => {
        const p = pos.get(n.id)!;
        const isReach = reachable.has(n.id);
        const isCurrent = delve.currentNodeId === n.id;
        const isCompleted = n.completed;

          const fill = archetypeColor(
            n.floorArchetype,
            isCurrent ? 0.55 : isCompleted ? 0.22 : isReach ? 0.32 : 0.12
          );
          const stroke = archetypeColor(
            n.floorArchetype,
            isCurrent ? 0.95 : isReach ? 0.65 : isCompleted ? 0.45 : 0.25
          );
          const label = archetypeLabel(n.floorArchetype);

          return `
            <circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="4" />
            <text x="${p.x}" y="${p.y + 44}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.92)" font-weight="800">${label}</text>
          `;
      })
      .join("");

    svg.innerHTML = `
      <rect x="0" y="0" width="1000" height="520" fill="rgba(0,0,0,0)" />
      ${edgeLines}
      ${nodeCircles}
    `;

    // --- Hit layer buttons ---
    const hit = args.ui.mapEl.hit;
    hit.innerHTML = "";

    const toPct = (x: number, y: number) => ({ left: (x / 1000) * 100, top: (y / 520) * 100 });

    for (const n of visibleNodes) {
      const p = pos.get(n.id)!;
      const { left, top } = toPct(p.x, p.y);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mapHitBtn";
      btn.dataset.delveNodeId = n.id;
      btn.style.left = `${left}%`;
      btn.style.top = `${top}%`;

      const isReach = reachable.has(n.id);
      const isCurrent = delve.currentNodeId === n.id;
      btn.disabled = !isReach || isCurrent;

      const statusText = isCurrent ? "Current" : n.completed ? "Completed" : isReach ? "Select" : "Locked";
      const label = archetypeLabel(n.floorArchetype);

      btn.innerHTML = `
        <div class="mapHitTitle">${label}</div>
        <div class="mapHitDesc">${statusText}</div>
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

      // Add stat diffs if available
      if (def.getStatsDiff) {
        const diffs = def.getStatsDiff(world);
        if (diffs.length > 0) {
          const diffContainer = document.createElement("div");
          diffContainer.className = "choiceStats";

          for (const diff of diffs) {
            const row = document.createElement("div");
            row.className = "statRow";

            const label = document.createElement("span");
            label.className = "statLabel";
            label.textContent = diff.label;

            const values = document.createElement("span");
            values.className = "statValues";

            const oldSpan = document.createElement("span");
            oldSpan.className = "statOld";
            oldSpan.textContent = diff.oldVal;

            const arrow = document.createElement("span");
            arrow.className = diff.isIncrease ? "statArrow statUp" : "statArrow statDown";
            arrow.textContent = diff.isIncrease ? "▲" : "▼";

            const newSpan = document.createElement("span");
            newSpan.className = diff.isIncrease ? "statNew statUp" : "statNew statDown";
            newSpan.textContent = diff.newVal;

            values.appendChild(oldSpan);
            values.appendChild(arrow);
            values.appendChild(newSpan);

            row.appendChild(label);
            row.appendChild(values);
            diffContainer.appendChild(row);
          }

          btn.appendChild(diffContainer);
        }
      }

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
    
    // Show depth in delve mode
    const depthText = world.delveMap ? ` · Depth ${world.delveDepth}` : "";
    args.hud.lvlPill.textContent = `Lv: ${world.level}${depthText}`;

    // 4 weapon slots + 4 item slots, order = array order
    renderSlots(args.hud.weaponSlots, world.weapons as any, (id) => registry.weapon(id as any).title);
    renderSlots(args.hud.itemSlots, world.items as any, (id) => registry.item(id as any).title);

    const spec = world.currentObjectiveSpec;
    if (!spec || world.runState !== "FLOOR") {
      args.hud.objectiveOverlay.hidden = true;
      return;
    }

    const status = world.objectiveStates[0]?.status ?? "IDLE";
    let title = "Objective";
    let detail = "";

    switch (spec.objectiveType) {
      case "SURVIVE_TIMER": {
        const remaining = Math.max(0, spec.params.timeLimitSec - world.phaseTime);
        title = "Survive";
        detail = `Time Remaining: ${formatTimeMMSS(remaining)} · ${status}`;
        break;
      }
      case "TIME_TRIAL_ZONES": {
        const remaining = Math.max(0, spec.params.timeLimitSec - world.phaseTime);
        title = "Time Trial";
        detail = `Time Remaining: ${formatTimeMMSS(remaining)} · ${status}`;
        break;
      }
      case "VENDOR_VISIT":
        title = "Vendor";
        detail = `Interact to exit · ${status}`;
        break;
      case "HEAL_VISIT":
        title = "Heal";
        detail = `Interact to exit · ${status}`;
        break;
      case "KILL_RARES_IN_ZONES": {
        const progress = world.objectiveStates[0]?.progress?.signalCount ?? 0;
        title = "Boss Hunt";
        detail = `Bosses: ${Math.min(progress, spec.params.bossCount)}/${spec.params.bossCount} · ${status}`;
        break;
      }
    }

    args.hud.objectiveTitle.textContent = title;
    args.hud.objectiveStatus.textContent = detail;
    args.hud.objectiveOverlay.hidden = false;
  }
  // ---------------------------------

  function update(dt: number) {

    // Always poll input (so movement is responsive immediately after closing menus)
    inputSystem(input, args.canvas);
    updateNpcFacingRestore(performance.now());
    updateActiveInteractablePrompt();

    if (activeDialog) {
      handleDialogInput();
    }

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
    // FPS tracking
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      fpsValue = fpsFrames;
      fpsFrames = 0;
      fpsLastTime = now;

      // expose to renderSystem
      (world as any).fps = fpsValue;
    }
    if (world.state !== "RUN") return;

    if (!activeDialog && input.interactPressed && activeInteractableId) {
      const target = interactables.find((it) => it.id === activeInteractableId);
      if (target) {
        openInteractDialog(target);
        clearInputEdges(input);
        return;
      }
    }

    // total run time (optional for future meta / analytics)
    world.time += dt;

    // phase time (drives FLOOR/BOSS/TRANSITION)
    world.phaseTime += dt;

    const mapMode = !!(world as any).mapMode;

    // RunState progression (delve mode only)
    if (!mapMode) {
      if (world.runState === "FLOOR" && world.objectiveDefs.length === 0 && world.phaseTime >= world.floorDuration) {
        enterBoss(world);
      } else if (world.runState === "BOSS") {
        // If boss was killed, advance (but wait for the boss chest to be collected)
        if (!bossAlive(world)) {
          const pending = (world as any).bossRewardPending as boolean | undefined;
          if (pending) {
            // Do nothing; chest must be picked up first
          } else {
            if (isDeterministicDelveMode()) {
              showDeterministicFloorPicker(
                `Floor ${world.floorIndex + 1} cleared.\nChoose next floor type.`,
                (world.floorIndex ?? 0) + 1,
                (world.delveDepth ?? 1) + 1,
              );
              return;
            }
            // Delve mode: always show map after boss defeat (infinite progression)
            const delve = world.delveMap as DelveMap;
            if (delve) {
              showDelveMap(`Depth ${world.delveDepth} cleared!\nChoose your next destination.`);
              return;
            }

            // Legacy mode: end after 3 floors
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
          const nextFloorIndex = (world.floorIndex ?? 0) + 1;
          enterFloor(world, buildFallbackFloorIntent(world, nextFloorIndex));
        }
      }
    }

    if (!activeDialog) {
      movementSystem(world, input, dt);
    }
    roomChallengeSystem(world, dt);  // Track room challenges and lock exits
    spawnSystem(world, dt);
    const isNeutralObjectiveFloor = world.floorArchetype === "VENDOR" || world.floorArchetype === "HEAL";
    if (!isNeutralObjectiveFloor) {
      combatSystem(world, dt);
    }
    projectilesSystem(world, dt);
    collisionsSystem(world, dt);
    fissionSystem(world, dt);  // Nuclear fission: projectile-projectile collisions
    poisonSystem(world, dt);
    onKillExplodeSystem(world, dt); // NEW: explode on kill (can add more kills)
    bossSystem(world, dt);          // NEW: boss mechanics (telegraphs/hazards/dash)
    zonesSystem(world, dt);
    goldSystem(world);
    pickupsSystem(world, dt);
    xpSystem(world, dt);
    vendorSystem(world);
    triggerSystem(world, dt, input);
    bossZoneSpawnSystem(world);
    objectiveSystem(world);
    outcomeSystem(world);

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

    const isFloorObjectiveCompleted = () => {
      for (let i = 0; i < world.objectiveStates.length; i++) {
        if (world.objectiveStates[i]?.status === "COMPLETED") return true;
      }
      return false;
    };

    if (world.runState === "FLOOR" && isFloorObjectiveCompleted() && !world.bossRewardPending) {
      if (isDeterministicDelveMode()) {
        showDeterministicFloorPicker(
          `Objective complete.\nChoose next floor type.`,
          (world.floorIndex ?? 0) + 1,
          (world.delveDepth ?? 1) + 1,
        );
        return;
      }
      const delve = world.delveMap as DelveMap;
      if (delve) {
        showDelveMap(`Depth ${world.delveDepth} cleared!\nChoose your next destination.`);
        return;
      }

      (world as any).mapPendingNextFloorIndex = (world.floorIndex ?? 0) + 1;
      showMap("Choose your next zone.\n(There is a boss at the end of every floor.)");
      return;
    }

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

    // Clear per-frame edge-triggered inputs (must be at END of update)
    clearInputEdges(input);
  }

  function render() {
    renderSystem(world, args.ctx, args.canvas);
  }


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

    const detArchetype = btn.dataset.detFloorArchetype as FloorArchetype | undefined;
    if (detArchetype) {
      const floorIndex = Number.parseInt(btn.dataset.detFloorIndex ?? "0", 10) || 0;
      const depth = Number.parseInt(btn.dataset.detDepth ?? "1", 10) || 1;
      world.delveDepth = depth;
      world.delveScaling = getDepthScaling(depth);
      hideMap();
      world.state = "RUN";
      enterFloor(
        world,
        buildDeterministicFloorIntent({
          archetype: detArchetype,
          floorIndex,
          depth,
        }),
      );
      return;
    }

    // Handle delve node clicks
    const delveNodeId = btn.dataset.delveNodeId;
    if (delveNodeId) {
      const delve = world.delveMap as DelveMap;
      if (!delve) return;

      const node = moveToNode(delve, delveNodeId);
      if (!node) return;

      // Update depth and scaling
      const depth = getNodeDepth(node);
      world.delveDepth = depth;
      world.delveScaling = getDepthScaling(depth);

      // Generate adjacent nodes for next time
      const seed = world.rng.int(0, 0x7fffffff);
      ensureAdjacentNodes(delve, delveNodeId, seed);

      hideMap();
      world.state = "RUN";

      // Enter the chosen zone with depth-scaled difficulty
      // floorIndex is used for enemy type weights, zoneId for visuals/music
      const floorIndex = Math.min(2, Math.floor((depth - 1) / 3));
      enterFloor(world, buildFloorIntentFromDelveNode(node, floorIndex));
      return;
    }

    // Legacy map node clicks
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
    enterFloor(world, buildFloorIntentFromRunNode(node, nextFloor));
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

  return { update, render, startRun, startDeterministicRun, startSandboxRun, previewMap };
}
