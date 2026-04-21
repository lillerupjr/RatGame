import {
  progressionRewardOptionView,
} from "../../game/progression/rewards/progressionRewardFlow";
import { rewardFamilyLabel, type ProgressionRewardFamily } from "../../game/progression/rewards/rewardFamilies";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export type VendorShopOffer = {
  family: ProgressionRewardFamily;
  optionId: string;
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

    let sub = panel.querySelector(".sub") as HTMLElement | null;
    if (!sub) {
      sub = document.createElement("div");
      sub.className = "sub";
      panel.appendChild(sub);
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

    return { top, title, sub, offers, actions };
  };

  const renderOffers = (): void => {
    if (!currentState || !currentState.active) return;
    const state = currentState;
    const { top, title, sub, offers, actions } = ensureStructure();
    top.textContent = `Gold: ${state.gold}`;
    title.textContent = "Vendor";
    sub.textContent = "Choose progression offers to buy";
    offers.innerHTML = "";
    actions.innerHTML = "";

    const totalSlots = state.offers.length + 1;
    if (selectedIndex >= totalSlots) selectedIndex = 0;

    for (let i = 0; i < state.offers.length; i++) {
      const offer = state.offers[i];
      const view = progressionRewardOptionView(offer.family, offer.optionId);
      const canAfford = state.gold >= offer.priceG;
      const disabled = offer.isSold || !canAfford;
      const stateClass = offer.isSold ? "sold" : !canAfford ? "locked" : "available";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deckCardButton vendorCard rarity-3 ${stateClass}${i === selectedIndex ? " selected" : ""}`;
      btn.disabled = disabled;
      btn.dataset.index = String(i);

      const topRow = document.createElement("div");
      topRow.className = "deckCardTopRow";
      const family = document.createElement("span");
      family.className = "deckCardTier";
      family.textContent = rewardFamilyLabel(offer.family);
      const price = document.createElement("span");
      price.className = "deckCardRarity";
      price.textContent = offer.isSold ? "Sold" : `${offer.priceG}g`;
      topRow.appendChild(family);
      topRow.appendChild(price);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = view.title;

      const body = document.createElement("div");
      body.className = "deckCardSub";
      body.textContent = view.subtitle;

      btn.appendChild(topRow);
      btn.appendChild(name);
      btn.appendChild(body);
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
