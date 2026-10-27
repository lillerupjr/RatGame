import {
  progressionRewardOptionView,
  type ProgressionRewardOption,
} from "../../game/progression/rewards/progressionOffers";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export type VendorShopOffer = {
  option: ProgressionRewardOption;
  priceG: number;
  isSold: boolean;
};

export type VendorShopState = {
  active: boolean;
  gold: number;
  offers: VendorShopOffer[];
};

export function mountVendorShopMenu(args: {
  root: HTMLElement;
  onBuy: (index: number) => void;
  onLeave: () => void;
  onClose: () => void;
}): {
  render: (state: VendorShopState | null) => void;
  destroy: () => void;
} {
  const root = args.root;
  let currentState: VendorShopState | null = null;
  let selectedIndex = 0;
  let wasActive = false;
  let entryShieldUntilMs = 0;
  const tapSafe = createTapSafeActivator({
    isBlockedNow: () => Date.now() < entryShieldUntilMs,
  });

  const ensureStructure = () => {
    root.className = "deckOverlay vendorOverlay";
    let panel = root.querySelector(".panel") as HTMLElement | null;
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "panel";
      root.appendChild(panel);
    }

    let top = panel.querySelector(".vendorTopBar") as HTMLElement | null;
    if (!top) {
      top = document.createElement("div");
      top.className = "vendorTopBar";
      panel.appendChild(top);
    }

    let title = panel.querySelector(".title") as HTMLElement | null;
    if (!title) {
      title = document.createElement("div");
      title.className = "title";
      panel.appendChild(title);
    }

    let offers = panel.querySelector(".deckCardGrid") as HTMLElement | null;
    if (!offers) {
      offers = document.createElement("div");
      offers.className = "deckCardGrid";
      panel.appendChild(offers);
    }

    let actions = panel.querySelector(".vendorActions") as HTMLElement | null;
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "vendorActions";
      panel.appendChild(actions);
    }

    return { top, title, offers, actions };
  };

  const renderOffers = (): void => {
    if (!currentState || !currentState.active) return;
    const state = currentState;
    const { top, title, offers, actions } = ensureStructure();
    top.textContent = `Gold: ${state.gold}`;
    title.textContent = "Shop";
    offers.innerHTML = "";
    actions.innerHTML = "";

    const totalSlots = state.offers.length + 1;
    if (selectedIndex >= totalSlots) selectedIndex = 0;

    for (let i = 0; i < state.offers.length; i++) {
      const offer = state.offers[i];
      const view = progressionRewardOptionView(offer.option);
      const canAfford = state.gold >= offer.priceG;
      const disabled = offer.isSold || !canAfford;
      const stateClass = offer.isSold ? "sold" : !canAfford ? "locked" : "available";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deckCardButton vendorCard rarity-3 ${stateClass}${i === selectedIndex ? " selected" : ""}`;
      btn.disabled = disabled;
      btn.dataset.index = String(i);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = view.title;
      btn.appendChild(name);

      if (view.description) {
        const desc = document.createElement("div");
        desc.className = "deckCardDesc";
        desc.textContent = view.description;
        btn.appendChild(desc);
      }

      const price = document.createElement("div");
      price.className = "vendorStateText";
      price.textContent = offer.isSold ? "Sold" : `${offer.priceG}g`;
      btn.appendChild(price);
      tapSafe.bindActivate(btn, () => args.onBuy(i));
      offers.appendChild(btn);
    }

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = `btn primary vendorLeaveBtn${selectedIndex === state.offers.length ? " selected" : ""}`;
    leave.textContent = "Leave";
    tapSafe.bindActivate(leave, args.onLeave);
    actions.appendChild(leave);
  };

  const render = (state: VendorShopState | null): void => {
    currentState = state;
    if (!state || !state.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;
    renderOffers();
    root.hidden = false;
    wasActive = true;
  };

  return {
    render,
    destroy: () => {
      root.hidden = true;
      root.innerHTML = "";
      currentState = null;
      wasActive = false;
    },
  };
}
