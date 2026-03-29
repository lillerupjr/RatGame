// src/game/game.ts
import { World, createWorld, clearEvents, emitEvent, gridAtPlayer } from "../engine/world/world";

import {
  InputState,
  createInputState,
  inputSystem,
  clearInputEdges,
  setVirtualInteractDown,
  setVirtualMoveAxes,
} from "./systems/sim/input";
import { movementSystem } from "./systems/sim/movement";
import { spawnOneEnemyOfType, spawnOneTrashEnemy } from "./systems/spawn/spawn";
import { combatSystem } from "./systems/sim/combat";
import { dotTickSystem } from "./combat/dot/dotTickSystem";
import { collisionsSystem, processCombatTextFromEvents } from "./systems/sim/collisions";
import { projectilesSystem } from "./systems/sim/projectiles";
import { pickupsSystem } from "./systems/progression/pickups";
import { dropsSystem } from "./systems/progression/drops";
import {
  renderSystem,
} from "./systems/presentation/render";
import {
  prepareMonolithicStructureTrianglesForLoading as prepareRuntimeStructureTrianglesForLoadingInternal,
} from "./structures/monolithicStructureGeometry";
import {
  prepareStaticGroundRelightForLoading as prepareStaticGroundRelightForLoadingInternal,
} from "./systems/presentation/staticRelight/staticRelightBakeRebuild";
import {
  getFlippedOverlayImage,
  getRuntimeIsoDecalCanvas,
  getRuntimeIsoTopCanvas,
} from "./systems/presentation/presentationImageTransforms";
import {
  monolithicStructureGeometryCacheStore,
  staticRelightBakeStore,
} from "./systems/presentation/presentationSubsystemStores";
import { zonesSystem } from "./systems/sim/zones";
import { relicExplodeOnKillSystem } from "./systems/sim/relicExplodeOnKill";
import { bossSystem } from "./systems/progression/boss";
import { audioSystem } from "./systems/presentation/audio";
import { preloadSfx } from "../engine/audio/sfx";
import { roomChallengeSystem } from "./systems/progression/roomChallenge";
import { triggerSystem } from "./systems/progression/triggerSystem";
import { relicTriggerSystem } from "./systems/progression/relicTriggerSystem";
import { relicRetriggerSystem } from "./systems/progression/relicRetriggerSystem";
import { vfxSystem } from "./systems/vfxSystem";
import {
  isFloorEndCountdownDone,
  maybeStartFloorEndCountdown,
  tickFloorEndCountdown,
} from "./systems/progression/floorEndCountdown";
import {
  hasCompletedAnyObjective,
  initObjectivesForFloor,
  objectiveSystem,
  resetObjectiveRuntime,
  setObjectives,
} from "./systems/progression/objective";
import { outcomeSystem } from "./systems/progression/outcomeSystem";
import { bossZoneSpawnSystem } from "./systems/progression/bossZoneSpawn";
import {
  markBossTripleClearsFromSignalsAndEvents,
  syncBossTripleObjectiveStateFromClears,
} from "./systems/progression/bossTripleObjectiveSync";

import { formatTimeMMSS } from "./util/time";
import { getBossAccent } from "./content/floors";
import { registry } from "./content/registry";
import { spawnEnemyGrid, ENEMY_TYPE, type EnemyType } from "./factories/enemyFactory";
import { gridToWorld } from "./coords/grid";
import { anchorFromWorld } from "./coords/anchor";
import { fissionSystem } from "./systems/sim/fission";
import { processMomentumEventQueue, tickMomentumDecay } from "./systems/sim/momentum";
import { KENNEY_TILE_WORLD, preloadKenneyTiles } from "../engine/render/kenneyTiles";
import type { Dir8 } from "../engine/render/sprites/dir8";
import { dir8FromVector } from "../engine/render/sprites/dir8";

import {
  canEnterNode,
  countClearedNodes,
  createDelveMap,
  ensureAdjacentNodes,
  markCurrentNodeCleared,
  moveToNode,
  getDepthScaling,
  getNodeDepth,
  type DelveMap,
  type DelveNode,
} from "./map/delveMap";
import type { FloorArchetype } from "./map/floorArchetype";
import type { FloorIntent } from "./map/floorIntent";
import {
  buildDelveRouteMapVM,
  buildDeterministicRouteMapVM,
  type DeterministicRouteOption,
  type RouteMapVM,
  type RouteNodeStatus,
} from "./map/routeMapView";
import { buildRouteMapLayout, computeScrollTopForNode } from "./map/routeMapLayout";
import { playerSpritesReady, preloadPlayerSprites, setPlayerSkin } from "../engine/render/sprites/playerSprites";
import { preloadVendorNpcSprites, vendorNpcSpritesReady } from "../engine/render/sprites/vendorSprites";
import { preloadBackgrounds } from "./render/background";
import { getProjectileSpriteByKind, preloadProjectileSprites } from "../engine/render/sprites/projectileSprites";
import { enemySpritesReady, preloadEnemySprites } from "../engine/render/sprites/enemySprites";
import {
  getSpriteByIdForVariantKey,
  type LoadedImg,
  preloadRenderSprites,
} from "../engine/render/sprites/renderSprites";
import { setMusicStage, stopMusic } from "../engine/audio/music";
import type { TableMapCell, TableMapDef } from "./map/formats/table/tableMapTypes";
import { AUTHORED_MAP_DEFS, getAuthoredMapDefByMapId } from "./map/authored/authoredMapRegistry";
import {
  activateMapDefAsync,
  getActiveMap,
  getActiveMapDef,
  applyObjectivesFromActiveMap,
  getSpawnWorldFromActive,
  reloadActiveMapAsync,
} from "./map/authoredMapActivation";
import { objectiveSpecFromFloorIntent } from "./map/floorObjectiveBinding";
import { applyFloorOverlays } from "./map/floorOverlays";
import { RNG } from "./util/rng";
import { applyObjective } from "./map/objectiveTransforms";
import { OBJECTIVE_IDS, objectiveIdFromArchetype, type ObjectiveId } from "./map/objectivePlan";
import { findNearestWalkableSpawnGrid } from "./systems/spawn/findWalkableSpawn";
import { DEFAULT_MAP_POOL } from "./map/mapIds";
import { OBJECTIVE_TRIGGER_IDS } from "./systems/progression/objectiveSpec";
import { getPlayableCharacter, PLAYABLE_CHARACTERS, type PlayableCharacterId } from "./content/playableCharacters";
import { DEFAULT_GAME_SPEED, clampGameSpeed, getUserSettings } from "../userSettings";
import { neutralMobSpritesReady, preloadNeutralMobSprites } from "../engine/render/sprites/neutralSprites";
import { spawnMilestonePigeonNearPlayer } from "./factories/neutralMobFactory";
import { neutralAnimatedMobsSystem } from "./systems/sim/neutralAnimatedMobs";
import { neutralBirdAISystem } from "./systems/sim/neutralBirdAI";
import { getZoneTrialObjectiveState, startZoneTrial, updateZoneTrialObjective } from "./objectives/zoneObjectiveSystem";
import {
  getPoeMapObjectiveDebugSnapshot,
  getPoeMapObjectiveProgress,
  initializePoeMapObjective,
  isPoeMapObjectiveActive,
  resetPoeMapObjectiveState,
  tickPoeMapObjective,
} from "./objectives/poeMapObjectiveSystem";
import {
  awaitPrewarmDone,
  collectRuntimeSpriteDeps,
  enqueuePrewarm,
  tickPrewarm,
} from "./render/prewarmOwner";
import { resolveActivePaletteId, resolveActivePaletteVariantKey } from "./render/activePalette";
import { collectFloorDependencies } from "./loading/dependencyCollector";
import { formatPaletteHudDebugText, shouldShowPaletteHudDebugOverlay } from "./render/renderDebugPolicy";
import { applySfxSettingsToWorld } from "./audio/audioSettings";
import { chooseCardReward, ensureCardRewardState } from "./combat_mods/rewards/cardRewardFlow";
import { chooseRelicReward, ensureRelicRewardState } from "./combat_mods/rewards/relicRewardFlow";
import { getGold } from "./economy/gold";
import { ensureRunProgressionState } from "./economy/xp";
import { getCardById } from "./combat_mods/content/cards/cardPool";
import { generateVendorCards } from "./vendor/generateVendorCards";
import { generateVendorRelicOffers } from "./vendor/generateVendorRelics";
import { getVendorCardPriceG, VENDOR_RELIC_PRICE_G } from "./vendor/pricing";
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
import { resolveActiveRewardTicket } from "./rewards/rewardTickets";
import { recomputeDerivedStats } from "./stats/derivedStats";
import { hasAnyRelicWithTag, MOMENTUM_RELIC_TAG } from "./content/relics";
import { createMobileControls } from "../ui/mobile/mobileControls";
import { renderDialogChoices } from "../ui/dialog/renderDialogChoices";
import { ensureStarterRelicForCharacter } from "./systems/progression/starterRelics";
import { getWorldRelicInstances } from "./systems/progression/relics";
import { bazookaExhaustAssets, bazookaExhaustAssetsReady, preloadBazookaExhaustAssets } from "./vfx/bazookaExhaustAssets";
import { updateExhaustFollowers } from "./systems/exhaustFollowerSystem";
import { rewardRunEventProducerSystem } from "./systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "./systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "./systems/progression/rewardPresenterSystem";
import {
  resetLootGoblinFloorState,
  trySpawnLootGoblinForFloor,
} from "./systems/progression/lootGoblin";
import {
  commitFloorClear,
  normalizedRunHeat,
  resetFloorClearCommit,
} from "./systems/progression/runHeat";
import { getSupabaseEnv } from "../config/supabase";
import {
  LeaderboardClient,
  type LeaderboardRow,
} from "../leaderboard/leaderboardClient";
import type { PaletteSnapshotStorageRecord } from "./paletteLab/snapshotStorage";
import {
  buildPaletteSnapshotFloorIntent,
  extractPaletteSnapshotSceneRestoreState,
} from "./paletteLab/snapshotRestore";


type HudRefs = {
  root: HTMLDivElement;
  topStack: HTMLDivElement;
  topRow: HTMLDivElement;
  topLeft: HTMLDivElement;
  topCenter: HTMLDivElement;
  topRight: HTMLDivElement;
  fpsPill: HTMLSpanElement;
  palettePill: HTMLSpanElement;
  timePill: HTMLSpanElement;
  killsPill: HTMLSpanElement;
  hpPill: HTMLSpanElement;
  armorPill: HTMLSpanElement;
  momentumPill: HTMLSpanElement;
  vitalsOrbRoot: HTMLDivElement;
  vitalsOrb: HTMLDivElement;
  vitalsOrbText: HTMLDivElement;
  vitalsArmorText: HTMLSpanElement;
  vitalsMomentumText: HTMLSpanElement;
  lvlPill: HTMLSpanElement;
  bossBar: HTMLDivElement;
  bossTitle: HTMLDivElement;
  bossTrack: HTMLDivElement;
  bossFill: HTMLDivElement;
  bossValue: HTMLDivElement;
  objectiveRoot: HTMLDivElement;
  objectiveOverlay: HTMLDivElement;
  objectiveTitle: HTMLDivElement;
  objectiveStatus: HTMLDivElement;
  interactPrompt: HTMLDivElement;
  mobileControlsRoot: HTMLDivElement;
  mobileMoveStick: HTMLDivElement;
  mobileMoveKnob: HTMLDivElement;
  mobileInteractBtn: HTMLDivElement;
};

type LevelUpRefs = {
  root: HTMLDivElement;
  choices: HTMLDivElement;
  sub: HTMLDivElement;
};

