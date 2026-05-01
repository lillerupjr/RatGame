import type { Application } from "pixi.js";
import { getOrCreatePixiApp, showPixiCanvas, hidePixiCanvas } from "../pixiApp";
import { tweenTo, Easing, cancelAllTweens, cancelTweensOf } from "../pixiTween";
import {
  buildHandsSceneGraph,
  relayoutScene,
  type HandsSceneNodes,
} from "./handsSceneGraph";
import {
  createInitialHandsState,
  transition,
  type HandsScreenState,
  type HandsAction,
} from "./handsState";
import {
  buildHandsScreenSnapshot,
  type HandsScreenSnapshot,
} from "./handsDataBridge";
import type { StatDelta } from "./statsRail";
import { getRingDefById, getAllRingDefs } from "../../../game/progression/rings/ringContent";
import { equipRing } from "../../../game/progression/rings/ringState";
import type { FingerSlotId, ModifierTokenType } from "../../../game/progression/rings/ringTypes";
import { COLORS } from "../pixiTheme";
import { DebugSlotTuner } from "./debugSlotTuner";
import { getSlotConfigs, generateDynamicSlotConfigs } from "./ringSlotConfig";
import { RingSlotView } from "./ringSlot";

export type HandsScreenCallbacks = {
  onEquipToSlot: (slotId: FingerSlotId) => void;
  onClose: () => void;
  onUnequip: (slotId: FingerSlotId) => void;
  onApplyToken: (instanceId: string, tokenType: ModifierTokenType) => void;
  /** Compute stats-preview delta for a hypothetical equip. Returns null if not supported. */
  computeStatsPreview?: (slotId: FingerSlotId, ringDefId: string) => StatDelta | null;
};

export type HandsScreenController = {
  show: (world: any, pendingRingDefId?: string | null) => void;
  hide: () => void;
  destroy: () => void;
  isVisible: () => boolean;
};

