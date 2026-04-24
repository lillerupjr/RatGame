import type { Application } from "pixi.js";
import { getOrCreatePixiApp, showPixiCanvas, hidePixiCanvas } from "../pixiApp";
import { tweenTo, Easing, cancelAllTweens } from "../pixiTween";
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
import { getRingDefById } from "../../../game/progression/rings/ringContent";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";
import { COLORS } from "../pixiTheme";
import { describeStatMod } from "../../formatters";
import { DebugSlotTuner } from "./debugSlotTuner";

export type HandsScreenCallbacks = {
  onEquipToSlot: (slotId: FingerSlotId) => void;
  onClose: () => void;
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

  // Debug slot tuner (DEV only)
  let debugTuner: DebugSlotTuner | null = null;
  if (import.meta.env.DEV) {
    debugTuner = new DebugSlotTuner(nodes.slotViews);
    nodes.handsViewport.addChild(debugTuner);
    debugTuner.updateDimensions(nodes.layout.handsW, nodes.layout.handsH);
  }

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

  // ── Wire slot clicks ──
  for (const sv of nodes.slotViews) {
    sv.onSlotClick = (slotId) => {
      if (state.mode === "choose-slot") {
        dispatch({ type: "CHOOSE_SLOT", slotId });
        // Actually equip
        callbacks.onEquipToSlot(slotId);
        return;
      }
      // Browse / selected mode: only select if equipped
      const slotSnap = snapshot?.slots.find((s) => s.slotId === slotId);
      if (slotSnap?.equipped) {
        dispatch({ type: "SELECT_RING", slotId });
      }
    };
  }

  // ── Close button ──
  nodes.closeBtn.setOnPress(() => {
    callbacks.onClose();
  });

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
      });
    }

    // Stats rail
    nodes.statsRail.update(snapshot);

    // Detail drawer content
    if (state.drawerOpen) {
      if (state.mode === "choose-slot" && snapshot.pendingRingDef) {
        const pr = snapshot.pendingRingDef;
        nodes.detailDrawer.update({
          ringName: pr.name,
          familyId: pr.familyId,
          description: pr.description,
          statMods: pr.statMods,
          mode: "choose-slot",
        });
      } else if (state.mode === "selected" && state.selectedSlotId) {
        const slotSnap = snapshot.slots.find((s) => s.slotId === state.selectedSlotId);
        if (slotSnap?.equipped) {
          nodes.detailDrawer.update({
            ringName: slotSnap.ringName ?? "Unknown",
            familyId: slotSnap.familyId ?? "unknown",
            description: slotSnap.description ?? "",
            statMods: slotSnap.statMods,
            mode: "selected",
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
    const targetH = open ? nodes.layout.drawerH : 0;
    tweenTo(
      { h: open ? 0 : nodes.layout.drawerH },
      { h: targetH },
      420,
      Easing.cubicInOut,
    ).then(() => {});
    // Use a simple approach: set height directly since tweenTo operates on objects
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

  // ── Public API ──
  return {
    show(w: any, pendingRingDefId?: string | null) {
      world = w;
      snapshot = buildHandsScreenSnapshot(w, pendingRingDefId);
      state = createInitialHandsState(pendingRingDefId);
      drawerOpen = false;
      handsShifted = false;
      visible = true;
      nodes.screenRoot.visible = true;
      showPixiCanvas();
      relayoutScene(nodes);
      applyState();
    },

    hide() {
      visible = false;
      nodes.screenRoot.visible = false;
      hidePixiCanvas();
      cancelAllTweens();
      state = createInitialHandsState();
      drawerOpen = false;
      handsShifted = false;
      if (debugTuner?.active) debugTuner.deactivate();
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

// Simple string hash for family → texture mapping
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
