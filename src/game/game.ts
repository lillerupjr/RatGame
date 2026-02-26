// src/game/game.ts
import { World, createWorld, clearEvents, emitEvent, gridAtPlayer } from "../engine/world/world";

import { InputState, createInputState, inputSystem, clearInputEdges } from "./systems/sim/input";
import { movementSystem } from "./systems/sim/movement";
import { spawnSystem, spawnOneTrashEnemy } from "./systems/spawn/spawn";
import { combatSystem } from "./systems/sim/combat";
import { ailmentTickSystem } from "./combat_mods/systems/ailmentTickSystem";
import { collisionsSystem } from "./systems/sim/collisions";
import { projectilesSystem } from "./systems/sim/projectiles";
import { pickupsSystem } from "./systems/progression/pickups";
import { dropsSystem } from "./systems/progression/drops";
import { renderSystem } from "./systems/presentation/render";
import { zonesSystem } from "./systems/sim/zones";
import { relicExplodeOnKillSystem } from "./systems/sim/relicExplodeOnKill";
import { bossSystem } from "./systems/progression/boss";
import { audioSystem } from "./systems/presentation/audio";
import { preloadSfx } from "../engine/audio/sfx";
import { roomChallengeSystem } from "./systems/progression/roomChallenge";
import { triggerSystem } from "./systems/progression/triggerSystem";
import { relicTriggerSystem } from "./systems/progression/relicTriggerSystem";
import { relicRetriggerSystem } from "./systems/progression/relicRetriggerSystem";
import {
  isFloorEndCountdownDone,
  maybeStartFloorEndCountdown,
  tickFloorEndCountdown,
} from "./systems/progression/floorEndCountdown";
import { hasCompletedAnyObjective, objectiveSystem } from "./systems/progression/objective";
import { outcomeSystem } from "./systems/progression/outcomeSystem";
import { bossZoneSpawnSystem } from "./systems/progression/bossZoneSpawn";

import { formatTimeMMSS } from "./util/time";
import type { WeaponId } from "./content/weapons";
import { registry } from "./content/registry";
import { spawnEnemyGrid, ENEMY_TYPE } from "./factories/enemyFactory";
import { gridToWorld } from "./coords/grid";
import { anchorFromWorld } from "./coords/anchor";
import { poisonSystem } from "./systems/sim/poison";
import { fissionSystem } from "./systems/sim/fission";
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
import { playerSpritesReady, preloadPlayerSprites, setPlayerSkin } from "../engine/render/sprites/playerSprites";
import { preloadVendorNpcSprites, vendorNpcSpritesReady } from "../engine/render/sprites/vendorSprites";
import { preloadBackgrounds } from "./render/background";
import { getProjectileSpriteByKind, preloadProjectileSprites } from "../engine/render/sprites/projectileSprites";
import { enemySpritesReady, preloadEnemySprites } from "../engine/render/sprites/enemySprites";
import {
  getSpriteByIdForPalette,
  prewarmPaletteSprites,
  preloadRenderSprites,
} from "../engine/render/sprites/renderSprites";
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
import { RNG } from "./util/rng";
import { applyObjective } from "./map/objectiveTransforms";
import { objectiveIdFromArchetype } from "./map/objectivePlan";
import { findNearestWalkableSpawnGrid } from "./systems/spawn/findWalkableSpawn";
import { DEFAULT_MAP_POOL } from "./map/mapIds";
import { OBJECTIVE_TRIGGER_IDS } from "./systems/progression/objectiveSpec";
import { getPlayableCharacter, PLAYABLE_CHARACTERS, type PlayableCharacterId } from "./content/playableCharacters";
import { getUserSettings } from "../userSettings";
import { neutralMobSpritesReady, preloadNeutralMobSprites } from "../engine/render/sprites/neutralSprites";
import { spawnMilestonePigeonNearPlayer } from "./factories/neutralMobFactory";
import { neutralAnimatedMobsSystem } from "./systems/sim/neutralAnimatedMobs";
import { neutralBirdAISystem } from "./systems/sim/neutralBirdAI";
import { getZoneTrialObjectiveState, startZoneTrial, updateZoneTrialObjective } from "./objectives/zoneObjectiveSystem";
import { collectRuntimeSpriteIdsToPrewarm } from "./render/prewarmSprites";
import { resolveActivePaletteId } from "./render/activePalette";
import { applySfxSettingsToWorld } from "./audio/audioSettings";
import { beginCardReward, chooseCardReward, ensureCardRewardState } from "./combat_mods/rewards/cardRewardFlow";
import { beginRelicReward, chooseRelicReward, ensureRelicRewardState } from "./combat_mods/rewards/relicRewardFlow";
import { addGold, getGold } from "./economy/gold";
import { getCardById } from "./combat_mods/content/cards/cardPool";
import { generateVendorCards } from "./vendor/generateVendorCards";
import { generateVendorRelicOffers } from "./vendor/generateVendorRelics";
import { createVendorState } from "./vendor/vendorState";
import { tryPurchaseVendorCard, tryPurchaseVendorRelic } from "./vendor/vendorPurchase";
import { mountCardRewardMenu } from "../ui/rewards/cardRewardMenu";
import { mountRelicRewardMenu } from "../ui/rewards/relicRewardMenu";
import { mountVendorShopMenu } from "../ui/vendor/vendorShopMenu";
import { tickSpawnDirector } from "./balance/spawnDirector";
import { tickBalanceCsvLogger } from "./balance/balanceCsvLogger";
import { BASELINE_PLAYER_DPS, computePressure } from "./balance/pressureModel";
import { DEFAULT_SPAWN_TUNING } from "./balance/spawnTuningDefaults";
import { createFloorRewardBudget, type ObjectiveMode } from "./rewards/floorRewardBudget";
import { handleRewardEvent, type RewardOutcome } from "./rewards/rewardDirector";