export async function mountHandsScreen(
  callbacks: HandsScreenCallbacks,
): Promise<HandsScreenController> {
  if (import.meta.env.DEV) console.log("[hands-screen] initializing pixi app...");
  const app: Application = await getOrCreatePixiApp();
  if (import.meta.env.DEV) console.log("[hands-screen] building scene graph...");
  const nodes: HandsSceneNodes = await buildHandsSceneGraph();
  if (import.meta.env.DEV) console.log("[hands-screen] scene graph built");

  let state: HandsScreenState = createInitialHandsState();
  let snapshot: HandsScreenSnapshot | null = null;
  let visible = false;
  let world: any = null;
  let entranceAnimating = false;
  let exitAnimating = false;
  let devChooseSlotPending: string | null = null; // DEV-only: ring def ID for dev-triggered choose-slot
  let hoveredSlotId: FingerSlotId | null = null; // Track hovered slot for stats preview

  // Debug slot tuner (DEV only)
  let debugTuner: DebugSlotTuner | null = null;
  if (import.meta.env.DEV) {
    debugTuner = new DebugSlotTuner(nodes.slotViews);
    nodes.handsViewport.addChild(debugTuner);
    debugTuner.updateDimensions(nodes.layout.handsW, nodes.layout.handsH);
  }

  // Wire drawer callbacks
  nodes.detailDrawer.setCallbacks({
    onUnequip: (slotId) => {
      callbacks.onUnequip(slotId);
      refreshSnapshot();
      dispatch({ type: "UNEQUIP_RING", slotId });
    },
    onApplyToken: (instanceId, tokenType) => {
      callbacks.onApplyToken(instanceId, tokenType);
      refreshSnapshot();
      // Re-apply state to update drawer content with new token counts
      applyState();
    },
  });

  // Add scene to stage (hidden initially)
  nodes.screenRoot.visible = false;
  app.stage.addChild(nodes.screenRoot);

  // ── Resize handler ──
  const onResize = () => {
    if (!visible) return;
    relayoutScene(nodes);
    debugTuner?.updateDimensions(nodes.layout.handsW, nodes.layout.handsH);
    if (snapshot) applyState();
  };
  window.addEventListener("resize", onResize);

  // ── DEV keyboard: Shift+D for debug tuner ──
  const onKeyDown = (ev: KeyboardEvent) => {
    if (!visible) return;
    if (ev.code === "KeyD" && ev.shiftKey && import.meta.env.DEV) {
      debugTuner?.toggle();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  function wireSlotEvents(sv: RingSlotView): void {
    sv.onSlotClick = (slotId) => {
      if (state.mode === "choose-slot") {
        // DEV-triggered: equip directly and stay in hands screen
        if (devChooseSlotPending && world) {
          equipRing(world, devChooseSlotPending, slotId);
          devChooseSlotPending = null;
          refreshSnapshot();
          state = createInitialHandsState();
          drawerOpen = false;
          handsShifted = false;
          applyState();
          return;
        }
        dispatch({ type: "CHOOSE_SLOT", slotId });
        callbacks.onEquipToSlot(slotId);
        return;
      }
      // Browse / selected mode: only select if equipped
      const slotSnap = snapshot?.slots.find((s) => s.slotId === slotId);
      if (slotSnap?.equipped) {
        dispatch({ type: "SELECT_RING", slotId });
      }
    };

    sv.onSlotHover = (slotId, hovered) => {
      if (state.mode === "choose-slot" && snapshot?.pendingRingDef) {
        hoveredSlotId = hovered ? slotId : null;
        updateChooseSlotDrawer();
        updateStatsPreview();
      }
    };
  }

  // ── Wire slot clicks ──
  for (const sv of nodes.slotViews) {
    wireSlotEvents(sv);
  }

  // ── Close button ──
  nodes.closeBtn.setOnPress(() => {
    callbacks.onClose();
  });

  // ── DEV: Add random ring button ──
  if (import.meta.env.DEV && nodes.devAddRingBtn) {
    nodes.devAddRingBtn.setOnPress(() => {
      if (state.mode === "choose-slot") return; // already choosing
      const allDefs = getAllRingDefs();
      if (allDefs.length === 0) return;
      const def = allDefs[Math.floor(Math.random() * allDefs.length)];
      devChooseSlotPending = def.id;
      snapshot = buildHandsScreenSnapshot(world, def.id);
      dispatch({ type: "ENTER_CHOOSE_MODE", ringDefId: def.id });
    });
  }

  // ── Tick animations ──
  const tickFn = (ticker: { deltaMS: number }) => {
    if (!visible) return;
    for (const sv of nodes.slotViews) {
      sv.tickAnimations(ticker.deltaMS);
    }
    if (state.mode === "choose-slot") {
      nodes.acquisitionBanner.tickPulse(ticker.deltaMS);
    }
  };
  app.ticker.add(tickFn);

  // ── Helpers ──
  function refreshSnapshot(): void {
    if (!world) return;
    snapshot = buildHandsScreenSnapshot(
      world,
      state.pendingRingDefId ?? undefined,
    );
  }

  function updateChooseSlotDrawer(): void {
    if (!snapshot || state.mode !== "choose-slot" || !snapshot.pendingRingDef) return;
    const pr = snapshot.pendingRingDef;

    // Check if hovered slot has an existing ring
    let replacingRingName: string | null = null;
    if (hoveredSlotId) {
      const hoveredSlot = snapshot.slots.find((s) => s.slotId === hoveredSlotId);
      if (hoveredSlot?.equipped && hoveredSlot.ringName) {
        replacingRingName = hoveredSlot.ringName;
      }
    }

    nodes.detailDrawer.update({
      ringName: pr.name,
      familyId: pr.familyId,
      description: pr.description,
      statMods: pr.statMods,
      mode: "choose-slot",
      replacingRingName,
    });
  }

  function updateStatsPreview(): void {
    if (!snapshot) return;
    if (state.mode !== "choose-slot" || !state.pendingRingDefId || !hoveredSlotId) {
      nodes.statsRail.update(snapshot, null);
      return;
    }
    const delta = callbacks.computeStatsPreview?.(hoveredSlotId, state.pendingRingDefId) ?? null;
    nodes.statsRail.update(snapshot, delta);
  }

  // Sync dynamic slot count to match snapshot
  function syncDynamicSlots(): void {
    if (!snapshot) return;
    const totalSlots = snapshot.slots.length;
    if (totalSlots <= nodes.slotViews.length) return;

    // Generate configs for additional slots
    const dynamicConfigs = generateDynamicSlotConfigs(totalSlots);
    for (let i = nodes.slotViews.length; i < totalSlots; i++) {
      const config = dynamicConfigs[i];
      if (!config) continue;
      const sv = new RingSlotView(config);
      sv.positionOnHands(nodes.layout.handsW, nodes.layout.handsH);
      wireSlotEvents(sv);
      nodes.slotViews.push(sv);
      nodes.slotsContainer.addChild(sv);
    }
  }

  // ── State management ──
  function dispatch(action: HandsAction): void {
    state = transition(state, action);
    applyState();
  }

  function applyState(): void {
    if (!snapshot || !nodes) return;

    // Update ring slot visuals
    for (const sv of nodes.slotViews) {
      const slotSnap = snapshot.slots.find((s) => s.slotId === sv.slotId);
      const equipped = !!slotSnap?.equipped;
      const familyIdx = slotSnap?.familyId
        ? Math.abs(hashStr(slotSnap.familyId)) % nodes.ringTextures.length
        : 0;

      sv.setVisualState({
        equipped,
        ringTexture: equipped ? nodes.ringTextures[familyIdx] : null,
        familyColor: slotSnap?.familyColor ?? COLORS.goldDim,
        isSelected: state.selectedSlotId === sv.slotId,
        mode: state.mode,
        ringName: slotSnap?.ringName,
        empowermentScalar: slotSnap?.empowermentScalar ?? 0,
      });
    }

    // Stats rail
    if (state.mode === "choose-slot" && hoveredSlotId && state.pendingRingDefId) {
      updateStatsPreview();
    } else {
      nodes.statsRail.update(snapshot);
    }

    // Top bar mode text
    if (state.mode === "choose-slot") {
      nodes.topBarModeText.text = "CHOOSE SLOT";
      nodes.topBarModeText.visible = true;
    } else {
      nodes.topBarModeText.visible = false;
    }

    // Detail drawer content
    if (state.drawerOpen) {
      if (state.mode === "choose-slot" && snapshot.pendingRingDef) {
        updateChooseSlotDrawer();
      } else if (state.mode === "selected" && state.selectedSlotId) {
        const slotSnap = snapshot.slots.find((s) => s.slotId === state.selectedSlotId);
        if (slotSnap?.equipped) {
          nodes.detailDrawer.update({
            ringName: slotSnap.ringName ?? "Unknown",
            familyId: slotSnap.familyId ?? "unknown",
            description: slotSnap.description ?? "",
            statMods: slotSnap.statMods,
            mode: "selected",
            slotId: slotSnap.slotId,
            instanceId: slotSnap.instanceId,
            levelUpTokens: snapshot.storedTokens.LEVEL_UP,
            effectTokens: snapshot.storedTokens.INCREASED_EFFECT_20,
            unlockedTalentCount: slotSnap.unlockedTalentCount,
            totalTalentCount: slotSnap.totalTalentCount,
            availablePassivePoints: slotSnap.availablePassivePoints,
          });
        }
      } else {
        nodes.detailDrawer.update(null);
      }
    } else {
      nodes.detailDrawer.update(null);
    }

    // Animate drawer
    animateDrawer(state.drawerOpen);

    // Animate hands shift
    animateHandsShift(state.handsShiftActive);

    // Acquisition banner
    nodes.acquisitionBanner.visible = state.mode === "choose-slot";
    if (state.mode === "choose-slot") {
      animateBanner(true);
    }
  }

  // ── Animations ──
  let drawerOpen = false;
  function animateDrawer(open: boolean): void {
    if (open === drawerOpen) return;
    drawerOpen = open;
    if (open) {
      nodes.detailDrawer.setDrawerHeight(nodes.layout.drawerH);
    } else {
      nodes.detailDrawer.setDrawerHeight(0);
    }
  }

  let handsShifted = false;
  function animateHandsShift(shift: boolean): void {
    if (shift === handsShifted) return;
    handsShifted = shift;
    const baseY = nodes.layout.handsY - nodes.layout.topBarH;
    const targetY = shift ? baseY + nodes.layout.handsShiftY : baseY;
    void tweenTo(nodes.handsViewport, { y: targetY }, 450, Easing.springOut);
  }

  function animateBanner(show: boolean): void {
    nodes.acquisitionBanner.visible = show;
  }

  // ── Entrance animation ──
  async function playEntranceAnimation(): Promise<void> {
    if (entranceAnimating) return;
    entranceAnimating = true;
    const layout = nodes.layout;

    // Set initial states for all elements
    nodes.bgOverlay.alpha = 0;
    nodes.topBar.y = -layout.topBarH;

    // Hands start below screen
    const handsBaseY = layout.handsY - layout.topBarH;
    const handsStartY = handsBaseY + layout.handsH * 1.15;
    nodes.handsViewport.y = handsStartY;

    // Stats rail starts off-screen right
    nodes.statsRail.x = layout.screenW;

    // All slots start hidden
    for (const sv of nodes.slotViews) {
      sv.alpha = 0;
      sv.scale.set(0);
    }

    // 1. BG overlay fade (immediate, 350ms)
    const bgTween = tweenTo(nodes.bgOverlay, { alpha: 1 }, 350, Easing.cubicOut);

    // 2. Top bar slide down (immediate, 420ms)
    const topBarTween = tweenTo(nodes.topBar, { y: 0 }, 420, Easing.decelerate);

    // 3. Hands slide up (immediate, 680ms)
    const handsTargetY = state.handsShiftActive ? handsBaseY + layout.handsShiftY : handsBaseY;
    const handsTween = tweenTo(
      nodes.handsViewport,
      { y: handsTargetY },
      680,
      Easing.decelerateStrong,
    );

    // 4. Stats rail slide in (120ms delay, 420ms duration)
    const statsRailFinalX = layout.screenW - layout.statsRailW;
    const statsRailTween = new Promise<void>((resolve) => {
      setTimeout(() => {
        tweenTo(nodes.statsRail, { x: statsRailFinalX }, 420, Easing.decelerate).then(resolve);
      }, 120);
    });

    // 5. Staggered slot pop-ins (560ms delay + 42ms stagger per slot)
    const slotTweens = nodes.slotViews.map(
      (sv, i) =>
        new Promise<void>((resolve) => {
          const delay = 560 + i * 42;
          setTimeout(() => {
            sv.alpha = 0;
            sv.scale.set(0);
            // Pop: scale 0 -> 1.12 -> 1
            tweenTo(sv, { alpha: 1 }, 200, Easing.cubicOut);
            tweenTo(sv.scale, { x: 1.12, y: 1.12 }, 200, Easing.cubicOut).then(() => {
              tweenTo(sv.scale, { x: 1, y: 1 }, 180, Easing.cubicOut).then(resolve);
            });
          }, delay);
        }),
    );

    await Promise.all([bgTween, topBarTween, handsTween, statsRailTween, ...slotTweens]);

    // Update handsShifted flag so later shift animations don't jump
    if (state.handsShiftActive) {
      handsShifted = true;
    }

    entranceAnimating = false;
  }

  // ── Exit animation ──
  async function playExitAnimation(): Promise<void> {
    if (exitAnimating) return;
    exitAnimating = true;
    const layout = nodes.layout;

    // Cancel any entrance tweens still running
    cancelAllTweens();

    // Animate everything out (fast ~300ms)
    const bgTween = tweenTo(nodes.bgOverlay, { alpha: 0 }, 250, Easing.cubicOut);
    const topBarTween = tweenTo(nodes.topBar, { y: -layout.topBarH }, 300, Easing.decelerate);
    const handsTween = tweenTo(
      nodes.handsViewport,
      { y: nodes.handsViewport.y + layout.handsH * 0.5 },
      300,
      Easing.decelerate,
    );
    const statsRailTween = tweenTo(nodes.statsRail, { x: layout.screenW }, 300, Easing.decelerate);

    // Fade slots quickly
    for (const sv of nodes.slotViews) {
      tweenTo(sv, { alpha: 0 }, 200, Easing.cubicOut);
    }

    await Promise.all([bgTween, topBarTween, handsTween, statsRailTween]);

    exitAnimating = false;
  }

  // ── Public API ──
  return {
    show(w: any, pendingRingDefId?: string | null) {
      world = w;
      snapshot = buildHandsScreenSnapshot(w, pendingRingDefId);
      state = createInitialHandsState(pendingRingDefId);
      drawerOpen = false;
      handsShifted = false;
      hoveredSlotId = null;
      visible = true;
      nodes.screenRoot.visible = true;
      showPixiCanvas();
      app.resize();
      relayoutScene(nodes);
      syncDynamicSlots();
      applyState();

      // Play entrance animation
      void playEntranceAnimation();
    },

    hide() {
      if (!visible) return;

      // Play exit animation, then clean up
      void playExitAnimation().then(() => {
        visible = false;
        nodes.screenRoot.visible = false;
        hidePixiCanvas();
        cancelAllTweens();
        state = createInitialHandsState();
        drawerOpen = false;
        handsShifted = false;
        hoveredSlotId = null;
        devChooseSlotPending = null;
        nodes.detailDrawer.setDrawerHeight(0);
        if (debugTuner?.active) debugTuner.deactivate();

        // Reset positions for next show
        nodes.topBar.y = 0;
        nodes.bgOverlay.alpha = 1;
        for (const sv of nodes.slotViews) {
          sv.alpha = 1;
          sv.scale.set(1);
        }
      });
    },

    destroy() {
      visible = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      app.ticker.remove(tickFn);
      debugTuner?.destroy();
      nodes.screenRoot.destroy({ children: true });
      hidePixiCanvas();
    },

    isVisible() {
      return visible;
    },
  };
}

// Simple string hash for family -> texture mapping
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
