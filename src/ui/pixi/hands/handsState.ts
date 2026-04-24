import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";

export type HandsMode = "browse" | "selected" | "choose-slot";

export type HandsScreenState = {
  mode: HandsMode;
  selectedSlotId: FingerSlotId | null;
  pendingRingDefId: string | null;
  drawerOpen: boolean;
  handsShiftActive: boolean;
};

export type HandsAction =
  | { type: "SELECT_RING"; slotId: FingerSlotId }
  | { type: "DESELECT" }
  | { type: "CHOOSE_SLOT"; slotId: FingerSlotId }
  | { type: "ENTER_CHOOSE_MODE"; ringDefId: string }
  | { type: "CLOSE" };

export function createInitialHandsState(pendingRingDefId?: string | null): HandsScreenState {
  if (pendingRingDefId) {
    return {
      mode: "choose-slot",
      selectedSlotId: null,
      pendingRingDefId,
      drawerOpen: true,
      handsShiftActive: true,
    };
  }
  return {
    mode: "browse",
    selectedSlotId: null,
    pendingRingDefId: null,
    drawerOpen: false,
    handsShiftActive: false,
  };
}

export function transition(
  state: HandsScreenState,
  action: HandsAction,
): HandsScreenState {
  switch (action.type) {
    case "SELECT_RING": {
      if (state.mode === "choose-slot") return state;
      if (state.mode === "selected" && state.selectedSlotId === action.slotId) {
        // Toggle off
        return {
          ...state,
          mode: "browse",
          selectedSlotId: null,
          drawerOpen: false,
          handsShiftActive: false,
        };
      }
      return {
        ...state,
        mode: "selected",
        selectedSlotId: action.slotId,
        drawerOpen: true,
        handsShiftActive: true,
      };
    }
    case "DESELECT":
      if (state.mode === "choose-slot") return state;
      return {
        ...state,
        mode: "browse",
        selectedSlotId: null,
        drawerOpen: false,
        handsShiftActive: false,
      };
    case "CHOOSE_SLOT":
      if (state.mode !== "choose-slot") return state;
      return {
        ...state,
        selectedSlotId: action.slotId,
      };
    case "ENTER_CHOOSE_MODE":
      return {
        mode: "choose-slot",
        selectedSlotId: null,
        pendingRingDefId: action.ringDefId,
        drawerOpen: true,
        handsShiftActive: true,
      };
    case "CLOSE":
      return {
        mode: "browse",
        selectedSlotId: null,
        pendingRingDefId: null,
        drawerOpen: false,
        handsShiftActive: false,
      };
  }
}