type HudRefs = {
  root: HTMLDivElement;
  timePill: HTMLSpanElement;
  killsPill: HTMLSpanElement;
  hpPill: HTMLSpanElement;
  armorPill: HTMLSpanElement;
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

type StartIntent =
  | { mode: "DELVE"; characterId: PlayableCharacterId }
  | { mode: "DETERMINISTIC"; characterId: PlayableCharacterId }
  | { mode: "SANDBOX"; characterId: PlayableCharacterId; mapId?: string };

type PreparedStart = {
  seed: number;
  mapId?: string;
};

type FloorLoadContext = {
  floorIntent: FloorIntent;
};

export function precomputeStaticMapData(): void {
  const map = getActiveMapDef() as any;
  if (!map) return;

  // Place all expensive O(mapTiles) stable computations here.
  if (!map.walkableMaskComputed && typeof map.computeWalkableMask === "function") {
    map.computeWalkableMask();
    map.walkableMaskComputed = true;
  }

  if (!map.roadContextComputed && typeof map.computeRoadContext === "function") {
    map.computeRoadContext();
    map.roadContextComputed = true;
  }
}


/** Create a game instance and return update/render/start handlers. */
export function createGame(args: CreateGameArgs) {
  args.hud.lvlPill.hidden = false;

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
  let vendorShopOpen = false;

  const staticMaps: TableMapDef[] = AUTHORED_MAP_DEFS;

  function getStaticMapById(id: string | undefined): TableMapDef | undefined {
    if (!id) return undefined;
    return getAuthoredMapDefByMapId(id);
  }

  function getDefaultStaticMap(): TableMapDef | undefined {
    return staticMaps[0];
  }

  function restorePendingNpcFacing(): void {
    if (!pendingNpcFaceRestoreId) return;
    const npc = world.npcs.find((n) => n.id === pendingNpcFaceRestoreId);
    if (npc) npc.faceRestoreAtMs = performance.now() + 3000;
    pendingNpcFaceRestoreId = null;
  }

  function resolvePendingAdvanceAfterInteractionClose(): void {
    if (!world.pendingAdvanceToNextFloor) return;
    if (maybeHandleObjectiveCompletionReward()) {
      world.pendingAdvanceToNextFloor = false;
      return;
    }
    if (tryAdvanceAfterObjectiveCompletion()) {
      world.pendingAdvanceToNextFloor = false;
    }
  }

  function setDialog(dialog: DialogState | null) {
    activeDialog = dialog;
    if (!dialog) {
      restorePendingNpcFacing();
      args.ui.dialogEl.root.hidden = true;
      args.ui.dialogEl.text.textContent = "";
      args.ui.dialogEl.choices.innerHTML = "";
      resolvePendingAdvanceAfterInteractionClose();
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
    if (activeDialog || vendorShopOpen) return;
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
      openVendorShop();
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
            world.pendingAdvanceToNextFloor = true;
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
    if (vendorShopOpen) {
      activeInteractableId = null;
      args.hud.interactPrompt.textContent = "Shop open";
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

  function tryAdvanceAfterObjectiveCompletion(): boolean {
    if (!hasCompletedAnyObjective(world)) return false;
    const isLegacyFinalFloor =
      !isDeterministicDelveMode() &&
      !world.delveMap &&
      (world.floorIndex ?? 0) >= FLOORS_PER_RUN - 1 &&
      world.runState !== "TRANSITION";
    if (isLegacyFinalFloor) {
      completeRun(world);
      return true;
    }
    if (world.runState === "TRANSITION") return false;
    if (world.state === "REWARD" && world.cardReward?.active) return false;
    if (world.state === "REWARD" && world.relicReward?.active) return false;
    if (world.floorEndCountdownActive && world.floorEndCountdownSec > 0) return false;

    if (isDeterministicDelveMode()) {
      showDeterministicFloorPicker(
        "Objective complete.\nChoose next floor type.",
        (world.floorIndex ?? 0) + 1,
        (world.delveDepth ?? 1) + 1,
      );
      return true;
    }

    const delve = world.delveMap as DelveMap;
    if (delve) {
      showDelveMap(`Depth ${world.delveDepth} cleared!\nChoose your next destination.`);
      return true;
    }

    (world as any).mapPendingNextFloorIndex = (world.floorIndex ?? 0) + 1;
    showMap("Choose your next zone.\n(There is a boss at the end of every floor.)");
    return true;
  }

  function objectiveModeForFloor(w: World): ObjectiveMode {
    if (w.floorArchetype === "SURVIVE") return "SURVIVE_TRIAL";
    if (w.floorArchetype === "TIME_TRIAL") return "ZONE_TRIAL";
    return "NORMAL";
  }

  function floorDepthForRewards(w: World): number {
    if (Number.isFinite(w.delveDepth) && w.delveDepth > 0) return w.delveDepth;
    return (w.floorIndex ?? 0) + 1;
  }

  function consumeFirstZoneClearedSignal(w: World): (1 | 2) | null {
    const signals = w.triggerSignals;
    for (let i = 0; i < signals.length; i++) {
      const id = signals[i]?.triggerId;
      if (typeof id !== "string" || !id.startsWith(OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix)) continue;
      signals.splice(i, 1);
      const raw = Number.parseInt(id.slice(OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix.length), 10);
      if (raw === 1 || raw === 2) return raw;
      return null;
    }
    return null;
  }

  function syncRewardDebugFieldsFromBudget(w: World): void {
    const budget = w.floorRewardBudget;
    const nonObjectiveUsed = 2 - budget.nonObjectiveCardsRemaining;
    const objectiveUsed = budget.objectiveCardAvailable ? 0 : 1;
    w.cardRewardBudgetTotal = 3;
    w.cardRewardBudgetUsed = nonObjectiveUsed + objectiveUsed;
    w.cardRewardClaimKeys = Object.keys(budget.fired);
  }

  function applyRewardOutcome(
    outcome: RewardOutcome,
    cardSource: "ZONE_TRIAL" | "BOSS_CHEST",
    mode: "CARD" | "RELIC" = "CARD",
  ): boolean {
    syncRewardDebugFieldsFromBudget(world);
    if (outcome.type === "GRANT_CARD") {
    if (activeDialog) setDialog(null);
    if (vendorShopOpen) closeVendorShop(false);
      if (mode === "RELIC") {
        const cardReward = ensureCardRewardState(world);
        cardReward.active = false;
        cardReward.options = [];
        beginRelicReward(world, "OBJECTIVE_COMPLETION", 3);
      } else {
        const relicReward = ensureRelicRewardState(world);
        relicReward.active = false;
        relicReward.options = [];
        beginCardReward(world, cardSource, 3);
      }
      world.state = "REWARD";
      world.lastCardRewardClaimKey = outcome.reason;
      renderRewardMenuIfNeeded();
      return true;
    }
    if (outcome.type === "GRANT_GOLD") {
      addGold(world, outcome.amount);
      world.lastCardRewardClaimKey = outcome.reason;
      return false;
    }
    world.lastCardRewardClaimKey = outcome.reason;
    return false;
  }

  function maybeHandleZoneTrialMilestoneReward(): boolean {
    if (world.state !== "RUN" || world.runState !== "FLOOR") return false;
    if (world.floorRewardBudget.mode !== "ZONE_TRIAL") return false;
    // Final zone clear should resolve through objective completion (relic reward),
    // not through zone milestone card rewards.
    if (hasCompletedAnyObjective(world)) return false;
    const zoneIndex = consumeFirstZoneClearedSignal(world);
    if (!zoneIndex) return false;
    const outcome = handleRewardEvent(
      world.floorRewardBudget,
      { type: "ZONE_COMPLETED", zoneIndex },
      { depth: floorDepthForRewards(world) }
    );
    return applyRewardOutcome(outcome, "ZONE_TRIAL");
  }

  function maybeHandleSurviveOneMinuteReward(): boolean {
    if (world.state !== "RUN" || world.runState !== "FLOOR") return false;
    if (world.floorRewardBudget.mode !== "SURVIVE_TRIAL") return false;
    if ((world.timeSec ?? 0) < 60) return false;
    const outcome = handleRewardEvent(
      world.floorRewardBudget,
      { type: "SURVIVE_1MIN_REWARD" },
      { depth: floorDepthForRewards(world) }
    );
    return applyRewardOutcome(outcome, "ZONE_TRIAL");
  }

  function maybeHandleObjectiveCompletionReward(): boolean {
    if (world.state !== "RUN" || world.runState !== "FLOOR") return false;
    if (world.floorArchetype === "VENDOR" || world.floorArchetype === "HEAL") return false;
    if (!hasCompletedAnyObjective(world)) return false;
    const outcome = handleRewardEvent(
      world.floorRewardBudget,
      { type: "OBJECTIVE_COMPLETED" },
      { depth: floorDepthForRewards(world) }
    );
    return applyRewardOutcome(outcome, "ZONE_TRIAL", "RELIC");
  }

  function maybeHandleChestOpenedReward(): boolean {
    if (!world.chestOpenRequested) return false;
    world.chestOpenRequested = false;
    const outcome = handleRewardEvent(
      world.floorRewardBudget,
      { type: "CHEST_OPENED", chestKind: "BOSS" },
      { depth: floorDepthForRewards(world) }
    );
    return applyRewardOutcome(outcome, "BOSS_CHEST");
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

  let world: World = createWorld({ seed: 1337, stage: cloneStage("DOCKS") });
  applyObjectivesFromActiveMap(world);
  applyMapFeaturesFromCells(world);
  applyDebugSpawn(world);
  const cardRewardMenu = mountCardRewardMenu({
    root: args.ui.levelupEl.root,
    onPick: (cardId: string) => {
      const reward = ensureCardRewardState(world);
      if (!reward.active) return;
      const source = reward.source;
      chooseCardReward(world, cardId);
      renderRewardMenuIfNeeded();

      if (source === "ZONE_TRIAL" && tryAdvanceAfterObjectiveCompletion()) {
        return;
      }
      world.state = "RUN";
    },
  });
  const relicRewardRoot = document.createElement("div");
  relicRewardRoot.id = "relicReward";
  relicRewardRoot.hidden = true;
  document.body.appendChild(relicRewardRoot);
  const relicRewardMenu = mountRelicRewardMenu({
    root: relicRewardRoot,
    onPick: (relicId: string) => {
      const reward = ensureRelicRewardState(world);
      if (!reward.active) return;
      chooseRelicReward(world, relicId);
      renderRewardMenuIfNeeded();
      if (tryAdvanceAfterObjectiveCompletion()) return;
      world.state = "RUN";
    },
  });
  const vendorRoot = document.createElement("div");
  vendorRoot.id = "vendorShop";
  vendorRoot.hidden = true;
  document.body.appendChild(vendorRoot);
  const vendorPrice = 100;
  const vendorShopMenu = mountVendorShopMenu({
    root: vendorRoot,
    onBuy: (index: number) => {
      if (tryPurchaseVendorCard(world, index)) {
        renderVendorShopIfNeeded();
      }
    },
    onBuyRelic: (index: number) => {
      if (tryPurchaseVendorRelic(world, index)) {
        renderVendorShopIfNeeded();
      }
    },
    onLeave: () => {
      completeObjectiveById(OBJECTIVE_TRIGGER_IDS.vendor);
      world.pendingAdvanceToNextFloor = true;
      closeVendorShop(true);
    },
    onClose: () => closeVendorShop(false),
  });
  let lastVendorRenderKey = "";
  let lastRewardRenderKey = "";

  const renderRewardMenuIfNeeded = (): void => {
    const reward = ensureCardRewardState(world);
    const relicReward = ensureRelicRewardState(world);
    const key = `${world.state}|c:${reward.active ? 1 : 0}|${reward.source}|${reward.options.join(",")}|r:${relicReward.active ? 1 : 0}|${relicReward.source}|${relicReward.options.join(",")}`;
    if (key === lastRewardRenderKey) return;
    cardRewardMenu.render(reward.active ? reward : null);
    relicRewardMenu.render(relicReward.active ? relicReward : null);
    lastRewardRenderKey = key;
  };

  function renderVendorShopIfNeeded(): void {
    if (!vendorShopOpen) {
      vendorShopMenu.render(null);
      lastVendorRenderKey = "";
      return;
    }
    const vendor = world.vendor;
    if (!vendor) {
      closeVendorShop(false);
      return;
    }
    const key = `${getGold(world)}|${vendor.cards.join(",")}|${vendor.purchased.map((p) => (p ? "1" : "0")).join("")}|${(vendor.relicOffers ?? []).map((o) => `${o.relicId}:${o.priceG}:${o.isSold ? 1 : 0}`).join(",")}`;
    if (key === lastVendorRenderKey) return;
    vendorShopMenu.render({
      active: true,
      gold: getGold(world),
      price: vendorPrice,
      cards: vendor.cards.map((cardId, index) => ({
        cardId,
        purchased: !!vendor.purchased[index],
      })),
      relicOffers: (vendor.relicOffers ?? []).map((offer) => ({
        relicId: offer.relicId,
        priceG: offer.priceG,
        isSold: offer.isSold,
      })),
    });
    lastVendorRenderKey = key;
  }

  function openVendorShop(): void {
    vendorShopOpen = true;
    activeDialog = null;
    args.ui.dialogEl.root.hidden = true;
    args.ui.dialogEl.text.textContent = "";
    args.ui.dialogEl.choices.innerHTML = "";
    renderVendorShopIfNeeded();
  }

  function closeVendorShop(resolvePendingAdvance: boolean): void {
    if (!vendorShopOpen) return;
    vendorShopOpen = false;
    vendorShopMenu.render(null);
    lastVendorRenderKey = "";
    restorePendingNpcFacing();
    if (resolvePendingAdvance) resolvePendingAdvanceAfterInteractionClose();
  }
  let pendingStartIntent: StartIntent | null = null;
  let pendingFloorIntent: FloorIntent | null = null;
  let preparedStart: PreparedStart | null = null;
  let bootAssetsPreloaded = false;
  let floorLoadContext: FloorLoadContext | null = null;

  const applyPlayerSkinSelection = (skin: string) => {
    setPlayerSkin(skin);
    (world as any)._playerSkin = skin;
  };

  const defaultCharacter = PLAYABLE_CHARACTERS[0];
  if (defaultCharacter) {
    applyPlayerSkinSelection(defaultCharacter.idleSpriteKey);
  }

  function preloadBootAssets() {
    if (bootAssetsPreloaded) return;
    bootAssetsPreloaded = true;
    preloadBackgrounds();
    preloadPlayerSprites();
    preloadVendorNpcSprites();
    preloadProjectileSprites();
    preloadNeutralMobSprites();
    preloadSfx();
    preloadKenneyTiles();
  }

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

  const floorArchetypeLabel = (archetype: FloorArchetype): string => {
    switch (archetype) {
      case "SURVIVE":
        return "Survive";
      case "TIME_TRIAL":
        return "Zone Trial";
      case "VENDOR":
        return "Vendor";
      case "HEAL":
        return "Heal";
      case "BOSS_TRIPLE":
        return "Boss Triple";
    }
  };

  const hashString = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  };

  const isDeterministicDelveMode = () => !!(world as any).deterministicDelveMode;

  function cloneStage(stageId: "DOCKS" | "SEWERS" | "CHINATOWN") {
    // Stage defs are immutable now (no timeline spawns).
    return { ...registry.stage(stageId) };
  }

  function clearFloorEntities(w: World) {
    // Keep player stats/items/weapons; wipe transient entities.
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
    w.eAilments = [];

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
    w.prDmgPhys = [];
    w.prDmgFire = [];
    w.prDmgChaos = [];
    w.prCritChance = [];
    w.prCritMulti = [];
    w.prChanceBleed = [];
    w.prChanceIgnite = [];
    w.prChancePoison = [];
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
    w.neutralMobs = [];
  }

  function bossAlive(w: World): boolean {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      if (w.eType[i] === ENEMY_TYPE.BOSS) return true;
    }
    return false;
  }

  function spawnSurviveBossIfNeeded(w: World): void {
    if (w.floorArchetype !== "SURVIVE") return;
    if (w.runState !== "FLOOR") return;
    if ((w as any)._surviveBossSpawned) return;
    const remaining = (w.floorDuration ?? 0) - (w.phaseTime ?? 0);
    if (remaining > 30) return;

    const pg = gridAtPlayer(w);
    const pw = gridToWorld(pg.gx, pg.gy, KENNEY_TILE_WORLD);
    const angle = w.rng.range(0, Math.PI * 2);
    const radius = w.rng.range(320, 520);
    const wx = pw.wx + Math.cos(angle) * radius;
    const wy = pw.wy + Math.sin(angle) * radius;
    const gp = findNearestWalkableSpawnGrid(w, wx, wy);
    spawnEnemyGrid(w, ENEMY_TYPE.BOSS, gp.gx, gp.gy, KENNEY_TILE_WORLD);
    (w as any)._surviveBossSpawned = true;
  }

  function syncBossTripleNavState(w: World): void {
    if (w.floorArchetype !== "BOSS_TRIPLE") {
      w.bossTriple = undefined;
      return;
    }
    const defs = (w.overlayTriggerDefs ?? []).filter((d) =>
      typeof d.id === "string" && d.id.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)
    );
    defs.sort((a, b) => a.id.localeCompare(b.id));
    const spawnPointsWorld = defs.map((d) => ({
      x: (d.tx + 0.5) * KENNEY_TILE_WORLD,
      y: (d.ty + 0.5) * KENNEY_TILE_WORLD,
    }));
    const completed =
      w.bossTriple?.completed && w.bossTriple.completed.length === spawnPointsWorld.length
        ? w.bossTriple.completed.slice()
        : spawnPointsWorld.map(() => false);
    w.bossTriple = { spawnPointsWorld, completed };
  }

  function syncZoneTrialNavState(w: World): void {
    const state = getZoneTrialObjectiveState(w);
    const map = getActiveMap();
    if (!state || !Array.isArray(state.zones)) {
      w.zoneTrial = undefined;
      return;
    }
    w.zoneTrial = {
      originTx: map?.originTx ?? 0,
      originTy: map?.originTy ?? 0,
      zones: state.zones.map((z: any) => ({
        tx: z.tileX,
        ty: z.tileY,
        w: z.tileW,
        h: z.tileH,
        completed: !!z.completed,
      })),
    };
  }

  function markBossClearCompletionFromSignals(w: World): void {
    const bt = w.bossTriple;
    if (!bt || !Array.isArray(bt.completed)) return;
    const signals = w.triggerSignals;
    if (!Array.isArray(signals) || signals.length === 0) return;
    for (let i = 0; i < signals.length; i++) {
      const id = signals[i]?.triggerId;
      if (typeof id !== "string" || !id.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)) continue;
      const raw = id.slice(OBJECTIVE_TRIGGER_IDS.bossZonePrefix.length);
      const idx = Number.parseInt(raw, 10) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= bt.completed.length) continue;
      bt.completed[idx] = true;
    }
  }

  function beginFloorLoad(floorIntent: FloorIntent): boolean {
    const w = world;
    setDialog(null);
    closeVendorShop(false);
    if (w.delveMap && !floorIntent.mapId) {
      console.error("[enterFloor] delve floor intent missing mapId");
      return false;
    }
    w.floorIndex = floorIntent.floorIndex;
    w.floorArchetype = floorIntent.archetype;
    w.currentFloorIntent = floorIntent;

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
        return false;
      }
      const baseMap = getStaticMapById(floorIntent.mapId);
      if (!baseMap) {
        console.error(`[enterFloor] missing authored map for mapId="${floorIntent.mapId}"`);
        return false;
      }
      if (floorIntent.variantSeed === undefined) {
        console.error("[enterFloor] missing variantSeed for planned floor");
        return false;
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

    floorLoadContext = { floorIntent };
    return true;
  }

  async function prewarmFloorLoadSprites(): Promise<void> {
    const w = world;
    const paletteId = resolveActivePaletteId();
    const spriteIds = collectRuntimeSpriteIdsToPrewarm(w);
    await prewarmPaletteSprites(paletteId, spriteIds);

    // 1) Always warm entity/core sprite modules.
    await awaitCoreSpriteReadiness(spriteIds, 1500);

    // 2) One more short wait to ensure swapped images are installed.
    await awaitCoreSpriteReadiness(spriteIds, 300);
  }

  function finalizeFloorLoad(): void {
    const w = world;
    const ctx = floorLoadContext;
    if (!ctx) return;
    const floorIntent = ctx.floorIntent;

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
    spawnMilestonePigeonNearPlayer(w);

    const objectiveSpec = objectiveSpecFromFloorIntent(ctx.floorIntent);
    w.currentObjectiveSpec = objectiveSpec;
    setObjectivesFromSpec(w, objectiveSpec);
    w.floorRewardBudget = createFloorRewardBudget(objectiveModeForFloor(w));
    w.objectiveRewardClaimedKey = null;
    (w as any).zoneRewardClaimedKey = null;
    (w as any).zoneRewardClaimedKeys = [];
    w.cardRewardBudgetTotal = 3;
    w.cardRewardBudgetUsed = 0;
    w.cardRewardClaimKeys = [];
    w.lastCardRewardClaimKey = null;
    w.floorEndCountdownSec = 0;
    w.floorEndCountdownActive = false;
    w.floorEndCountdownStartedKey = null;
    syncRewardDebugFieldsFromBudget(w);
    w.cardReward.active = false;
    w.cardReward.options = [];
    w.relicReward.active = false;
    w.relicReward.options = [];
    startZoneTrial(w);
    syncZoneTrialNavState(w);
    syncBossTripleNavState(w);
    if (objectiveSpec.objectiveType === "SURVIVE_TIMER") {
      w.floorDuration = objectiveSpec.params.timeLimitSec;
    }

    w.vendor = floorIntent.archetype === "VENDOR"
      ? createVendorState(
        generateVendorCards(5),
        generateVendorRelicOffers(w, 5, 500),
      )
      : null;
    w.vendorOffers = [];
    (w as any)._surviveBossSpawned = false;
    w.bossZoneSpawned = [];
    w.runState = "FLOOR";
    w.phaseTime = 0;
    w.transitionTime = 0;

    // Reset Spawn Director per-floor.
    if (w.spawnDirectorState) {
      w.spawnDirectorState.powerBudget = 0;
      w.spawnDirectorState.pendingHpCommitted = 0;
      w.spawnDirectorState.pendingSpawns = 0;
      w.spawnDirectorState.waveRemaining = 0;
      w.spawnDirectorState.chunkCooldownSec = 0;
      w.spawnDirectorState.waveCooldownSecLeft = 0;
      w.spawnDirectorState.lastChunkSize = 0;
      w.spawnDirectorState.queueEvents = [];
      w.spawnDirectorState.queuedPerSecond = 0;
      w.spawnDirectorState.spawnEvents = [];
      w.spawnDirectorState.spawnsPerSecond = 0;
    }

    const depth = Math.max(1, Math.floor((w.currentFloorIntent?.depth ?? (w.floorIndex ?? 0) + 1) as number));
    const seed = 10;

    if (w.spawnDirectorState) {
      w.spawnDirectorState.pendingSpawns += seed;
    }

    if ((w as any).debug?.verboseSpawnLogs) {
      const tuning = (w as any).balance?.spawnTuning ?? {};
      const spawnBase = typeof tuning.spawnBase === "number" ? tuning.spawnBase : DEFAULT_SPAWN_TUNING.spawnBase;
      const spawnPerDepth = typeof tuning.spawnPerDepth === "number" ? tuning.spawnPerDepth : DEFAULT_SPAWN_TUNING.spawnPerDepth;
      const pressureAt0Sec = typeof tuning.pressureAt0Sec === "number" ? tuning.pressureAt0Sec : DEFAULT_SPAWN_TUNING.pressureAt0Sec;
      const pressureAt120Sec = typeof tuning.pressureAt120Sec === "number" ? tuning.pressureAt120Sec : DEFAULT_SPAWN_TUNING.pressureAt120Sec;
      const spawnMult = spawnBase * Math.pow(Math.max(0.0001, spawnPerDepth), Math.max(0, depth - 1));
      const pressure = computePressure(0, pressureAt0Sec, pressureAt120Sec);
      const spawnHPPerSecond = BASELINE_PLAYER_DPS * pressure * spawnMult;
      console.log(
        "[SpawnModel]",
        "depth=", depth,
        "pressure=", pressure.toFixed(2),
        "spawnHPPerSec=", spawnHPPerSecond.toFixed(2)
      );
    }

    emitEvent(w, { type: "SFX", id: "FLOOR_START", vol: 0.9, rate: 1 });
    floorLoadContext = null;

    // Enter gameplay state (delve picker leaves us in MAP; floor load must resume RUN).
    w.state = "RUN";

    // UI: hide map overlay, show HUD.
    args.ui.mapEl.root.hidden = true;
    args.hud.root.hidden = false;
    hideCardRewardMenu();
  }

  async function enterFloor(w: World, floorIntent: FloorIntent): Promise<void> {
    void w;
    if (!beginFloorLoad(floorIntent)) return;
    await prewarmFloorLoadSprites();
    finalizeFloorLoad();
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

    // Reset chest handshake state for this encounter.
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
    const gp = findNearestWalkableSpawnGrid(w, sx, sy);
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
    // WIN CONDITION: final-floor objective completion.
    w.runState = "RUN_COMPLETE";
    w.state = "WIN";

    args.ui.endEl.title.textContent = "Run Complete";
    args.ui.endEl.sub.textContent =
        `Final floor objective completed.\n` +
        `Time: ${formatTimeMMSS(w.time)} · Kills: ${w.kills}`;

    args.ui.endEl.root.hidden = false;
    args.ui.menuEl.hidden = true;
    args.hud.root.hidden = true;
    hideCardRewardMenu();
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
    void mapId;
  }

  function resetRun(mapId?: string, options?: { skipMapSelection?: boolean; seedOverride?: number }) {
    setDialog(null);
    closeVendorShop(false);
    const seed = options?.seedOverride ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    if (!options?.skipMapSelection) {
      applyMapSelection(mapId, seed);
    }
    world = createWorld({
      seed,
      stage: cloneStage("DOCKS"),
    });
    applySfxSettingsToWorld(world);
    (world as any).deterministicDelveMode = false;
    (world as any).combatMode = "mods";
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
    spawnMilestonePigeonNearPlayer(world);

    hideCardRewardMenu();
  }

  function executeStartRun(characterId: PlayableCharacterId) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(undefined, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;

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

  function executeStartDeterministicRun(characterId: PlayableCharacterId) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(undefined, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;

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
    hideCardRewardMenu();

    showDeterministicFloorPicker(
      "Path Select mode: choose any floor type.",
      0,
      1,
    );
  }

  function executeStartSandboxRun(characterId: PlayableCharacterId, mapId?: string) {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    resetRun(mapId, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;

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
    hideCardRewardMenu();
  }

  function prepareStartMap(intent: StartIntent): void {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
 
    // Only sandbox preloads/activates a map at start.
    // DELVE/DETERMINISTIC should NOT compile or activate any map until a floor is chosen.
    const mapId = intent.mode === "SANDBOX" ? intent.mapId : undefined;

    if (intent.mode === "SANDBOX") {
      applyMapSelection(mapId, seed);
    }

    preparedStart = { seed, mapId };
  }

  async function awaitCoreSpriteReadiness(
    runtimeSpriteIds: string[],
    maxWaitMs: number = 1500,
  ): Promise<void> {
    // Kick idempotent loads.
    preloadPlayerSprites();
    preloadEnemySprites();
    preloadVendorNpcSprites();
    preloadNeutralMobSprites();
    preloadProjectileSprites();
    preloadRenderSprites();

    const start = performance.now();

    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - start;
        const paletteId = resolveActivePaletteId();
        const projectileKinds = [1, 2, 3, 4, 5, 6];
        const projectilesReady = projectileKinds.every((kind) => {
          const rec = getProjectileSpriteByKind(kind);
          return !!rec?.ready;
        });
        const runtimeReady = runtimeSpriteIds.every((id) => {
          const rec = getSpriteByIdForPalette(id, paletteId);
          return rec.ready;
        });

        const ready =
          playerSpritesReady()
          && vendorNpcSpritesReady()
          && enemySpritesReady()
          && neutralMobSpritesReady()
          && projectilesReady
          && runtimeReady;

        if (ready || elapsed >= maxWaitMs) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function prewarmActiveMapSpritesForCurrentPalette(): Promise<void> {
    const paletteId = resolveActivePaletteId();
    const spriteIds = collectRuntimeSpriteIdsToPrewarm(world);
    await prewarmPaletteSprites(paletteId, spriteIds);

    // Always warm entity/core sprite modules.
    await awaitCoreSpriteReadiness(spriteIds, 1500);

    // Ensure swapped images have landed before leaving LOADING.
    await awaitCoreSpriteReadiness(spriteIds, 300);
  }

  function performPreparedStartIntent(intent: StartIntent): void {
    if (!preparedStart) {
      prepareStartMap(intent);
    }
    if (intent.mode === "SANDBOX") {
      executeStartSandboxRun(intent.characterId, intent.mapId);
    } else if (intent.mode === "DETERMINISTIC") {
      executeStartDeterministicRun(intent.characterId);
    } else {
      executeStartRun(intent.characterId);
    }
    preparedStart = null;
  }

  function queueStartIntent(intent: StartIntent): void {
    pendingStartIntent = intent;
  }

  function consumePendingStartIntent(): StartIntent | null {
    const out = pendingStartIntent;
    pendingStartIntent = null;
    return out;
  }

  function queueFloorLoadIntent(intent: FloorIntent): void {
    pendingFloorIntent = intent;
  }

  function consumePendingFloorLoadIntent(): FloorIntent | null {
    const out = pendingFloorIntent;
    pendingFloorIntent = null;
    return out;
  }

  function startRun(characterId: PlayableCharacterId) {
    queueStartIntent({ mode: "DELVE", characterId });
  }

  function startDeterministicRun(characterId: PlayableCharacterId) {
    queueStartIntent({ mode: "DETERMINISTIC", characterId });
  }

  function startSandboxRun(characterId: PlayableCharacterId, mapId?: string) {
    queueStartIntent({ mode: "SANDBOX", characterId, mapId });
  }

  function quitRunToMenu() {
    pendingStartIntent = null;
    pendingFloorIntent = null;
    preparedStart = null;
    floorLoadContext = null;
    setDialog(null);
    clearFloorEntities(world);
    clearEvents(world);
    world.state = "MENU";
    world.runState = "FLOOR";
    world.currentFloorIntent = null;
    world.objectiveRewardClaimedKey = null;
    (world as any).deterministicDelveMode = false;
    args.ui.mapEl.root.hidden = true;
    hideCardRewardMenu();
    closeVendorShop(false);
    args.ui.endEl.root.hidden = true;
    args.ui.dialogEl.root.hidden = true;
    args.hud.root.hidden = true;
    args.ui.menuEl.hidden = true;
    stopMusic();
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

  function hideCardRewardMenu(): void {
    cardRewardMenu.render(null);
    relicRewardMenu.render(null);
    lastRewardRenderKey = "";
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
        <div class="mapHitTitle">${floorArchetypeLabel(archetype)}</div>
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
          const label = floorArchetypeLabel(n.floorArchetype);

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
      const label = floorArchetypeLabel(n.floorArchetype);

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
    args.hud.armorPill.textContent = `Armor: ${Math.max(0, Math.ceil(world.currentArmor))}/${world.maxArmor}`;
    
    args.hud.lvlPill.textContent = `Gold: ${getGold(world)}`;

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
      case "ZONE_TRIAL": {
        const zoneState = getZoneTrialObjectiveState(world);
        const target = zoneState?.zones[0]?.killTarget ?? spec.params.killTargetPerZone;
        title = "Slay enemies inside the marked zones.";
        detail = `Defeat ${target} enemies in each zone · ${status}`;
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

    if (world.floorEndCountdownActive) {
      const secs = Math.max(0, Math.ceil(world.floorEndCountdownSec));
      detail = `Leaving in ${secs}...`;
    }

    args.hud.objectiveTitle.textContent = title;
    args.hud.objectiveStatus.textContent = detail;
    args.hud.objectiveOverlay.hidden = false;
  }
  // ---------------------------------

  function finishFloorEndCountdown(): boolean {
    world.state = "RUN";
    if (world.cardReward) {
      world.cardReward.active = false;
      world.cardReward.options = [];
    }
    if (world.relicReward) {
      world.relicReward.active = false;
      world.relicReward.options = [];
    }
    hideCardRewardMenu();
    world.floorEndCountdownActive = false;
    if (tryAdvanceAfterObjectiveCompletion()) {
      clearEvents(world);
      return true;
    }
    clearEvents(world);
    return false;
  }

  function update(dt: number) {

    // Always poll input (so movement is responsive immediately after closing menus)
    inputSystem(input, args.canvas);
    updateNpcFacingRestore(performance.now());
    updateActiveInteractablePrompt();

    if (activeDialog) {
      handleDialogInput();
    }
    renderVendorShopIfNeeded();

    // Handle pause states
    if (world.state === "REWARD" || world.state === "MAP") {
      if (world.state === "REWARD") {
        tickFloorEndCountdown(world, dt);
        if (isFloorEndCountdownDone(world)) {
          finishFloorEndCountdown();
          return;
        }
      }
      // HUD still updates while paused
      args.hud.timePill.textContent = hudTimeText(world);
      args.hud.killsPill.textContent = `Kills: ${world.kills}`;
      args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
      args.hud.armorPill.textContent = `Armor: ${Math.max(0, Math.ceil(world.currentArmor))}/${world.maxArmor}`;
      args.hud.lvlPill.textContent = `Gold: ${getGold(world)}`;
      renderRewardMenuIfNeeded();
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

    if (!activeDialog && !vendorShopOpen && input.interactPressed && activeInteractableId) {
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
    // Spawn pacing uses the same clock as floor progression/spawn cadence.
    world.timeSec = world.phaseTime;
    world.level = 1;

    const mapMode = !!(world as any).mapMode;

    // RunState progression (delve mode only)
    if (!mapMode) {
      if (world.runState === "FLOOR" && world.objectiveDefs.length === 0 && world.phaseTime >= world.floorDuration) {
        enterBoss(world);
      }
    }
    if (world.runState === "TRANSITION") {
      world.transitionTime = Math.max(0, world.transitionTime - dt);
      if (world.transitionTime <= 0) {
        const nextFloorIndex = (world.floorIndex ?? 0) + 1;
        void enterFloor(world, buildFallbackFloorIntent(world, nextFloorIndex));
      }
    }

    if (!activeDialog && !vendorShopOpen) {
      movementSystem(world, input, dt);
    }
    neutralBirdAISystem(world, dt);
    neutralAnimatedMobsSystem(world, dt);
    roomChallengeSystem(world, dt);  // Track room challenges and lock exits
    spawnSurviveBossIfNeeded(world);
    world.spawnDirectorConfig.enabled = !!world.balance.spawnDirectorEnabled;
    if (world.balance.spawnDirectorEnabled) {
      if (!world.floorEndCountdownActive) {
        tickSpawnDirector(
          world,
          dt,
          world.spawnDirectorConfig,
          world.expectedPowerConfig,
          world.expectedPowerBudgetConfig,
          world.spawnDirectorState,
          {
            getDepth: () => {
              if (Number.isFinite(world.delveDepth) && world.delveDepth > 0) return world.delveDepth;
              return (world.floorIndex ?? 0) + 1;
            },
            isBossActive: () => world.runState === "BOSS" || bossAlive(world),
            canSpawnNow: () => world.runState === "FLOOR" && world.phaseTime >= 2,
            spawnTrash: () => {
              return spawnOneTrashEnemy(world, undefined, undefined, "trash");
            },
          }
        );
      }
    } else {
      if (!world.floorEndCountdownActive) {
        spawnSystem(world, dt);
      }
    }
    tickBalanceCsvLogger(world as any, dt);
    const isNeutralObjectiveFloor = world.floorArchetype === "VENDOR" || world.floorArchetype === "HEAL";
    if (!isNeutralObjectiveFloor) {
      combatSystem(world, dt);
    }
    projectilesSystem(world, dt);
    collisionsSystem(world, dt);
    const combatMode = (world as any).combatMode ?? "mods";
    if (combatMode === "mods") {
      ailmentTickSystem(world, dt);
    }
    fissionSystem(world, dt);  // Nuclear fission: projectile-projectile collisions
    poisonSystem(world, dt);
    relicExplodeOnKillSystem(world, dt);
    bossSystem(world, dt);          // NEW: boss mechanics (telegraphs/hazards/dash)
    zonesSystem(world, dt);
    pickupsSystem(world, dt);
    dropsSystem(world, dt);
    triggerSystem(world, dt, input);
    relicTriggerSystem(world);
    relicRetriggerSystem(world);
    updateZoneTrialObjective(world);
    syncZoneTrialNavState(world);
    markBossClearCompletionFromSignals(world);
    bossZoneSpawnSystem(world);
    objectiveSystem(world);
    if (maybeHandleZoneTrialMilestoneReward()) {
      clearEvents(world);
      return;
    }
    if (maybeHandleSurviveOneMinuteReward()) {
      clearEvents(world);
      return;
    }
    if (maybeHandleObjectiveCompletionReward()) {
      clearEvents(world);
      return;
    }
    if (!world.cardReward?.active && !world.relicReward?.active) {
      maybeStartFloorEndCountdown(world);
    }
    tickFloorEndCountdown(world, dt);
    if (isFloorEndCountdownDone(world)) {
      finishFloorEndCountdown();
      return;
    }
    outcomeSystem(world);

    // SFX consumes events before any early-return branches
    audioSystem(world, dt);

    // Chest open reward outcome (card while budget remains, else gold fallback).
    if (maybeHandleChestOpenedReward()) {
      clearEvents(world);
      return;
    }

    // Clear events AFTER all consumers ran this frame
    clearEvents(world);
    if (tryAdvanceAfterObjectiveCompletion()) {
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
      hideCardRewardMenu();
      return;
    }


    // HUD
    args.hud.timePill.textContent = hudTimeText(world);
    args.hud.killsPill.textContent = `Kills: ${world.kills}`;
    args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
    args.hud.armorPill.textContent = `Armor: ${Math.max(0, Math.ceil(world.currentArmor))}/${world.maxArmor}`;
    args.hud.lvlPill.textContent = `Gold: ${getGold(world)}`;
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
    hideCardRewardMenu();
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
      queueFloorLoadIntent(
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

      // Enter the chosen zone with depth-scaled difficulty
      // floorIndex is used for enemy type weights, zoneId for visuals/music
      const floorIndex = Math.min(2, Math.floor((depth - 1) / 3));
      queueFloorLoadIntent(buildFloorIntentFromDelveNode(node, floorIndex));
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

    // Enter chosen floor/zone (boss is still at end of the floor like today)
    queueFloorLoadIntent(buildFloorIntentFromRunNode(node, nextFloor));
  });

  return {
    update,
    render,
    startRun,
    startDeterministicRun,
    startSandboxRun,
    previewMap,
    preloadBootAssets,
    prepareStartMap,
    prewarmActiveMapSpritesForCurrentPalette,
    performPreparedStartIntent,
    consumePendingStartIntent,
    beginFloorLoad,
    prewarmFloorLoadSprites,
    finalizeFloorLoad,
    queueFloorLoadIntent,
    consumePendingFloorLoadIntent,
    quitRunToMenu,
    getWorld: () => world,
  };
}