type CreateGameArgs = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  hud: HudRefs;
  ui: {
    menuEl: HTMLDivElement;

    // Run end overlay (WIN / LOSE)
    endEl: {
      root: HTMLDivElement;
      title: HTMLDivElement;
      sub: HTMLDivElement;
      btn: HTMLButtonElement;
      time: HTMLElement;
      depth: HTMLElement;
      kills: HTMLElement;
      gold: HTMLElement;
      relics: HTMLElement;
      cards: HTMLElement;
    };

    levelupEl: {
      root: HTMLDivElement;
      choices: HTMLDivElement;
      sub: HTMLDivElement;
    };
    mapEl: {
      root: HTMLDivElement;
      topBar: HTMLDivElement;
      backBtn: HTMLButtonElement;
      infoPanel: HTMLDivElement;
      depthLabel: HTMLDivElement;
      sub: HTMLDivElement;
      graphWrap: HTMLDivElement;
      graphContent: HTMLDivElement;
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

type EndLeaderboardRunPayload = {
  heat: number;
  kills: number;
  characterId: string;
};

const LEADERBOARD_UNKNOWN_CHARACTER_ID = "UNKNOWN";
const LEADERBOARD_CHARACTER_ID_PATTERN = /^[A-Z][A-Z0-9_]{2,23}$/;
const LEADERBOARD_CHARACTER_NAME_BY_ID = new Map<string, string>(
  PLAYABLE_CHARACTERS.map((character) => [character.id, character.displayName]),
);

function clampNonNegativeFinite(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function normalizeLeaderboardCharacterId(raw: unknown): string {
  const upper = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!LEADERBOARD_CHARACTER_ID_PATTERN.test(upper)) return LEADERBOARD_UNKNOWN_CHARACTER_ID;
  return upper;
}

function leaderboardCharacterLabel(characterId: unknown): string {
  const normalizedId = normalizeLeaderboardCharacterId(characterId);
  return LEADERBOARD_CHARACTER_NAME_BY_ID.get(normalizedId) ?? "Unknown";
}

function getRunHeat(w: World): number {
  return normalizedRunHeat(w.runHeat);
}

function getMapDepth(w: World): number {
  if (Number.isFinite(w.mapDepth) && w.mapDepth > 0) return Math.floor(w.mapDepth);
  if (Number.isFinite(w.delveDepth) && w.delveDepth > 0) return Math.floor(w.delveDepth);
  return Math.max(1, Math.floor((w.floorIndex ?? 0) + 1));
}

function setMapDepth(w: World, depth: number): void {
  const normalized = Math.max(1, Math.floor(Number(depth) || 1));
  w.mapDepth = normalized;
  // Backwards-compatible alias while call-sites migrate.
  w.delveDepth = normalized;
}

function applyRunHeatScaling(w: World): void {
  const effectiveDepth = getRunHeat(w) + 1;
  w.delveScaling = getDepthScaling(effectiveDepth);
}

const MAX_FRAME_DT_REAL_SEC = 0.05;
const DEFAULT_TIME_SCALE_SLEW = 12;
const DEATH_TO_BLACK_DURATION_SEC = 3.0;
const DEATH_WASTED_FADE_IN_SEC = 1.0;
const DEATH_WASTED_HOLD_SEC = 2.0;
const DEATH_TIME_SCALE_SLEW = 48;
const DEATH_FX_DURATION = DEATH_TO_BLACK_DURATION_SEC + DEATH_WASTED_FADE_IN_SEC + DEATH_WASTED_HOLD_SEC;

function clampFrameDtReal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_FRAME_DT_REAL_SEC, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function approachExp(current: number, target: number, slewPerSec: number, dtRealSec: number): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  if (Math.abs(target - current) <= 1e-9) return target;
  if (!Number.isFinite(slewPerSec) || slewPerSec <= 0 || dtRealSec <= 0) return target;
  const alpha = 1 - Math.exp(-slewPerSec * dtRealSec);
  return current + (target - current) * alpha;
}

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
  const input: InputState = createInputState();
  const uiInteractionState = {
    textInputFocused: false,
  };
  let mobileControlsEnabled = false;
  let nextPhoneDamageHapticAtMs = 0;
  const mobileControls = createMobileControls({
    root: args.hud.mobileControlsRoot,
    stickBase: args.hud.mobileMoveStick,
    stickKnob: args.hud.mobileMoveKnob,
    interactBtn: args.hud.interactPrompt,
    onMove: (x, y, active) => {
      if (uiInteractionState.textInputFocused) {
        setVirtualMoveAxes(input, 0, 0, false);
        return;
      }
      setVirtualMoveAxes(input, x, y, active);
    },
    onInteractDown: (down) => {
      if (uiInteractionState.textInputFocused) {
        setVirtualInteractDown(input, false);
        return;
      }
      setVirtualInteractDown(input, down);
    },
  });

  const syncMobileControlsEnabled = () => {
    mobileControls.setEnabled(!args.hud.root.hidden && mobileControlsEnabled);
  };

  const setHudHidden = (hidden: boolean) => {
    args.hud.root.hidden = hidden;
    args.hud.vitalsOrbRoot.hidden = hidden;
    syncMobileControlsEnabled();
  };

  const setMobileControlsEnabled = (enabled: boolean) => {
    mobileControlsEnabled = enabled;
    syncMobileControlsEnabled();
  };

  const maybeTriggerPhoneDamageHaptic = (): void => {
    if (!mobileControlsEnabled) return;
    if (typeof navigator === "undefined") return;
    if (!Array.isArray(world.events) || world.events.length === 0) return;
    const vibrateFn = (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate;
    if (typeof vibrateFn !== "function") return;
    let shouldVibrate = false;
    for (let i = 0; i < world.events.length; i++) {
      const ev = world.events[i];
      if (ev.type !== "PLAYER_HIT") continue;
      const damage = Number.isFinite(ev.damage) ? ev.damage : 0;
      if (damage <= 0) continue;
      shouldVibrate = true;
      break;
    }
    if (!shouldVibrate) return;
    const nowMs =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    if (nowMs < nextPhoneDamageHapticAtMs) return;
    nextPhoneDamageHapticAtMs = nowMs + 90;
    try {
      vibrateFn.call(navigator, [22]);
    } catch {
      // Ignore platform vibration errors.
    }
  };

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
    if (runRewardPipeline()) {
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
    renderDialogChoices(
      args.ui.dialogEl.choices,
      dialog.choices.map((choice, i) => ({
        label: choice.label,
        active: i === dialog.selectedIndex,
        onSelect: () => {
          choice.onSelect();
          if (activeDialog) setDialog(activeDialog);
        },
      })),
    );
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
    const usePhonePrompt = mobileControlsEnabled;
    if (world.state !== "RUN") {
      activeInteractableId = null;
      args.hud.interactPrompt.hidden = true;
      return;
    }
    if (activeDialog) {
      activeInteractableId = null;
      args.hud.interactPrompt.textContent = usePhonePrompt ? "Click to choose" : "Press E to choose";
      args.hud.interactPrompt.hidden = false;
      return;
    }
    if (vendorShopOpen) {
      activeInteractableId = null;
      args.hud.interactPrompt.hidden = true;
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
      args.hud.interactPrompt.textContent = usePhonePrompt ? "Click to interact" : best.prompt;
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

  function validateDelveHeatInvariant(w: World, reason: string): void {
    if (!import.meta.env.DEV) return;
    const delve = w.delveMap as DelveMap | null;
    if (!delve) return;
    const runHeat = getRunHeat(w);
    const cleared = countClearedNodes(delve);
    if (runHeat === cleared) return;
    console.error("[delve:heat-integrity]", {
      reason,
      runHeat,
      clearedNodes: cleared,
      currentNodeId: delve.currentNodeId,
    });
  }

  function commitCurrentNodeClear(w: World): boolean {
    if (w.floorClearCommitted) return false;
    const delve = w.delveMap as DelveMap | null;
    if (delve) {
      const currentId = delve.currentNodeId;
      const currentNode = currentId ? delve.nodes.get(currentId) ?? null : null;
      if (!currentNode || currentNode.state !== "ACTIVE") {
        if (import.meta.env.DEV) {
          console.error("[delve] Refusing floor-clear commit without ACTIVE node", {
            currentNodeId: currentId ?? null,
            currentState: currentNode?.state ?? null,
          });
        }
        return false;
      }
      const cleared = markCurrentNodeCleared(delve);
      if (!cleared) return false;
    }
    const committed = commitFloorClear(w);
    if (committed) validateDelveHeatInvariant(w, "commitCurrentNodeClear");
    return committed;
  }

  function tryAdvanceAfterObjectiveCompletion(): boolean {
    if (!hasCompletedAnyObjective(world)) return false;
    const isLegacyFinalFloor =
      !isDeterministicDelveMode() &&
      !world.delveMap &&
      (world.floorIndex ?? 0) >= FLOORS_PER_RUN - 1 &&
      world.runState !== "TRANSITION";
    if (isLegacyFinalFloor) {
      commitCurrentNodeClear(world);
      completeRun(world);
      return true;
    }
    if (world.runState === "TRANSITION") return false;
    if (world.state === "REWARD" && world.cardReward?.active) return false;
    if (world.state === "REWARD" && world.relicReward?.active) return false;
    if (world.floorEndCountdownActive && world.floorEndCountdownSec > 0) return false;
    commitCurrentNodeClear(world);

    if (isDeterministicDelveMode()) {
      showDeterministicFloorPicker(
        "Objective complete.\nChoose next floor type.",
        (world.floorIndex ?? 0) + 1,
        getMapDepth(world) + 1,
      );
      return true;
    }

    const delve = world.delveMap as DelveMap;
    if (delve) {
      showDelveMap(`Depth ${getMapDepth(world)} cleared!\nChoose your next destination.`);
      return true;
    }
    completeRun(world);
    return true;
  }

  function objectiveModeForFloor(w: World): ObjectiveMode {
    if (w.currentObjectiveSpec?.objectiveType === "POE_MAP_CLEAR") return "NORMAL";
    if (w.floorArchetype === "SURVIVE") return "SURVIVE_TRIAL";
    if (w.floorArchetype === "TIME_TRIAL") return "ZONE_TRIAL";
    return "NORMAL";
  }

  function syncRewardDebugFieldsFromBudget(w: World): void {
    const budget = w.floorRewardBudget;
    const nonObjectiveUsed = 2 - budget.nonObjectiveCardsRemaining;
    w.cardRewardBudgetTotal = 2;
    w.cardRewardBudgetUsed = nonObjectiveUsed;
    if (!Array.isArray(w.cardRewardClaimKeys)) w.cardRewardClaimKeys = [];
    const firedKeys = Object.keys(budget.fired ?? Object.create(null));
    for (let i = 0; i < firedKeys.length; i++) {
      const key = firedKeys[i];
      if (!w.cardRewardClaimKeys.includes(key)) w.cardRewardClaimKeys.push(key);
    }
  }

  function runRewardPipeline(options: { includeCoreFacts?: boolean; includeChest?: boolean } = {}): boolean {
    rewardRunEventProducerSystem(world, {
      includeCoreFacts: options.includeCoreFacts,
      includeChest: options.includeChest,
    });
    rewardSchedulerSystem(world);
    syncRewardDebugFieldsFromBudget(world);
    const opened = rewardPresenterSystem(world);
    if (!opened) return false;

    if (activeDialog) setDialog(null);
    if (vendorShopOpen) closeVendorShop(false);
    renderRewardMenuIfNeeded();
    return true;
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
      resolveActiveRewardTicket(world);
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
      resolveActiveRewardTicket(world);
      renderRewardMenuIfNeeded();
      if (tryAdvanceAfterObjectiveCompletion()) return;
      world.state = "RUN";
    },
  });
  const vendorRoot = document.createElement("div");
  vendorRoot.id = "vendorShop";
  vendorRoot.hidden = true;
  document.body.appendChild(vendorRoot);
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
      cards: vendor.cards.map((cardId, index) => ({
        cardId,
        priceG: getVendorCardPriceG(cardId),
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
  let pendingPaletteSnapshotRestore: PaletteSnapshotStorageRecord | null = null;
  let activePaletteSnapshotViewerRecord: PaletteSnapshotStorageRecord | null = null;
  let preparedStart: PreparedStart | null = null;
  let bootAssetsPreloaded = false;
  let floorLoadContext: FloorLoadContext | null = null;

  function getEndStatsTimeSec(w: World): number {
    return clampNonNegativeFinite((w.timeSec ?? w.time ?? 0) as number);
  }

  function getEndStatsDepth(w: World): number {
    return getMapDepth(w);
  }

  function getEndStatsCardCount(w: World): number {
    const cards = Array.isArray(w.cards) ? w.cards.length : 0;
    if (cards > 0) return cards;
    return Array.isArray(w.combatCardIds) ? w.combatCardIds.length : 0;
  }

  function populateEndStats(w: World): void {
    const summary = getEndRunSummary(w);
    args.ui.endEl.time.textContent = formatTimeMMSS(getEndStatsTimeSec(w));
    args.ui.endEl.depth.textContent = String(getEndStatsDepth(w));
    args.ui.endEl.kills.textContent = String(summary.kills);
    args.ui.endEl.gold.textContent = String(Math.max(0, Math.floor(getGold(w))));
    args.ui.endEl.relics.textContent = String(Array.isArray(w.relics) ? w.relics.length : 0);
    args.ui.endEl.cards.textContent = String(getEndStatsCardCount(w));
  }

  function getEndRunSummary(w: World): EndLeaderboardRunPayload {
    return {
      heat: getRunHeat(w),
      kills: Math.max(0, Math.floor(w.kills ?? 0)),
      characterId: normalizeLeaderboardCharacterId((w as any).currentCharacterId),
    };
  }

  function sanitizeLeaderboardDisplayName(raw: string): string {
    const trimmed = raw.trim();
    const cleaned = trimmed.replace(/[^A-Za-z0-9 _-]/g, "");
    return cleaned.slice(0, 12);
  }

  const supabaseEnv = getSupabaseEnv();
  const leaderboardClient = supabaseEnv
    ? new LeaderboardClient({
      supabaseUrl: supabaseEnv.url,
      supabaseAnonKey: supabaseEnv.anonKey,
      seasonId: "alpha",
    })
    : null;
  const endStatsPanelEl = args.ui.endEl.root.querySelector<HTMLElement>("#endStatsPanel");
  const endLeaderboardPanelEl = args.ui.endEl.root.querySelector<HTMLElement>("#endLeaderboardPanel");
  const endTabStatsBtnEl = args.ui.endEl.root.querySelector<HTMLButtonElement>("#endTabStats");
  const endTabLeaderboardBtnEl = args.ui.endEl.root.querySelector<HTMLButtonElement>("#endTabLeaderboard");
  const endLeaderboardTop10BadgeEl = args.ui.endEl.root.querySelector<HTMLElement>("#endLeaderboardTop10Badge");
  const endLeaderboardListWrapEl = args.ui.endEl.root.querySelector<HTMLElement>("#endLeaderboardListWrap");
  const endLeaderboardListEl = args.ui.endEl.root.querySelector<HTMLOListElement>("#endLeaderboardList");
  const endLeaderboardStatusEl = args.ui.endEl.root.querySelector<HTMLDivElement>("#endLeaderboardStatus");
  const endLeaderboardRetryBtnEl = args.ui.endEl.root.querySelector<HTMLButtonElement>("#endLeaderboardRetryBtn");
  const endLeaderboardSubmitWrapEl = args.ui.endEl.root.querySelector<HTMLDivElement>("#endLeaderboardSubmitWrap");
  const endLeaderboardNameInputEl = args.ui.endEl.root.querySelector<HTMLInputElement>("#endLeaderboardName");
  const endLeaderboardSubmitBtnEl = args.ui.endEl.root.querySelector<HTMLButtonElement>("#endLeaderboardSubmitBtn");
  const endLeaderboardSubmitDoneEl = args.ui.endEl.root.querySelector<HTMLSpanElement>("#endLeaderboardSubmitDone");
  const endLeaderboardSubmitStatusEl = args.ui.endEl.root.querySelector<HTMLDivElement>("#endLeaderboardSubmitStatus");
  type EndTabId = "stats" | "leaderboard";
  let endActiveTab: EndTabId = "stats";
  const hasEndLeaderboardUi = !!(
    endStatsPanelEl
    && endLeaderboardPanelEl
    && endTabStatsBtnEl
    && endTabLeaderboardBtnEl
    && endLeaderboardTop10BadgeEl
    && endLeaderboardListWrapEl
    && endLeaderboardListEl
    && endLeaderboardStatusEl
    && endLeaderboardRetryBtnEl
    && endLeaderboardSubmitWrapEl
    && endLeaderboardNameInputEl
    && endLeaderboardSubmitBtnEl
    && endLeaderboardSubmitDoneEl
    && endLeaderboardSubmitStatusEl
  );
  let endLeaderboardRunPayload: EndLeaderboardRunPayload | null = null;
  let endLeaderboardRequestSeq = 0;
  let endLeaderboardSubmitting = false;
  let endLeaderboardSubmittedName: string | null = null;
  let endLeaderboardProjectedRank: number | null = null;
  let endLeaderboardSubmitForcedDisabled = false;
  let endLeaderboardAutoScrolled = false;

  function setLeaderboardInputFocusState(focused: boolean): void {
    uiInteractionState.textInputFocused = focused;
    if (!focused) return;
    setVirtualMoveAxes(input, 0, 0, false);
    setVirtualInteractDown(input, false);
    clearInputEdges(input);
  }

  function setEndLeaderboardStatus(message: string): void {
    if (!endLeaderboardStatusEl) return;
    endLeaderboardStatusEl.textContent = message;
    endLeaderboardStatusEl.hidden = message.length <= 0;
  }

  function setEndTop10Badge(rank: number | null): void {
    if (!endLeaderboardTop10BadgeEl) return;
    const show = typeof rank === "number" && Number.isFinite(rank) && rank > 0 && rank <= 10;
    endLeaderboardTop10BadgeEl.hidden = !show;
  }

  function hasLeaderboardNameInput(): boolean {
    const rawName = endLeaderboardNameInputEl?.value ?? "";
    return sanitizeLeaderboardDisplayName(rawName).length > 0;
  }

  function refreshEndLeaderboardSubmitControls(): void {
    const lockInput = endLeaderboardSubmitForcedDisabled || endLeaderboardSubmitting || !!endLeaderboardSubmittedName;
    const disableSubmit =
      lockInput
      || !leaderboardClient
      || !hasLeaderboardNameInput();
    if (endLeaderboardNameInputEl) endLeaderboardNameInputEl.disabled = lockInput;
    if (endLeaderboardSubmitBtnEl) {
      endLeaderboardSubmitBtnEl.disabled = disableSubmit;
      endLeaderboardSubmitBtnEl.hidden = !!endLeaderboardSubmittedName;
    }
    if (endLeaderboardSubmitDoneEl) {
      endLeaderboardSubmitDoneEl.hidden = !endLeaderboardSubmittedName;
    }
  }

  function setEndActiveTab(next: EndTabId): void {
    endActiveTab = next;
    if (!endStatsPanelEl || !endLeaderboardPanelEl || !endTabStatsBtnEl || !endTabLeaderboardBtnEl) return;
    const showStats = endActiveTab === "stats";
    endStatsPanelEl.hidden = !showStats;
    endLeaderboardPanelEl.hidden = showStats;
    endTabStatsBtnEl.classList.toggle("active", showStats);
    endTabLeaderboardBtnEl.classList.toggle("active", !showStats);
    endTabStatsBtnEl.setAttribute("aria-selected", showStats ? "true" : "false");
    endTabLeaderboardBtnEl.setAttribute("aria-selected", showStats ? "false" : "true");
    if (endActiveTab === "leaderboard" && endLeaderboardRunPayload) {
      void loadEndLeaderboardPreview();
      requestAnimationFrame(() => {
        maybeAutoScrollEndLeaderboardToYou();
      });
    }
  }

  function setEndLeaderboardSubmitStatus(message: string): void {
    if (!endLeaderboardSubmitStatusEl) return;
    endLeaderboardSubmitStatusEl.textContent = message;
  }

  function setEndLeaderboardSubmitDisabled(disabled: boolean): void {
    endLeaderboardSubmitForcedDisabled = disabled;
    refreshEndLeaderboardSubmitControls();
  }

  function buildLeaderboardYouRow(payload: EndLeaderboardRunPayload, rank: number | null): LeaderboardRow {
    const normalizedRank =
      typeof rank === "number" && Number.isFinite(rank) && rank > 0
        ? Math.floor(rank)
        : 1;
    const displayName = endLeaderboardSubmittedName && endLeaderboardSubmittedName.length > 0
      ? endLeaderboardSubmittedName
      : "YOU";
    return {
      rank: normalizedRank,
      display_name: displayName,
      heat: Math.max(0, Math.floor(payload.heat)),
      kills: Math.max(0, Math.floor(payload.kills)),
      character_id: normalizeLeaderboardCharacterId(payload.characterId),
      isYou: true,
    };
  }

  function mergeLeaderboardRows(top: LeaderboardRow[], around: LeaderboardRow[], youRow: LeaderboardRow): LeaderboardRow[] {
    const rowsByRank = new Map<number, LeaderboardRow>();
    const ingest = (rows: LeaderboardRow[]) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rank = Number.isFinite(row.rank) ? Math.max(1, Math.floor(row.rank)) : 0;
        if (rank <= 0) continue;
        rowsByRank.set(rank, {
          rank,
          display_name: row.display_name || "ANON",
          heat: Number.isFinite(row.heat) ? Math.max(0, Math.floor(row.heat)) : 0,
          kills: Number.isFinite(row.kills) ? Math.max(0, Math.floor(row.kills)) : 0,
          character_id: normalizeLeaderboardCharacterId(row.character_id),
          isYou: !!row.isYou,
        });
      }
    };
    ingest(top);
    ingest(around);
    rowsByRank.set(youRow.rank, { ...youRow, isYou: true });
    return Array.from(rowsByRank.values()).sort((a, b) => a.rank - b.rank);
  }

  function renderEndLeaderboardRows(listEl: HTMLOListElement | null, rows: LeaderboardRow[]): void {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (rows.length <= 0) {
      const li = document.createElement("li");
      li.classList.add("endLeaderboardRowEmpty");
      li.textContent = "No runs submitted yet.\nBe the first.";
      listEl.appendChild(li);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const normalizedRank = Math.max(1, Math.floor(row.rank));
      const isYou = !!row.isYou;
      const heat = Math.max(0, Math.floor(row.heat));
      const kills = Math.max(0, Math.floor(row.kills));
      const character = leaderboardCharacterLabel(row.character_id);
      const li = document.createElement("li");
      li.classList.add("endLeaderboardRow");
      if (isYou) {
        li.classList.add("isYou");
        li.dataset.you = "true";
      }
      li.dataset.rank = String(normalizedRank);
      const rankLabel = document.createElement("span");
      rankLabel.classList.add("endLeaderboardRowRank");
      rankLabel.textContent = `${normalizedRank}.`;
      const nameLabel = document.createElement("span");
      nameLabel.classList.add("endLeaderboardRowName");
      const displayName = row.display_name || "ANON";
      nameLabel.textContent = isYou ? `> ${displayName}` : displayName;
      const heatValue = document.createElement("span");
      heatValue.classList.add("endLeaderboardRowHeat");
      heatValue.textContent = String(heat);
      const killsValue = document.createElement("span");
      killsValue.classList.add("endLeaderboardRowKills");
      killsValue.textContent = String(kills);
      const characterValue = document.createElement("span");
      characterValue.classList.add("endLeaderboardRowCharacter");
      characterValue.textContent = character;

      li.appendChild(rankLabel);
      li.appendChild(nameLabel);
      li.appendChild(heatValue);
      li.appendChild(killsValue);
      li.appendChild(characterValue);
      listEl.appendChild(li);
    }
  }

  function maybeAutoScrollEndLeaderboardToYou(): void {
    if (endLeaderboardAutoScrolled) return;
    if (endActiveTab !== "leaderboard") return;
    if (!endLeaderboardListWrapEl || !endLeaderboardListEl) return;
    const youRow = endLeaderboardListEl.querySelector<HTMLElement>(".endLeaderboardRow.isYou");
    if (!youRow) return;
    const target = youRow.offsetTop - ((endLeaderboardListWrapEl.clientHeight - youRow.offsetHeight) * 0.5);
    const maxScroll = Math.max(0, endLeaderboardListWrapEl.scrollHeight - endLeaderboardListWrapEl.clientHeight);
    endLeaderboardListWrapEl.scrollTop = Math.max(0, Math.min(maxScroll, target));
    endLeaderboardAutoScrolled = true;
  }

  function renderEndLeaderboardMergedRows(payload: EndLeaderboardRunPayload, top: LeaderboardRow[], around: LeaderboardRow[], rank: number | null): void {
    const youRow = buildLeaderboardYouRow(payload, rank);
    const mergedRows = mergeLeaderboardRows(top, around, youRow);
    renderEndLeaderboardRows(endLeaderboardListEl, mergedRows);
    requestAnimationFrame(() => {
      maybeAutoScrollEndLeaderboardToYou();
    });
  }

  function renderEndLeaderboardYouOnly(payload: EndLeaderboardRunPayload, rank: number | null): void {
    renderEndLeaderboardRows(endLeaderboardListEl, [buildLeaderboardYouRow(payload, rank)]);
    requestAnimationFrame(() => {
      maybeAutoScrollEndLeaderboardToYou();
    });
  }

  function clearEndLeaderboardRows(): void {
    if (!endLeaderboardListEl) return;
    endLeaderboardListEl.innerHTML = "";
    if (endLeaderboardListWrapEl) {
      endLeaderboardListWrapEl.scrollTop = 0;
    }
  }

  function resetEndLeaderboardUiState(): void {
    endLeaderboardRunPayload = null;
    endLeaderboardSubmitting = false;
    endLeaderboardSubmittedName = null;
    endLeaderboardProjectedRank = null;
    endLeaderboardSubmitForcedDisabled = false;
    endLeaderboardAutoScrolled = false;
    endLeaderboardRequestSeq++;
    setLeaderboardInputFocusState(false);
    if (!hasEndLeaderboardUi) return;
    setEndLeaderboardStatus("Loading leaderboard...");
    setEndLeaderboardSubmitStatus("");
    setEndTop10Badge(null);
    setEndLeaderboardSubmitDisabled(false);
    if (endLeaderboardRetryBtnEl) endLeaderboardRetryBtnEl.hidden = true;
    if (endLeaderboardSubmitWrapEl) endLeaderboardSubmitWrapEl.hidden = false;
    clearEndLeaderboardRows();
    if (endLeaderboardNameInputEl) {
      endLeaderboardNameInputEl.value = "";
      refreshEndLeaderboardSubmitControls();
    }
  }

  async function loadEndLeaderboardPreview(): Promise<void> {
    if (!hasEndLeaderboardUi) return;
    const payload = endLeaderboardRunPayload;
    if (!payload) return;
    if (!leaderboardClient) {
      setEndLeaderboardStatus("Leaderboard unavailable (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
      setEndLeaderboardSubmitDisabled(true);
      setEndLeaderboardSubmitStatus("Configure Supabase env vars and restart the dev server.");
      setEndTop10Badge(null);
      if (endLeaderboardRetryBtnEl) endLeaderboardRetryBtnEl.hidden = false;
      if (endLeaderboardSubmitWrapEl) endLeaderboardSubmitWrapEl.hidden = false;
      renderEndLeaderboardYouOnly(payload, endLeaderboardProjectedRank);
      return;
    }
    setEndLeaderboardSubmitDisabled(false);
    if (endLeaderboardSubmitWrapEl) endLeaderboardSubmitWrapEl.hidden = false;
    if (endLeaderboardRetryBtnEl) endLeaderboardRetryBtnEl.hidden = true;
    setEndLeaderboardStatus("Loading leaderboard...");
    endLeaderboardAutoScrolled = false;
    const requestSeq = ++endLeaderboardRequestSeq;
    try {
      const preview = await leaderboardClient.previewRun({
        heat: payload.heat,
        kills: payload.kills,
        topLimit: 20,
        window: 6,
      });
      if (requestSeq !== endLeaderboardRequestSeq) return;
      endLeaderboardProjectedRank = Number.isFinite(preview.rank) ? Math.max(1, Math.floor(preview.rank)) : null;
      renderEndLeaderboardMergedRows(payload, preview.top, preview.around, endLeaderboardProjectedRank);
      setEndTop10Badge(endLeaderboardProjectedRank);
      setEndLeaderboardStatus("");
      if (endLeaderboardRetryBtnEl) endLeaderboardRetryBtnEl.hidden = true;
    } catch (error) {
      if (requestSeq !== endLeaderboardRequestSeq) return;
      const message = error instanceof Error ? error.message : "Failed to load leaderboard.";
      setEndLeaderboardStatus("Leaderboard unavailable");
      setEndLeaderboardSubmitStatus(message);
      setEndTop10Badge(null);
      renderEndLeaderboardYouOnly(payload, endLeaderboardProjectedRank);
      if (endLeaderboardRetryBtnEl) endLeaderboardRetryBtnEl.hidden = false;
    }
  }

  async function submitEndLeaderboardName(): Promise<void> {
    if (!hasEndLeaderboardUi) return;
    if (endLeaderboardSubmitting || endLeaderboardSubmittedName) return;
    const payload = endLeaderboardRunPayload;
    if (!payload) return;
    if (!leaderboardClient) {
      setEndLeaderboardStatus("Leaderboard unavailable (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
      setEndLeaderboardSubmitStatus("Configure Supabase env vars and restart the dev server.");
      setEndLeaderboardSubmitDisabled(true);
      return;
    }

    const rawName = endLeaderboardNameInputEl?.value ?? "";
    const displayName = sanitizeLeaderboardDisplayName(rawName);
    if (!displayName) {
      setEndLeaderboardSubmitStatus("Enter 1-12 valid characters.");
      return;
    }

    endLeaderboardSubmitting = true;
    setEndLeaderboardSubmitStatus("Submitting...");
    refreshEndLeaderboardSubmitControls();
    try {
      const submitted = await leaderboardClient.submitName({
        heat: payload.heat,
        kills: payload.kills,
        displayName,
        characterId: payload.characterId,
      });
      const submittedName = sanitizeLeaderboardDisplayName(String(submitted.display_name ?? displayName));
      if (endLeaderboardNameInputEl) endLeaderboardNameInputEl.value = submittedName;
      endLeaderboardSubmittedName = submittedName;
      setEndLeaderboardSubmitStatus("");
      refreshEndLeaderboardSubmitControls();
      await loadEndLeaderboardPreview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit leaderboard entry.";
      setEndLeaderboardSubmitStatus(message);
      setEndLeaderboardSubmitDisabled(false);
    } finally {
      endLeaderboardSubmitting = false;
      refreshEndLeaderboardSubmitControls();
    }
  }

  if (hasEndLeaderboardUi && endLeaderboardNameInputEl && endLeaderboardSubmitBtnEl) {
    if (endTabStatsBtnEl) {
      endTabStatsBtnEl.addEventListener("click", () => setEndActiveTab("stats"));
    }
    if (endTabLeaderboardBtnEl) {
      endTabLeaderboardBtnEl.addEventListener("click", () => setEndActiveTab("leaderboard"));
    }
    if (endLeaderboardRetryBtnEl) {
      endLeaderboardRetryBtnEl.addEventListener("click", () => {
        void loadEndLeaderboardPreview();
      });
    }
    endLeaderboardSubmitBtnEl.addEventListener("click", () => {
      void submitEndLeaderboardName();
    });
    endLeaderboardNameInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void submitEndLeaderboardName();
    });
    endLeaderboardNameInputEl.addEventListener("input", () => {
      const sanitized = sanitizeLeaderboardDisplayName(endLeaderboardNameInputEl.value);
      if (sanitized !== endLeaderboardNameInputEl.value) {
        endLeaderboardNameInputEl.value = sanitized;
      }
      if (!endLeaderboardSubmittedName) setEndLeaderboardSubmitStatus("");
      refreshEndLeaderboardSubmitControls();
    });
    endLeaderboardNameInputEl.addEventListener("focus", () => {
      setLeaderboardInputFocusState(true);
    });
    endLeaderboardNameInputEl.addEventListener("blur", () => {
      setLeaderboardInputFocusState(false);
    });
  }

  function hideEndScreen(): void {
    resetEndLeaderboardUiState();
    setEndActiveTab("stats");
    args.ui.endEl.root.classList.remove("isVisible");
    args.ui.endEl.root.hidden = true;
  }

  function showEndScreen(w: World, title: string, subtitle: string): void {
    updateHud();
    args.ui.endEl.title.textContent = title;
    args.ui.endEl.sub.textContent = subtitle;
    populateEndStats(w);
    args.ui.endEl.root.classList.remove("isVisible");
    args.ui.endEl.root.hidden = false;
    requestAnimationFrame(() => {
      args.ui.endEl.root.classList.add("isVisible");
    });
    args.ui.menuEl.hidden = true;
    setHudHidden(true);
    hideCardRewardMenu();
    closeVendorShop(false);
    setDialog(null);
    setEndActiveTab("stats");
    endLeaderboardRunPayload = getEndRunSummary(w);
    endLeaderboardSubmittedName = null;
    endLeaderboardSubmitting = false;
    endLeaderboardProjectedRank = null;
    endLeaderboardSubmitForcedDisabled = false;
    endLeaderboardAutoScrolled = false;
    setEndTop10Badge(null);
    if (hasEndLeaderboardUi) {
      setEndLeaderboardSubmitStatus("");
      setEndLeaderboardStatus("Loading leaderboard...");
      setEndLeaderboardSubmitDisabled(false);
      refreshEndLeaderboardSubmitControls();
    }
    void loadEndLeaderboardPreview();
  }

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
    preloadBazookaExhaustAssets();
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
  const DETERMINISTIC_CHOICES: DeterministicRouteOption[] = [
    { archetype: "SURVIVE", title: "Survive" },
    { archetype: "SURVIVE", objectiveId: "POE_MAP_CLEAR", title: "PoE Map" },
    { archetype: "TIME_TRIAL", title: "Zone Trial" },
    { archetype: "VENDOR", title: "Vendor" },
    { archetype: "HEAL", title: "Heal" },
    { archetype: "BOSS_TRIPLE", title: "3 Bosses" },
  ];
  const DETERMINISTIC_ZONES = ["DOCKS", "SEWERS", "CHINATOWN"] as const;

  type DeterministicChoice = {
    archetype: FloorArchetype;
    objectiveId?: ObjectiveId;
    title?: string;
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
        return "3 Bosses";
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
    resetPoeMapObjectiveState(w);
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
    w.eBaseLife = [];
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
    w.zEnemyDamageMeta = [];
    w.zPlayerDamageMeta = [];

    // if your World has zDamagePlayer, keep this reset (safe even if unused)
    // @ts-ignore
    if ("zDamagePlayer" in w) (w as any).zDamagePlayer = [];

    (w as any)._fireZoneVfx = [];
    (w as any)._eKnockVx = [];
    (w as any)._eKnockVy = [];

    // VFX entities
    w.vfxAlive = [];
    w.vfxX = [];
    w.vfxY = [];
    w.vfxRadius = [];
    w.vfxElapsed = [];
    w.vfxTtl = [];
    w.vfxClipId = [];
    w.vfxLoop = [];
    w.vfxFollowEnemy = [];
    w.vfxOffsetYPx = [];
    w.vfxScale = [];

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
    w.prDamageMeta = [];

    w.prStartX = [];
    w.prStartY = [];
    w.prPlayerFireX = [];
    w.prPlayerFireY = [];
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
    (w as any).exhaustFollower = {};
    (w as any).exhaustFollowerFrame = {};
    (w as any)._nextExhaustFollowerId = 1;
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
    w.floatTextSize = [];
    w.floatTextTtl = [];
    w.floatTextIsCrit = [];
    w.floatTextIsPlayer = [];
    w.uiFloatTextSeed = 0;
    w.npcs = [];
    w.neutralMobs = [];
  }

  function clearPaletteSnapshotViewerState(w: World): void {
    (w as any).paletteSnapshotViewerActive = false;
    (w as any).paletteSnapshotViewerCamera = null;
  }

  function applyPaletteSnapshotSceneRestore(
    w: World,
    snapshot: PaletteSnapshotStorageRecord,
  ): void {
    const restored = extractPaletteSnapshotSceneRestoreState(snapshot, w.stageId);
    clearFloorEntities(w);

    w.pgxi = restored.player.pgxi;
    w.pgyi = restored.player.pgyi;
    w.pgox = restored.player.pgox;
    w.pgoy = restored.player.pgoy;
    w.pz = restored.player.pz;
    w.pzVisual = restored.player.pzVisual;
    w.pzLogical = restored.player.pzLogical;
    w.activeFloorH = restored.player.pzLogical;
    w.pvx = restored.player.pvx;
    w.pvy = restored.player.pvy;
    w.lastAimX = restored.player.lastAimX;
    w.lastAimY = restored.player.lastAimY;

    w.camera.posX = restored.cameraX;
    w.camera.posY = restored.cameraY;
    w.camera.targetX = restored.cameraX;
    w.camera.targetY = restored.cameraY;
    (w as any).paletteSnapshotViewerCamera = {
      x: restored.cameraX,
      y: restored.cameraY,
      zoom: restored.cameraZoom,
    };

    w.lighting.darknessAlpha = restored.lighting.darknessAlpha;
    w.lighting.ambientTint = restored.lighting.ambientTint;
    w.lighting.ambientTintStrength = restored.lighting.ambientTintStrength;

    for (const enemy of restored.enemies) {
      const enemyType = Number.isFinite(enemy.type)
        ? (Math.max(0, Math.floor(enemy.type)) as EnemyType)
        : ENEMY_TYPE.CHASER;
      const enemyIndex = spawnEnemyGrid(w, enemyType, enemy.pgxi, enemy.pgyi, KENNEY_TILE_WORLD);
      w.egox[enemyIndex] = enemy.pgox;
      w.egoy[enemyIndex] = enemy.pgoy;
      w.eHp[enemyIndex] = Math.max(0, enemy.hp);
      w.eHpMax[enemyIndex] = Math.max(1, enemy.hp);
      w.eFaceX[enemyIndex] = enemy.faceX;
      w.eFaceY[enemyIndex] = enemy.faceY;
      w.ezVisual[enemyIndex] = enemy.zVisual;
      w.ezLogical[enemyIndex] = enemy.zLogical;
      if (enemy.hp <= 0) w.eAlive[enemyIndex] = false;
    }

    setDialog(null);
    closeVendorShop(false);
    hideCardRewardMenu();
    args.ui.mapEl.root.hidden = true;
    setHudHidden(true);
    w.state = "MAP";
    (w as any).paletteSnapshotViewerActive = true;
  }

  function bossAlive(w: World): boolean {
    return findFirstAliveBossIndex(w) >= 0;
  }

  function findFirstAliveBossIndex(w: World): number {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      if (w.eType[i] === ENEMY_TYPE.BOSS) return i;
    }
    return -1;
  }

  function spawnSurviveBossIfNeeded(w: World): void {
    if (w.floorArchetype !== "SURVIVE") return;
    if (w.currentObjectiveSpec?.objectiveType !== "SURVIVE_TIMER") return;
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
    const spawnedHp = spawnOneEnemyOfType(w, ENEMY_TYPE.BOSS, wx, wy, "elite");
    if (spawnedHp > 0) (w as any)._surviveBossSpawned = true;
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
    const completed = spawnPointsWorld.map(() => false);
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

  async function beginFloorLoad(floorIntent: FloorIntent): Promise<boolean> {
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
    setMapDepth(w, floorIntent.depth);

    const sid = floorIntent.zoneId;

    w.stage = cloneStage(sid as any);
    setMusicStage(sid as any);

    w.stage = cloneStage(sid as any);

    // Drive floor timing from stage
    w.floorDuration = w.stage.duration;

    const objectiveId = floorIntent.objectiveId ?? objectiveIdFromArchetype(floorIntent.archetype);
    const targetMapId =
      floorIntent.mapId
      ?? (floorIntent.archetype === "VENDOR"
        ? "SHOP"
        : floorIntent.archetype === "HEAL"
          ? "REST"
          : undefined);
    const baseMap = getStaticMapById(targetMapId) ?? getDefaultStaticMap();
    if (!baseMap) {
      console.error(`[enterFloor] missing authored map for mapId="${targetMapId ?? "AUTO"}"`);
      return false;
    }
    const variantSeed = floorIntent.variantSeed ?? w.rng.int(0, 0x7fffffff);
    const rng = new RNG(variantSeed);
    const finalMap = applyObjective(baseMap, objectiveId, rng);
    await activateMapDefAsync(finalMap, variantSeed);

    floorLoadContext = { floorIntent };
    return true;
  }

  async function prewarmFloorLoadSprites(): Promise<boolean> {
    const w = world;
    const paletteVariantKey = resolveActivePaletteVariantKey();
    const runtimeSpriteIds = collectRuntimeSpriteDeps(w, getActiveMap());
    const depsSpriteIds = collectFloorDependencies().spriteIds;
    const spriteIds = Array.from(new Set([...runtimeSpriteIds, ...depsSpriteIds]));
    const requiredSpriteIds = spriteIds.filter((id) => !isOptionalRuntimeSpriteIdForLoading(id));
    enqueuePrewarm(paletteVariantKey, spriteIds);
    await awaitPrewarmDone(1500);

    // 1) Always warm entity/core sprite modules.
    const primaryState = await awaitCoreSpriteReadiness(requiredSpriteIds, 1500, paletteVariantKey);
    if (primaryState !== "READY") {
      console.debug(
        `[loading][prewarm-floor] primary readiness=${primaryState} required=${requiredSpriteIds.length} total=${spriteIds.length}`,
      );
      return false;
    }

    // 2) One more short wait to ensure swapped images are installed.
    const settleState = await awaitCoreSpriteReadiness(requiredSpriteIds, 300, paletteVariantKey);
    if (settleState !== "READY") {
      console.debug(
        `[loading][prewarm-floor] settle readiness=${settleState} required=${requiredSpriteIds.length} total=${spriteIds.length}`,
      );
    }
    return settleState === "READY";
  }

  /**
   * Hard-reset all progression / objective signals so stale state from the
   * previous floor can never cause "instant complete on load".
   * Called at the start of every floor before objectives are wired up.
   */
  function resetFloorProgressionState(w: any): void {
    if (!w) return;
    w.triggerSignals = [];
    w.objectiveEvents = [];
    w.events = [];
    w.chestOpenRequested = false;
    w.runEvents = [];
    w.rewardTickets = [];
    w.activeRewardTicketId = null;
    w.rewardTicketSeq = 0;
    w._rewardObjectiveCompletedSeen = Object.create(null);
    w._rewardSurviveMilestoneSeen = Object.create(null);
    w._rewardBossMilestoneCount = 0;
    w._rewardSeenBossKillEvents = new WeakSet();

    w.floorEndCountdownActive = false;
    w.floorEndCountdownSec = 0;
    w.floorEndCountdownStartedKey = null;
    resetFloorClearCommit(w);

    w.pendingAdvanceToNextFloor = false;

    // boss bookkeeping if present
    if (Array.isArray(w.bossZoneSpawned)) w.bossZoneSpawned = [];
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
    let objectiveSpec = objectiveSpecFromFloorIntent(ctx.floorIntent);
    const isPoeMapFloor = objectiveSpec.objectiveType === "POE_MAP_CLEAR";
    resetLootGoblinFloorState(w);
    if (!isPoeMapFloor) {
      trySpawnLootGoblinForFloor(w);
    }

    if (objectiveSpec.objectiveType === "POE_MAP_CLEAR") {
      const objectiveSeed =
        floorIntent.variantSeed
        ?? hashString(`${floorIntent.nodeId}:${floorIntent.floorIndex}:${floorIntent.depth}:poe`);
      const poeInit = initializePoeMapObjective(w, {
        objectiveSeed,
        modifiers: floorIntent.poeMapModifiers,
      });
      objectiveSpec = {
        objectiveType: "POE_MAP_CLEAR",
        params: {
          clearCount: Math.max(1, poeInit.totalPacks),
        },
      };
    }

    resetFloorProgressionState(w);
    w.currentObjectiveSpec = objectiveSpec;
    resetObjectiveRuntime(w);
    initObjectivesForFloor(w, {
      floorId: floorIntent.nodeId,
      floorIndex: floorIntent.floorIndex,
      objectiveSpec,
    });
    w.floorRewardBudget = createFloorRewardBudget(objectiveModeForFloor(w));
    w.objectiveRewardClaimedKey = null;
    (w as any).zoneRewardClaimedKey = null;
    (w as any).zoneRewardClaimedKeys = [];
    w.cardRewardBudgetTotal = 2;
    w.cardRewardBudgetUsed = 0;
    w.cardRewardClaimKeys = [];
    w.lastCardRewardClaimKey = null;
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
        generateVendorCards(5, (w as any).currentCharacterId),
        generateVendorRelicOffers(w, 5, VENDOR_RELIC_PRICE_G),
      )
      : null;
    w.vendorOffers = [];
    (w as any)._surviveBossSpawned = false;
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

    applyRunHeatScaling(w);
    const heat = getRunHeat(w);
    const isPoeMapFloorObjective = objectiveSpec.objectiveType === "POE_MAP_CLEAR";
    const seed = 10;

    if (w.spawnDirectorState && !isPoeMapFloorObjective) {
      w.spawnDirectorState.pendingSpawns += seed;
    }

    if ((w as any).debug?.verboseSpawnLogs) {
      const tuning = (w as any).balance?.spawnTuning ?? {};
      const spawnBase = typeof tuning.spawnBase === "number" ? tuning.spawnBase : DEFAULT_SPAWN_TUNING.spawnBase;
      const spawnPerDepth = typeof tuning.spawnPerDepth === "number" ? tuning.spawnPerDepth : DEFAULT_SPAWN_TUNING.spawnPerDepth;
      const pressureAt0Sec = typeof tuning.pressureAt0Sec === "number" ? tuning.pressureAt0Sec : DEFAULT_SPAWN_TUNING.pressureAt0Sec;
      const pressureAt120Sec = typeof tuning.pressureAt120Sec === "number" ? tuning.pressureAt120Sec : DEFAULT_SPAWN_TUNING.pressureAt120Sec;
      const spawnMult = spawnBase * Math.pow(Math.max(0.0001, spawnPerDepth), heat);
      const pressure = computePressure(0, pressureAt0Sec, pressureAt120Sec);
      const spawnHPPerSecond = BASELINE_PLAYER_DPS * pressure * spawnMult;
      console.log(
        "[SpawnModel]",
        "heat=", heat,
        "pressure=", pressure.toFixed(2),
        "spawnHPPerSec=", spawnHPPerSecond.toFixed(2)
      );
    }

    emitEvent(w, { type: "SFX", id: "FLOOR_START", vol: 0.9, rate: 1 });
    floorLoadContext = null;

    // Enter gameplay state (delve picker leaves us in MAP; floor load must resume RUN).
    w.state = "RUN";
    clearPaletteSnapshotViewerState(w);
    const snapshotRestore = pendingPaletteSnapshotRestore;
    pendingPaletteSnapshotRestore = null;
    if (snapshotRestore) {
      activePaletteSnapshotViewerRecord = snapshotRestore;
      applyPaletteSnapshotSceneRestore(w, snapshotRestore);
    } else {
      activePaletteSnapshotViewerRecord = null;
    }

    // UI: hide map overlay, show HUD.
    args.ui.mapEl.root.hidden = true;
    setHudHidden(!!(w as any).paletteSnapshotViewerActive);
    hideCardRewardMenu();
  }

  async function enterFloor(w: World, floorIntent: FloorIntent): Promise<void> {
    void w;
    if (!(await beginFloorLoad(floorIntent))) return;
    const ready = await prewarmFloorLoadSprites();
    if (!ready) return;
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

  function buildFallbackFloorIntent(w: World, floorIndex: number): FloorIntent {
    const zoneId = (w.stage?.id ?? w.stageId ?? "DOCKS") as any;
    const archetype = w.floorArchetype ?? "SURVIVE";
    const mapId =
      archetype === "VENDOR"
        ? "SHOP"
        : archetype === "HEAL"
          ? "REST"
          : DEFAULT_MAP_POOL[floorIndex % DEFAULT_MAP_POOL.length];
    return {
      nodeId: "LEGACY_FLOOR",
      zoneId,
      depth: floorIndex + 1,
      floorIndex,
      archetype,
      mapId,
      objectiveId: objectiveIdFromArchetype(archetype),
      variantSeed: deterministicVariantSeed(w.runSeed, floorIndex, floorIndex + 1, archetype, mapId),
    };
  }

  function deterministicVariantSeed(
    runSeed: number,
    floorIndex: number,
    depth: number,
    archetype: FloorArchetype,
    mapId?: string,
    objectiveId?: ObjectiveId,
  ): number {
    return hashString(`${runSeed}:${floorIndex}:${depth}:${archetype}:${mapId ?? "AUTO"}:${objectiveId ?? "AUTO"}`);
  }

  function buildDeterministicFloorIntent(choice: DeterministicChoice): FloorIntent {
    const objectiveId = choice.objectiveId ?? objectiveIdFromArchetype(choice.archetype);
    const mapId =
      choice.archetype === "VENDOR"
        ? "SHOP"
        : choice.archetype === "HEAL"
          ? "REST"
          : DEFAULT_MAP_POOL[
              hashString(
                `${world.runSeed}:${choice.floorIndex}:${choice.depth}:${choice.archetype}:${objectiveId}:mapPick`,
              ) % DEFAULT_MAP_POOL.length
            ];
    const zoneId = DETERMINISTIC_ZONES[choice.floorIndex % DETERMINISTIC_ZONES.length];
    return {
      nodeId: `DET_${choice.floorIndex}_${choice.depth}_${choice.archetype}_${objectiveId}`,
      zoneId,
      depth: choice.depth,
      floorIndex: choice.floorIndex,
      archetype: choice.archetype,
      mapId,
      objectiveId,
      variantSeed: deterministicVariantSeed(
        world.runSeed,
        choice.floorIndex,
        choice.depth,
        choice.archetype,
        mapId,
        objectiveId,
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
    spawnOneEnemyOfType(w, ENEMY_TYPE.BOSS, sx, sy, "elite");
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
    showEndScreen(w, "Run Ended", "Final floor objective completed.");
  }


  async function applyMapSelection(mapId: string | undefined, seed: number): Promise<void> {
    const staticDef = getStaticMapById(mapId) ?? getDefaultStaticMap();
    if (staticDef) {
      await activateMapDefAsync(staticDef, seed);
    }
  }

  function isMapMode(mapId: string | undefined): boolean {
    return !!mapId;
  }

  async function previewMap(mapId?: string): Promise<void> {
    const seed = preparedStart?.seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    await applyMapSelection(mapId, seed);
  }

  async function reloadCurrentMapForDebug(): Promise<void> {
    const seed = preparedStart?.seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const reloaded = await reloadActiveMapAsync(seed);
    if (!reloaded && import.meta.env.DEV) {
      console.warn("[map-selector] reload requested without an active authored map");
    }
  }

  async function resetRun(mapId?: string, options?: { skipMapSelection?: boolean; seedOverride?: number }) {
    setDialog(null);
    closeVendorShop(false);
    const seed = options?.seedOverride ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    if (!options?.skipMapSelection) {
      await applyMapSelection(mapId, seed);
    }
    world = createWorld({
      seed,
      stage: cloneStage("DOCKS"),
    });
    applySfxSettingsToWorld(world);
    (world as any).deterministicDelveMode = false;
    const mapMode = isMapMode(mapId);
    (world as any).mapMode = mapMode;
    world.balance.spawnDirectorEnabled = true;
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

  async function executeStartRun(characterId: PlayableCharacterId): Promise<void> {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    await resetRun(undefined, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;
    ensureStarterRelicForCharacter(world, character.id);

    // Create infinite delve map
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const delve = createDelveMap(seed);
    world.delveMap = delve;
    setMapDepth(world, 1);
    applyRunHeatScaling(world);

    // Pick starting node
    if (import.meta.env.DEV) {
      const starter = getWorldRelicInstances(world).find((it) => it.source === "starter");
      console.debug("[starterRelic] run-start", { characterId: character.id, starterRelicId: starter?.id ?? null });
    }
    showDelveMap("Choose your starting location.\nGo deeper for greater challenge and rewards.");
  }

  async function executeStartDeterministicRun(characterId: PlayableCharacterId): Promise<void> {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    await resetRun(undefined, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;
    ensureStarterRelicForCharacter(world, character.id);
    world.delveMap = null;
    setMapDepth(world, 1);
    applyRunHeatScaling(world);
    world.runState = "FLOOR";
    world.state = "RUN";
    (world as any).deterministicDelveMode = true;

    args.ui.menuEl.hidden = true;
    args.ui.mapEl.root.hidden = false;
    hideEndScreen();
    setHudHidden(false);
    hideCardRewardMenu();

    if (import.meta.env.DEV) {
      const starter = getWorldRelicInstances(world).find((it) => it.source === "starter");
      console.debug("[starterRelic] deterministic-start", { characterId: character.id, starterRelicId: starter?.id ?? null });
    }

    showDeterministicFloorPicker(
      "Path Select mode: choose any floor type.",
      0,
      1,
    );
  }

  async function executeStartSandboxRun(characterId: PlayableCharacterId, mapId?: string): Promise<void> {
    const character = getPlayableCharacter(characterId);
    if (!character) return;

    applyPlayerSkinSelection(character.idleSpriteKey);
    preloadPlayerSprites();

    await resetRun(mapId, { skipMapSelection: true, seedOverride: preparedStart?.seed });
    (world as any).currentCharacterId = character.id;
    ensureStarterRelicForCharacter(world, character.id);
    world.delveMap = null;
    setMapDepth(world, 1);
    applyRunHeatScaling(world);
    // IMPORTANT: sandbox must still run the sim.
    world.runState = "FLOOR";
    world.state = "RUN";

    // UI: ensure we’re not stuck in menus/overlays.
    args.ui.menuEl.hidden = true;
    args.ui.mapEl.root.hidden = true;
    hideEndScreen();
    setHudHidden(false);
    hideCardRewardMenu();

    if (import.meta.env.DEV) {
      const starter = getWorldRelicInstances(world).find((it) => it.source === "starter");
      console.debug("[starterRelic] sandbox-start", { characterId: character.id, starterRelicId: starter?.id ?? null });
    }
  }

  async function prepareStartMap(intent: StartIntent): Promise<void> {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
 
    // Only sandbox preloads/activates a map at start.
    // DELVE/DETERMINISTIC should NOT compile or activate any map until a floor is chosen.
    const mapId = intent.mode === "SANDBOX" ? intent.mapId : undefined;

    if (intent.mode === "SANDBOX") {
      await applyMapSelection(mapId, seed);
    }

    preparedStart = { seed, mapId };
  }

  type ReadinessState = "READY" | "PENDING" | "FAILED";

  function classifyLoadedImg(rec: LoadedImg | null | undefined): ReadinessState {
    if (!rec) return "FAILED";
    if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
    if (rec.failed || rec.unsupported) return "FAILED";
    if (rec.ready) return "FAILED";
    return "PENDING";
  }

  function normalizeRuntimeSpriteId(spriteId: string): string {
    const trimmed = spriteId.trim();
    return trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
  }

  function isOptionalRuntimeSpriteIdForLoading(spriteId: string): boolean {
    const normalized = normalizeRuntimeSpriteId(spriteId);
    return normalized.startsWith("entities/npc/vendor/")
      || normalized.startsWith("entities/animals/pigeon/");
  }

  function collectEnemySkinsForReadiness(runtimeSpriteIds: string[]): string[] {
    const out = new Set<string>();
    for (let i = 0; i < runtimeSpriteIds.length; i++) {
      const normalized = normalizeRuntimeSpriteId(runtimeSpriteIds[i]);
      const match = /^entities\/enemies\/([^/]+)\//.exec(normalized);
      if (match && match[1]) out.add(match[1]);
    }
    return Array.from(out);
  }

  async function awaitCoreSpriteReadiness(
    runtimeSpriteIds: string[],
    maxWaitMs: number = 1500,
    awaitedPaletteVariantKey: string = resolveActivePaletteVariantKey(),
  ): Promise<ReadinessState> {
    const requiredEnemySkins = collectEnemySkinsForReadiness(runtimeSpriteIds);

    // Kick idempotent loads.
    preloadPlayerSprites(awaitedPaletteVariantKey);
    preloadEnemySprites(requiredEnemySkins, awaitedPaletteVariantKey);
    preloadVendorNpcSprites(awaitedPaletteVariantKey);
    preloadNeutralMobSprites(awaitedPaletteVariantKey);
    preloadProjectileSprites();
    preloadBazookaExhaustAssets();
    preloadRenderSprites();

    const start = performance.now();

    return await new Promise<ReadinessState>((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - start;
        const activePaletteVariantKey = resolveActivePaletteVariantKey();
        const projectileKinds = [1, 2, 5, 7, 8];
        let failed = false;
        const failedProjectileKinds: number[] = [];
        const pendingProjectileKinds: number[] = [];
        let projectilesReady = true;
        for (let i = 0; i < projectileKinds.length; i++) {
          const kind = projectileKinds[i];
          const rec = getProjectileSpriteByKind(kind);
          const state = classifyLoadedImg(rec as LoadedImg | null | undefined);
          if (state === "FAILED") {
            failed = true;
            failedProjectileKinds.push(kind);
            projectilesReady = false;
          } else if (state === "PENDING") {
            pendingProjectileKinds.push(kind);
            projectilesReady = false;
          }
        }
        const failedRuntimeIds: string[] = [];
        const pendingRuntimeIds: string[] = [];
        let runtimeReady = true;
        for (let i = 0; i < runtimeSpriteIds.length; i++) {
          const id = runtimeSpriteIds[i];
          const rec = getSpriteByIdForVariantKey(id, awaitedPaletteVariantKey);
          const state = classifyLoadedImg(rec);
          if (state === "FAILED") {
            failed = true;
            runtimeReady = false;
            if (failedRuntimeIds.length < 20) failedRuntimeIds.push(id);
          } else if (state === "PENDING") {
            runtimeReady = false;
            if (pendingRuntimeIds.length < 20) pendingRuntimeIds.push(id);
          }
        }
        const playerReady = playerSpritesReady(awaitedPaletteVariantKey);
        const vendorReady = vendorNpcSpritesReady(awaitedPaletteVariantKey);
        const enemyReady = enemySpritesReady(requiredEnemySkins, awaitedPaletteVariantKey);
        const neutralReady = neutralMobSpritesReady(awaitedPaletteVariantKey);
        const bazookaReady = bazookaExhaustAssetsReady();

        // Optional gate: vendor + pigeon assets are nice-to-have at map entry.
        const optionalReady = vendorReady && neutralReady;
        const blockingGates: string[] = [];
        if (!playerReady) blockingGates.push("player");
        if (!enemyReady) blockingGates.push("enemy");
        if (!projectilesReady) blockingGates.push("projectiles");
        if (!bazookaReady) blockingGates.push("bazooka");
        if (!runtimeReady) blockingGates.push("runtime");
        if (!vendorReady) blockingGates.push("vendor(optional)");
        if (!neutralReady) blockingGates.push("neutral(optional)");

        const ready =
          playerReady
          && enemyReady
          && projectilesReady
          && bazookaReady
          && runtimeReady;

        if (ready) {
          if (!optionalReady) {
            console.warn("[loading][sprite-ready] proceeding with optional sprite families not ready", {
              awaitedPaletteVariantKey,
              activePaletteVariantKey,
              vendorReady,
              neutralReady,
            });
          }
          resolve("READY");
          return;
        }
        if (failed) {
          console.warn("[loading][sprite-ready] FAILED", {
            elapsedMs: Math.round(elapsed),
            runtimeSpriteCount: runtimeSpriteIds.length,
            requiredEnemySkins,
            awaitedPaletteVariantKey,
            activePaletteVariantKey,
            blockingGates,
            playerReady,
            vendorReady,
            enemyReady,
            neutralReady,
            projectilesReady,
            bazookaReady,
            runtimeReady,
            failedProjectileKinds,
            pendingProjectileKinds,
            failedRuntimeIds,
            pendingRuntimeIds,
          });
          resolve("FAILED");
          return;
        }
        if (elapsed >= maxWaitMs) {
          console.debug("[loading][sprite-ready] PENDING/TIMEOUT", {
            elapsedMs: Math.round(elapsed),
            maxWaitMs,
            runtimeSpriteCount: runtimeSpriteIds.length,
            requiredEnemySkins,
            awaitedPaletteVariantKey,
            activePaletteVariantKey,
            blockingGates,
            playerReady,
            vendorReady,
            enemyReady,
            neutralReady,
            projectilesReady,
            bazookaReady,
            runtimeReady,
            failedProjectileKinds,
            pendingProjectileKinds,
            failedRuntimeIds,
            pendingRuntimeIds,
          });
          resolve("PENDING");
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function prewarmActiveMapSpritesForCurrentPalette(): Promise<boolean> {
    const paletteVariantKey = resolveActivePaletteVariantKey();
    const runtimeSpriteIds = collectRuntimeSpriteDeps(world, getActiveMap());
    const depsSpriteIds = collectFloorDependencies().spriteIds;
    const spriteIds = Array.from(new Set([...runtimeSpriteIds, ...depsSpriteIds]));
    const requiredSpriteIds = spriteIds.filter((id) => !isOptionalRuntimeSpriteIdForLoading(id));
    enqueuePrewarm(paletteVariantKey, spriteIds);
    await awaitPrewarmDone(1500);

    // Always warm entity/core sprite modules.
    const primaryState = await awaitCoreSpriteReadiness(requiredSpriteIds, 1500, paletteVariantKey);
    if (primaryState !== "READY") {
      console.debug(
        `[loading][prewarm-map] primary readiness=${primaryState} required=${requiredSpriteIds.length} total=${spriteIds.length}`,
      );
      return false;
    }

    // Ensure swapped images have landed before leaving LOADING.
    const settleState = await awaitCoreSpriteReadiness(requiredSpriteIds, 300, paletteVariantKey);
    if (settleState !== "READY") {
      console.debug(
        `[loading][prewarm-map] settle readiness=${settleState} required=${requiredSpriteIds.length} total=${spriteIds.length}`,
      );
    }
    return settleState === "READY";
  }

  async function prepareStaticGroundRelightForLoadingStage(): Promise<boolean> {
    return prepareStaticGroundRelightForLoadingInternal(world, {
      bakeStore: staticRelightBakeStore,
      getRuntimeIsoTopCanvas,
      getRuntimeIsoDecalCanvas,
    });
  }

  async function prepareRuntimeStructureTrianglesForLoadingStage(): Promise<boolean> {
    return prepareRuntimeStructureTrianglesForLoadingInternal({
      cacheStore: monolithicStructureGeometryCacheStore,
      getFlippedOverlayImage,
    });
  }

  async function performPreparedStartIntent(intent: StartIntent): Promise<void> {
    if (!preparedStart) {
      await prepareStartMap(intent);
    }
    if (intent.mode === "SANDBOX") {
      await executeStartSandboxRun(intent.characterId, intent.mapId);
    } else if (intent.mode === "DETERMINISTIC") {
      await executeStartDeterministicRun(intent.characterId);
    } else {
      await executeStartRun(intent.characterId);
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

  function normalizePaletteSnapshotRecordSeed(
    record: PaletteSnapshotStorageRecord,
  ): PaletteSnapshotStorageRecord {
    const rawSeed = record.sceneContext?.seed;
    const resolvedSeed = Number.isFinite(rawSeed)
      ? Math.floor(rawSeed as number)
      : hashString(
        `${record.id}|${record.metadata?.createdAt ?? 0}|${record.sceneContext?.mapId ?? ""}|${record.sceneContext?.biomeId ?? ""}`,
      );

    return {
      ...record,
      sceneContext: {
        ...record.sceneContext,
        seed: resolvedSeed,
      },
    };
  }

  function openPaletteSnapshotRecord(record: PaletteSnapshotStorageRecord): void {
    const mapId =
      typeof record.sceneContext?.mapId === "string" && record.sceneContext.mapId.trim().length > 0
        ? record.sceneContext.mapId.trim()
        : undefined;
    if (mapId && !getStaticMapById(mapId)) {
      const snapshotName =
        typeof record.metadata?.name === "string" && record.metadata.name.trim().length > 0
          ? record.metadata.name.trim()
          : record.id;
      throw new Error(
        `Snapshot "${snapshotName}" references map "${mapId}" that is unavailable in this build.`,
      );
    }
    pendingStartIntent = null;
    preparedStart = null;
    const seededRecord = normalizePaletteSnapshotRecordSeed(record);
    activePaletteSnapshotViewerRecord = seededRecord;
    pendingPaletteSnapshotRestore = seededRecord;
    const fallbackSeed = Number.isFinite(seededRecord.sceneContext.seed)
      ? Math.floor(seededRecord.sceneContext.seed as number)
      : 1337;
    queueFloorLoadIntent(buildPaletteSnapshotFloorIntent(seededRecord, world.stageId, fallbackSeed));
  }

  function rerollPaletteSnapshotViewerSeed(): boolean {
    if (!(world as any).paletteSnapshotViewerActive) return false;
    const activeRecord = activePaletteSnapshotViewerRecord;
    if (!activeRecord) return false;

    const rerolledSeed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const rerolledRecord: PaletteSnapshotStorageRecord = {
      ...activeRecord,
      sceneContext: {
        ...activeRecord.sceneContext,
        seed: rerolledSeed,
      },
    };

    pendingStartIntent = null;
    preparedStart = null;
    activePaletteSnapshotViewerRecord = rerolledRecord;
    pendingPaletteSnapshotRestore = rerolledRecord;
    queueFloorLoadIntent(buildPaletteSnapshotFloorIntent(rerolledRecord, world.stageId, rerolledSeed));
    return true;
  }

  function quitRunToMenu() {
    pendingStartIntent = null;
    pendingFloorIntent = null;
    pendingPaletteSnapshotRestore = null;
    activePaletteSnapshotViewerRecord = null;
    preparedStart = null;
    floorLoadContext = null;
    setDialog(null);
    clearFloorEntities(world);
    clearEvents(world);
    world.state = "MENU";
    world.runState = "FLOOR";
    world.currentFloorIntent = null;
    clearPaletteSnapshotViewerState(world);
    world.deathFx.active = false;
    world.objectiveRewardClaimedKey = null;
    (world as any).deterministicDelveMode = false;
    args.ui.mapEl.root.hidden = true;
    hideCardRewardMenu();
    closeVendorShop(false);
    hideEndScreen();
    args.ui.dialogEl.root.hidden = true;
    setHudHidden(true);
    args.ui.menuEl.hidden = true;
    stopMusic();
  }

  function showMainMenuScreenFromEndOverlay(): void {
    const welcomeScreen = document.getElementById("welcomeScreen") as HTMLDivElement | null;
    const mainMenu = document.getElementById("mainMenu") as HTMLDivElement | null;
    const characterSelect = document.getElementById("characterSelect") as HTMLDivElement | null;
    const mapMenu = document.getElementById("mapMenu") as HTMLDivElement | null;
    const paletteLabMenu = document.getElementById("paletteLabMenu") as HTMLDivElement | null;
    const innkeeperMenu = document.getElementById("innkeeperMenu") as HTMLDivElement | null;
    const settingsMenu = document.getElementById("settingsMenu") as HTMLDivElement | null;
    if (welcomeScreen) welcomeScreen.hidden = true;
    if (mainMenu) mainMenu.hidden = false;
    if (characterSelect) characterSelect.hidden = true;
    if (mapMenu) mapMenu.hidden = true;
    if (paletteLabMenu) paletteLabMenu.hidden = true;
    if (innkeeperMenu) innkeeperMenu.hidden = true;
    if (settingsMenu) settingsMenu.hidden = true;
  }

  const MAP_VIEW_WIDTH = 1000;
  const MAP_VIEW_HEIGHT = 520;
  const ROUTE_ROW_HEIGHT_PX = 132;
  const ROUTE_TOP_PADDING_PX = 78;
  const ROUTE_BOTTOM_PADDING_PX = 122;

  function setMapGraphFillLayout(): void {
    args.ui.mapEl.graphContent.style.width = "100%";
    args.ui.mapEl.graphContent.style.height = "100%";
    args.ui.mapEl.graphContent.style.transform = "none";
    args.ui.mapEl.svg.setAttribute("viewBox", `0 0 ${MAP_VIEW_WIDTH} ${MAP_VIEW_HEIGHT}`);
  }

  function setMapGraphPixelLayout(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    args.ui.mapEl.graphContent.style.width = `${w}px`;
    args.ui.mapEl.graphContent.style.height = `${h}px`;
    args.ui.mapEl.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  function resetRouteMapFrame(): void {
    args.ui.mapEl.graphWrap.scrollTop = 0;
    args.ui.mapEl.graphWrap.classList.remove("routeScrollable");
    args.ui.mapEl.depthLabel.textContent = "";
    args.ui.mapEl.infoPanel.textContent = "";
    args.ui.mapEl.svg.innerHTML = `<rect x="0" y="0" width="${MAP_VIEW_WIDTH}" height="${MAP_VIEW_HEIGHT}" fill="rgba(0,0,0,0)" />`;
    args.ui.mapEl.hit.innerHTML = "";
  }


  const routeStatusLabel = (status: RouteNodeStatus): string => {
    switch (status) {
      case "CURRENT":
        return "Current";
      case "REACHABLE":
        return "Reachable";
      case "COMPLETED":
        return "Completed";
      case "LOCKED":
      default:
        return "Locked";
    }
  };

  const routeArchetypeClass = (archetype: FloorArchetype): string => {
    switch (archetype) {
      case "SURVIVE":
        return "survive";
      case "TIME_TRIAL":
        return "time-trial";
      case "VENDOR":
        return "vendor";
      case "HEAL":
        return "heal";
      case "BOSS_TRIPLE":
      default:
        return "boss-triple";
    }
  };

  const routeStatusClass = (status: RouteNodeStatus): string => {
    switch (status) {
      case "CURRENT":
        return "current";
      case "REACHABLE":
        return "reachable";
      case "COMPLETED":
        return "completed";
      case "LOCKED":
      default:
        return "locked";
    }
  };

  function setRouteInfo(node: RouteMapVM["nodes"][number] | null): void {
    if (!node) {
      args.ui.mapEl.infoPanel.textContent = "";
      return;
    }
    const zoneText = node.mode === "DETERMINISTIC" ? "Deterministic choice" : node.zoneId;
    args.ui.mapEl.infoPanel.innerHTML = `
      <div class="routeInfoTitle">${node.title} · Depth ${node.depth}</div>
      <div class="routeInfoMeta">${zoneText} · ${routeStatusLabel(node.status)}</div>
    `;
  }


  function renderRouteMap(vm: RouteMapVM, subText: string): void {
    args.ui.mapEl.root.classList.add("delveFull");
    args.ui.mapEl.root.classList.add("routeMode");
    world.state = "MAP";
    args.ui.mapEl.root.hidden = false;
    setHudHidden(true);
    args.ui.mapEl.sub.textContent = subText;
    args.ui.mapEl.graphWrap.classList.add("routeScrollable");
    args.ui.mapEl.depthLabel.textContent = `Depth ${vm.currentDepth}`;

    const viewportWidth = Math.max(1, Math.floor(args.ui.mapEl.graphWrap.clientWidth || MAP_VIEW_WIDTH));
    const viewportHeight = Math.max(1, Math.floor(args.ui.mapEl.graphWrap.clientHeight || MAP_VIEW_HEIGHT));
    const layout = buildRouteMapLayout(vm, viewportWidth, {
      rowHeight: ROUTE_ROW_HEIGHT_PX,
      topPadding: ROUTE_TOP_PADDING_PX,
      bottomPadding: ROUTE_BOTTOM_PADDING_PX,
    });
    setMapGraphPixelLayout(layout.contentWidth, layout.contentHeight);

    const nodeById = new Map(vm.nodes.map((n) => [n.id, n]));
    const edgeSvg = layout.edgeLayouts
      .map((e) => {
        const from = nodeById.get(e.fromId);
        const to = nodeById.get(e.toId);
        const active = !!from && !!to && (
          from.status !== "LOCKED" || to.status !== "LOCKED"
        );
        return `<line class="routeEdge ${active ? "routeEdge--active" : "routeEdge--locked"}" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" />`;
      })
      .join("");

    args.ui.mapEl.svg.innerHTML = `
      <rect x="0" y="0" width="${layout.contentWidth}" height="${layout.contentHeight}" fill="rgba(0,0,0,0)" />
      ${edgeSvg}
    `;

    const hit = args.ui.mapEl.hit;
    hit.innerHTML = "";
    for (const node of vm.nodes) {
      const pos = layout.nodeLayouts.get(node.id);
      if (!pos) continue;
      const archetypeClass = routeArchetypeClass(node.archetype);
      const statusClass = routeStatusClass(node.status);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `mapHitBtn routeNode routeNode--${archetypeClass} routeNode--${statusClass}`;
      btn.style.left = `${pos.x}px`;
      btn.style.top = `${pos.y}px`;
      btn.disabled = !node.reachable || node.current || node.completed;
      if (node.mode === "DELVE") {
        btn.dataset.delveNodeId = node.id;
      } else if (node.deterministicData) {
        btn.dataset.detFloorArchetype = node.deterministicData.archetype;
        btn.dataset.detFloorIndex = String(node.deterministicData.floorIndex);
        btn.dataset.detDepth = String(node.deterministicData.depth);
        if (node.deterministicData.objectiveId) {
          btn.dataset.detObjectiveId = node.deterministicData.objectiveId;
        }
      }
      btn.textContent = node.title;
      btn.addEventListener("mouseenter", () => setRouteInfo(node));
      btn.addEventListener("focus", () => setRouteInfo(node));
      btn.addEventListener("pointerdown", () => setRouteInfo(node));
      hit.appendChild(btn);
    }

    const focusNode =
      vm.nodes.find((n) => n.status === "CURRENT")
      ?? vm.nodes.find((n) => n.status === "REACHABLE")
      ?? vm.nodes[0]
      ?? null;
    setRouteInfo(focusNode);

    if (focusNode) {
      const focusLayout = layout.nodeLayouts.get(focusNode.id);
      if (focusLayout) {
        const scrollTop = computeScrollTopForNode(focusLayout.y, viewportHeight, layout.contentHeight);
        requestAnimationFrame(() => {
          args.ui.mapEl.graphWrap.scrollTop = scrollTop;
        });
      }
    }
  }

  function hideCardRewardMenu(): void {
    cardRewardMenu.render(null);
    relicRewardMenu.render(null);
    lastRewardRenderKey = "";
  }

  function showDeterministicFloorPicker(subText: string, floorIndex: number, depth: number) {
    const vm = buildDeterministicRouteMapVM(DETERMINISTIC_CHOICES, floorIndex, depth);
    renderRouteMap(vm, subText);
  }

  function showDelveMap(subText: string) {
    const delve = world.delveMap as DelveMap;
    if (!delve) {
      completeRun(world);
      return;
    }

    const seed = world.rng.int(0, 0x7fffffff);

    // Generate adjacent nodes from current position
    if (delve.currentNodeId) {
      ensureAdjacentNodes(delve, delve.currentNodeId, seed);
    }
    validateDelveHeatInvariant(world, "showDelveMap");
    const vm = buildDelveRouteMapVM(delve, {
      windowBack: 2,
      windowForward: 8,
    });
    renderRouteMap(vm, subText);
  }

  function hideMap() {
    resetRouteMapFrame();
    setMapGraphFillLayout();
    args.ui.mapEl.root.classList.remove("delveFull");
    args.ui.mapEl.root.classList.remove("routeMode");
    args.ui.mapEl.root.hidden = true;
    setHudHidden(false);
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

  const clamp01 = (v: number): number => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

  function updateVitalsOrb(hasMomentumRelic: boolean) {
    const hpNow = Math.max(0, world.playerHp);
    const hpMax = Math.max(1, world.playerHpMax);
    const armorNow = Math.max(0, world.currentArmor);
    const armorMax = Math.max(0, world.maxArmor);
    const momNow = Math.max(0, world.momentumValue);
    const momMax = Math.max(0, world.momentumMax);
    const vitalsState = world as World & {
      _vitalsArmorUnlocked?: boolean;
      _vitalsMomentumUnlocked?: boolean;
    };
    if (armorNow > 0) vitalsState._vitalsArmorUnlocked = true;
    if (hasMomentumRelic && momNow > 0) vitalsState._vitalsMomentumUnlocked = true;
    const hasArmorRing = !!vitalsState._vitalsArmorUnlocked;
    const hasMomentumRing = hasMomentumRelic && !!vitalsState._vitalsMomentumUnlocked;

    const hpFrac = clamp01(hpNow / hpMax);
    const armorFrac = hasArmorRing && armorMax > 0 ? clamp01(armorNow / armorMax) : 0;
    const momFrac = hasMomentumRing && momMax > 0 ? clamp01(momNow / momMax) : 0;

    args.hud.vitalsOrb.style.setProperty("--hpFrac", hpFrac.toFixed(4));
    args.hud.vitalsOrb.style.setProperty("--armorFrac", armorFrac.toFixed(4));
    args.hud.vitalsOrb.style.setProperty("--momFrac", momFrac.toFixed(4));
    args.hud.vitalsOrbRoot.classList.toggle("hasArmor", hasArmorRing);
    args.hud.vitalsOrbRoot.classList.toggle("hasMomentum", hasMomentumRing);
    args.hud.vitalsOrbRoot.classList.toggle("isFullArmor", hasArmorRing && armorMax > 0 && armorNow >= armorMax);
    args.hud.vitalsOrbRoot.classList.toggle("isFullMomentum", hasMomentumRing && momMax > 0 && momNow >= momMax);
    args.hud.vitalsArmorText.hidden = !hasArmorRing;
    args.hud.vitalsMomentumText.hidden = !hasMomentumRing;

    args.hud.vitalsOrbText.textContent = `${Math.ceil(hpNow)}/${Math.ceil(hpMax)}`;
    args.hud.vitalsArmorText.textContent = `Armor: ${Math.ceil(armorNow)}/${Math.ceil(armorMax)}`;
    args.hud.vitalsMomentumText.textContent = `Mom: ${Math.ceil(momNow)}/${Math.ceil(momMax)}`;
  }

  function updateHud() {
    const settings = getUserSettings();
    const orbSide = (settings.game?.healthOrbSide ?? "left") as "left" | "right";
    args.hud.vitalsOrbRoot.classList.toggle("isRight", orbSide === "right");

    args.hud.fpsPill.hidden = false;
    args.hud.timePill.hidden = false;
    args.hud.lvlPill.hidden = false;
    args.hud.palettePill.hidden = !shouldShowPaletteHudDebugOverlay(settings);
    args.hud.killsPill.hidden = true;
    args.hud.hpPill.hidden = true;
    args.hud.armorPill.hidden = true;
    args.hud.momentumPill.hidden = true;

    args.hud.fpsPill.textContent = `FPS ${Math.round((world as any).fps ?? 0)}`;
    args.hud.timePill.textContent = `\u23f1 ${formatTimeMMSS(world.time)}`;
    const runProgress = ensureRunProgressionState(world);
    args.hud.lvlPill.textContent = `Lv ${runProgress.level} · ${Math.floor(runProgress.xp)}/${Math.floor(runProgress.xpToNextLevel)} XP`;
    args.hud.palettePill.textContent = formatPaletteHudDebugText(resolveActivePaletteId());
    args.hud.killsPill.textContent = `Kills: ${world.kills}`;
    args.hud.hpPill.textContent = `HP: ${Math.max(0, Math.ceil(world.playerHp))}/${world.playerHpMax}`;
    args.hud.armorPill.textContent = `Armor: ${Math.max(0, Math.ceil(world.currentArmor))}/${world.maxArmor}`;
    const hasMomentumRelic = hasAnyRelicWithTag(world.relics, MOMENTUM_RELIC_TAG);
    if (hasMomentumRelic) {
      args.hud.momentumPill.textContent = `Momentum: ${Math.max(0, Math.ceil(world.momentumValue))}/${Math.max(0, Math.ceil(world.momentumMax))}`;
    }
    updateVitalsOrb(hasMomentumRelic);

    const bossIndex = findFirstAliveBossIndex(world);
    const inBossContext = world.runState === "BOSS" || bossIndex >= 0;
    if (!inBossContext || bossIndex < 0) {
      args.hud.bossBar.hidden = true;
    } else {
      const hpNow = Math.max(0, world.eHp[bossIndex] ?? 0);
      const hpMax = Math.max(1, world.eHpMax[bossIndex] ?? 1);
      const bossHpPct = clamp01(hpNow / hpMax);
      const accent = getBossAccent(world) ?? "#f66";

      args.hud.bossValue.textContent = `${Math.ceil(hpNow)} / ${Math.ceil(hpMax)}`;
      args.hud.bossBar.style.setProperty("--boss-accent", accent);
      args.hud.bossFill.style.transform = `scaleX(${bossHpPct.toFixed(4)})`;
      args.hud.bossBar.hidden = false;
    }

    const spec = world.currentObjectiveSpec;
    if (!spec || world.runState !== "FLOOR") {
      args.hud.objectiveOverlay.hidden = true;
      args.hud.objectiveStatus.hidden = true;
      return;
    }

    let title = "Objective";

    switch (spec.objectiveType) {
      case "SURVIVE_TIMER": {
        const remaining = Math.max(0, spec.params.timeLimitSec - world.phaseTime);
        title = `Survive · ${formatTimeMMSS(remaining)} left`;
        break;
      }
      case "ZONE_TRIAL": {
        title = "Slay enemies inside the marked zones.";
        break;
      }
      case "POE_MAP_CLEAR": {
        const progress = getPoeMapObjectiveProgress(world);
        const cleared = progress?.cleared ?? 0;
        const total = progress?.total ?? Math.max(1, spec.params.clearCount);
        title = `Clear Packs · ${Math.min(cleared, total)}/${total}`;
        if (import.meta.env.DEV) {
          const debug = getPoeMapObjectiveDebugSnapshot(world);
          if (debug) {
            const nearest = debug.nearestPackDistanceTiles;
            const nearestSleeping = debug.nearestSleepingPackDistanceTiles;
            const nearestText = nearest == null ? "-" : nearest.toFixed(1);
            const sleepingText = nearestSleeping == null ? "-" : nearestSleeping.toFixed(1);
            args.hud.objectiveStatus.textContent =
              `DBG mobs ${debug.aliveEnemies}/${debug.totalEnemies} | `
              + `hp ${Math.round(debug.aliveEnemyHp)}/${Math.round(debug.totalEnemyHp)} | `
              + `preBudget ${debug.totalPopulationBudget.toFixed(1)} | `
              + `spent ${debug.spentPopulationBudget.toFixed(1)} | `
              + `packs ${debug.packCount} (S:${debug.sleepingPacks} C:${debug.combatPacks} L:${debug.leashingPacks} X:${debug.clearedPacks}) | `
              + `dormant ${debug.dormantEnemies} | `
              + `nearest ${nearestText}t sleeping ${sleepingText}t`;
            args.hud.objectiveStatus.hidden = false;
          } else {
            args.hud.objectiveStatus.textContent = "DBG no active PoE runtime state";
            args.hud.objectiveStatus.hidden = false;
          }
        }
        break;
      }
      case "VENDOR_VISIT":
        title = "Visit the vendor to continue.";
        break;
      case "HEAL_VISIT":
        title = "Use the heal station to continue.";
        break;
      case "KILL_RARES_IN_ZONES": {
        const progress = world.objectiveStates[0]?.progress?.signalCount ?? 0;
        title = `Boss Hunt · ${Math.min(progress, spec.params.bossCount)}/${spec.params.bossCount}`;
        break;
      }
    }

    if (world.floorEndCountdownActive) {
      const secs = Math.max(0, Math.ceil(world.floorEndCountdownSec));
      title = `Leaving in ${secs}...`;
    }

    args.hud.objectiveTitle.textContent = title;
    if (spec.objectiveType !== "POE_MAP_CLEAR" || !import.meta.env.DEV) {
      args.hud.objectiveStatus.textContent = "";
      args.hud.objectiveStatus.hidden = true;
    }
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

  function triggerDeathFx(): void {
    world.deathFx.active = true;
    world.deathFx.tReal = 0;
    world.deathFx.durationReal = DEATH_FX_DURATION;
    world.deathFx.aFlash = 0;
    world.deathFx.aDesat = 0;
    world.deathFx.aVignette = 0;
    world.deathFx.aDark = 0;
    world.deathFx.aTitle = 0;
    world.deathFx.aBlack = 0;
    world.runState = "GAME_OVER";
    world.floorEndCountdownActive = false;
    world.floorEndCountdownSec = 0;
    emitEvent(world, { type: "SFX", id: "RUN_LOSE", vol: 1.0, rate: 1 });
  }

  function finalizeDeathFx(): void {
    // Keep the WASTED overlay locked while the end screen fades in above it.
    world.deathFx.active = true;
    world.deathFx.tReal = world.deathFx.durationReal;
    world.deathFx.aFlash = 0;
    world.deathFx.aDesat = 0;
    world.deathFx.aVignette = 0;
    world.deathFx.aDark = 0;
    world.deathFx.aTitle = 1;
    world.deathFx.aBlack = 1;
    world.state = "LOSE";
    const depth = getEndStatsDepth(world);
    showEndScreen(world, "Run Ended", `You died on depth ${depth}.`);
  }

  function update(rawDtReal: number) {
    const dtReal = clampFrameDtReal(rawDtReal);
    const settings = getUserSettings() as any;
    const baselineTimeScaleTarget = clampGameSpeed(
      Number(settings?.game?.gameSpeed ?? DEFAULT_GAME_SPEED),
    );
    const deathSlowdownEnabled = !!settings?.render?.deathSlowdownEnabled;
    const timeState = world.timeState;
    const deathFxActive = world.deathFx.active;
    timeState.dtReal = dtReal;
    if (deathFxActive && deathSlowdownEnabled) {
      const blackProgress = clamp01(world.deathFx.tReal / DEATH_TO_BLACK_DURATION_SEC);
      timeState.timeScaleTarget = baselineTimeScaleTarget * (1 - blackProgress);
      timeState.timeScaleSlew = DEATH_TIME_SCALE_SLEW;
      timeState.timeScale = timeState.timeScaleTarget;
    } else {
      timeState.timeScaleTarget = baselineTimeScaleTarget;
      timeState.timeScaleSlew = DEFAULT_TIME_SCALE_SLEW;
      timeState.timeScale = approachExp(
        timeState.timeScale,
        timeState.timeScaleTarget,
        timeState.timeScaleSlew,
        dtReal,
      );
    }
    timeState.dtSim = dtReal * timeState.timeScale;
    const dtSim = timeState.dtSim;
    tickPrewarm(2);

    if (deathFxActive) {
      world.deathFx.tReal = Math.min(world.deathFx.durationReal, world.deathFx.tReal + dtReal);
      const t = world.deathFx.tReal;
      const blackAlpha = clamp01(t / DEATH_TO_BLACK_DURATION_SEC);
      const titleFadeT = (t - DEATH_TO_BLACK_DURATION_SEC) / DEATH_WASTED_FADE_IN_SEC;
      world.deathFx.aFlash = 0;
      world.deathFx.aDesat = 0;
      world.deathFx.aVignette = 0;
      world.deathFx.aDark = 0;
      world.deathFx.aBlack = blackAlpha;
      world.deathFx.aTitle = blackAlpha >= 1 ? clamp01(titleFadeT) : 0;
      if (world.deathFx.tReal >= world.deathFx.durationReal && world.state !== "LOSE") {
        finalizeDeathFx();
        clearEvents(world);
        clearInputEdges(input);
        return;
      }
    }

    // Always poll input (so movement is responsive immediately after closing menus)
    if (deathFxActive || world.runState === "GAME_OVER") {
      input._keyUp = false;
      input._keyDown = false;
      input._keyLeft = false;
      input._keyRight = false;
      input._keyInteract = false;
      setVirtualMoveAxes(input, 0, 0, false);
      setVirtualInteractDown(input, false);
    }
    inputSystem(input, args.canvas);
    if (deathFxActive || world.runState === "GAME_OVER") {
      input.moveX = 0;
      input.moveY = 0;
      input.moveMag = 0;
      input.up = false;
      input.down = false;
      input.left = false;
      input.right = false;
      input.interact = false;
      input.interactPressed = false;
    }
    updateNpcFacingRestore(performance.now());
    updateActiveInteractablePrompt();

    if (activeDialog) {
      handleDialogInput();
    }
    renderVendorShopIfNeeded();

    // Handle pause states
    if (world.state === "REWARD" || world.state === "MAP") {
      if (world.state === "REWARD") {
        tickFloorEndCountdown(world, dtSim);
        if (isFloorEndCountdownDone(world)) {
          finishFloorEndCountdown();
          return;
        }
      }
      // HUD still updates while paused
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
    world.time += dtSim;

    // phase time (drives FLOOR/BOSS/TRANSITION)
    world.phaseTime += dtSim;
    // Spawn pacing uses the same clock as floor progression/spawn cadence.
    world.timeSec = world.phaseTime;
    ensureRunProgressionState(world);
    tickMomentumDecay(world, dtSim, world.timeSec);
    recomputeDerivedStats(world);

    const mapMode = !!(world as any).mapMode;

    // RunState progression (delve mode only)
    if (!mapMode) {
      if (world.runState === "FLOOR" && world.objectiveDefs.length === 0 && world.phaseTime >= world.floorDuration) {
        enterBoss(world);
      }
    }
    if (world.runState === "TRANSITION") {
      world.transitionTime = Math.max(0, world.transitionTime - dtSim);
      if (world.transitionTime <= 0) {
        const nextFloorIndex = (world.floorIndex ?? 0) + 1;
        void enterFloor(world, buildFallbackFloorIntent(world, nextFloorIndex));
      }
    }

    if (!activeDialog && !vendorShopOpen) {
      movementSystem(world, input, dtSim);
    }
    tickPoeMapObjective(world);
    neutralBirdAISystem(world, dtSim);
    neutralAnimatedMobsSystem(world, dtSim);
    roomChallengeSystem(world, dtSim);  // Track room challenges and lock exits
    spawnSurviveBossIfNeeded(world);
    world.spawnDirectorConfig.enabled = true;
    if (!world.floorEndCountdownActive && !isPoeMapObjectiveActive(world)) {
      tickSpawnDirector(
        world,
        dtSim,
        world.spawnDirectorConfig,
        world.expectedPowerConfig,
        world.expectedPowerBudgetConfig,
        world.spawnDirectorState,
        {
          getRunHeat: () => getRunHeat(world),
          isBossActive: () => world.runState === "BOSS" || bossAlive(world),
          canSpawnNow: () => world.runState === "FLOOR" && world.phaseTime >= 2,
          spawnTrash: () => {
            return spawnOneTrashEnemy(world, undefined, undefined, "trash");
          },
        }
      );
    }
    tickBalanceCsvLogger(world as any, dtSim);
    const isNeutralObjectiveFloor = world.floorArchetype === "VENDOR" || world.floorArchetype === "HEAL";
    if (!isNeutralObjectiveFloor && !deathFxActive) {
      combatSystem(world, dtSim);
    }
    projectilesSystem(world, dtSim);
    collisionsSystem(world, dtSim);
    fissionSystem(world, dtSim);  // Nuclear fission: projectile-projectile collisions
    relicExplodeOnKillSystem(world, dtSim);
    bossSystem(world, dtSim);          // NEW: boss mechanics (telegraphs/hazards/dash)
    zonesSystem(world, dtSim);
    dotTickSystem(world, dtSim);
    pickupsSystem(world, dtSim);
    dropsSystem(world, dtSim);
    triggerSystem(world, dtSim, input);
    tickPoeMapObjective(world);
    relicTriggerSystem(world);
    updateExhaustFollowers(world as any, dtSim, bazookaExhaustAssets);
    vfxSystem(world, dtSim);
    relicRetriggerSystem(world);
    processCombatTextFromEvents(world, dtSim);
    updateZoneTrialObjective(world);
    syncZoneTrialNavState(world);
    markBossTripleClearsFromSignalsAndEvents(world);
    bossZoneSpawnSystem(world);
    objectiveSystem(world);
    syncBossTripleObjectiveStateFromClears(world);
    processMomentumEventQueue(world);

    if (world.playerHp <= 0 && !world.deathFx.active && world.runState !== "GAME_OVER") {
      triggerDeathFx();
    }

    if (!world.deathFx.active) {
      if (runRewardPipeline({ includeCoreFacts: true, includeChest: false })) {
        clearEvents(world);
        return;
      }
      if (!world.cardReward?.active && !world.relicReward?.active) {
        maybeStartFloorEndCountdown(world);
      }
      tickFloorEndCountdown(world, dtSim);
      if (isFloorEndCountdownDone(world)) {
        finishFloorEndCountdown();
        return;
      }
      outcomeSystem(world);
    }

    // SFX consumes events before any early-return branches
    audioSystem(world, dtSim);
    maybeTriggerPhoneDamageHaptic();

    if (!world.deathFx.active) {
      // Process chest-request rewards after audio so pickup SFX is never skipped.
      if (runRewardPipeline({ includeCoreFacts: false, includeChest: true })) {
        clearEvents(world);
        return;
      }

      if (tryAdvanceAfterObjectiveCompletion()) {
        clearEvents(world);
        return;
      }
    }

    // Clear events AFTER all consumers ran this frame
    clearEvents(world);

    // HUD
    updateHud();

    // Clear per-frame edge-triggered inputs (must be at END of update)
    clearInputEdges(input);
  }

  function render() {
    renderSystem(world, args.ctx, args.canvas, args.uiCtx, args.uiCanvas);
  }

  function retryRunFromEndOverlay(): void {
    const characterId = (world as any).currentCharacterId as PlayableCharacterId | undefined;
    const deterministicMode = !!(world as any).deterministicDelveMode;
    const sandboxMode = !!(world as any).mapMode;
    const floorIntent = (world.currentFloorIntent ?? null) as { mapId?: string } | null;
    const fallbackMapId = (getActiveMapDef() as { id?: string } | null)?.id;
    const sandboxMapId = sandboxMode ? (floorIntent?.mapId ?? fallbackMapId) : undefined;

    quitRunToMenu();
    if (!characterId) {
      showMainMenuScreenFromEndOverlay();
      return;
    }

    if (sandboxMode) {
      startSandboxRun(characterId, sandboxMapId);
      return;
    }
    if (deterministicMode) {
      startDeterministicRun(characterId);
      return;
    }
    startRun(characterId);
  }

  // End screen button -> back to menu
  args.ui.endEl.root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t?.closest("button") as HTMLButtonElement | null;
    if (!btn) return;
    if (btn.id === "endRetryBtn") {
      retryRunFromEndOverlay();
      return;
    }
    if (btn.id !== "endBtn") return;

    quitRunToMenu();
    showMainMenuScreenFromEndOverlay();
  });

  // Route map back button -> quit run and return to main menu
  args.ui.mapEl.backBtn.addEventListener("click", () => {
    quitRunToMenu();
    showMainMenuScreenFromEndOverlay();
  });

  args.ui.mapEl.root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const btn = el.closest("button") as HTMLButtonElement | null;
    if (!btn) return;

    const detArchetype = btn.dataset.detFloorArchetype as FloorArchetype | undefined;
    if (detArchetype) {
      const floorIndex = Number.parseInt(btn.dataset.detFloorIndex ?? "0", 10) || 0;
      const depth = Number.parseInt(btn.dataset.detDepth ?? "1", 10) || 1;
      const rawObjectiveId = btn.dataset.detObjectiveId;
      const detObjectiveId =
        rawObjectiveId && OBJECTIVE_IDS.includes(rawObjectiveId as ObjectiveId)
          ? (rawObjectiveId as ObjectiveId)
          : undefined;
      setMapDepth(world, depth);
      hideMap();
      queueFloorLoadIntent(
        buildDeterministicFloorIntent({
          archetype: detArchetype,
          objectiveId: detObjectiveId,
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
      const destinationNode = delve.nodes.get(delveNodeId);
      if (!destinationNode || destinationNode.state !== "UNVISITED") return;
      if (!canEnterNode(delve, delveNodeId)) return;

      const node = moveToNode(delve, delveNodeId);
      if (!node) return;
      if (import.meta.env.DEV && node.state !== "ACTIVE") {
        console.error("[delve] Entered node is not ACTIVE after moveToNode", {
          nodeId: node.id,
          state: node.state,
        });
        return;
      }

      // Update map depth for presentation and generation.
      const depth = getNodeDepth(node);
      setMapDepth(world, depth);

      // Generate adjacent nodes for next time
      const seed = world.rng.int(0, 0x7fffffff);
      ensureAdjacentNodes(delve, delveNodeId, seed);

      hideMap();

      // Enter the chosen zone. floorIndex is used for enemy type weights, zoneId for visuals/music.
      const floorIndex = Math.min(2, Math.floor((depth - 1) / 3));
      queueFloorLoadIntent(buildFloorIntentFromDelveNode(node, floorIndex));
      return;
    }

    if (import.meta.env.DEV) {
      console.warn("[route-map] ignored click without deterministic or delve payload");
    }
  });

  return {
    update,
    render,
    startRun,
    startDeterministicRun,
    startSandboxRun,
    openPaletteSnapshotRecord,
    rerollPaletteSnapshotViewerSeed,
    previewMap,
    reloadCurrentMapForDebug,
    preloadBootAssets,
    prepareStartMap,
    prewarmActiveMapSpritesForCurrentPalette,
    prepareRuntimeStructureTrianglesForLoading: prepareRuntimeStructureTrianglesForLoadingStage,
    prepareStaticGroundRelightForLoading: prepareStaticGroundRelightForLoadingStage,
    performPreparedStartIntent,
    consumePendingStartIntent,
    beginFloorLoad,
    prewarmFloorLoadSprites,
    finalizeFloorLoad,
    queueFloorLoadIntent,
    consumePendingFloorLoadIntent,
    quitRunToMenu,
    setMobileControlsEnabled,
    getWorld: () => world,
  };
}
