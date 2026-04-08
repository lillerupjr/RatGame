import { getRelicById } from "../../game/content/relics";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export type VendorShopState = {
  active: boolean;
  gold: number;
  relicOffers: Array<{ relicId: string; priceG: number; isSold: boolean }>;
};

export function mountVendorShopMenu(args: {
  root: HTMLElement;
  onBuyRelic: (index: number) => void;
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

    let relicTitle = panel.querySelector(".vendorRelicTitle") as HTMLElement | null;
    if (!relicTitle) {
      relicTitle = document.createElement("div");
      relicTitle.className = "vendorRelicTitle";
      panel.appendChild(relicTitle);
    }

    let relics = panel.querySelector(".vendorRelicGrid") as HTMLElement | null;
    if (!relics) {
      relics = document.createElement("div");
      relics.className = "deckCardGrid vendorRelicGrid";
      panel.appendChild(relics);
    }

    let actions = panel.querySelector(".vendorActions") as HTMLElement | null;
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "vendorActions";
      panel.appendChild(actions);
    }

    return { top, title, sub, relicTitle, relics, actions };
  };

  const renderRelics = (): void => {
    if (!currentState || !currentState.active) return;
    const state = currentState;
    const { top, title, sub, relicTitle, relics, actions } = ensureStructure();
    top.textContent = `Gold: ${state.gold}`;
    title.textContent = "Vendor";
    sub.textContent = "Choose a relic to buy";
    relicTitle.textContent = "Relics";
    relics.innerHTML = "";
    actions.innerHTML = "";

    const totalSlots = state.relicOffers.length + 1;
    if (selectedIndex >= totalSlots) selectedIndex = 0;

    for (let i = 0; i < state.relicOffers.length; i++) {
      const offer = state.relicOffers[i];
      const relic = getRelicById(offer.relicId);
      const canAfford = state.gold >= offer.priceG;
      const disabled = offer.isSold || !canAfford;
      const stateClass = offer.isSold ? "sold" : !canAfford ? "locked" : "available";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deckCardButton vendorCard ${stateClass}${i === selectedIndex ? " selected" : ""}`;
      btn.disabled = disabled;
      btn.dataset.relicIndex = String(i);

      const topRow = document.createElement("div");
      topRow.className = "deckCardTopRow";
      const tier = document.createElement("span");
      tier.className = "deckCardTier";
      tier.textContent = relic?.kind ?? "RELIC";
      const price = document.createElement("span");
      price.className = "vendorPriceBadge";
      price.textContent = offer.isSold ? "SOLD" : `${offer.priceG}g`;
      topRow.appendChild(tier);
      topRow.appendChild(price);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = relic?.displayName ?? offer.relicId;

      const desc = document.createElement("div");
      desc.className = "deckCardDesc";
      const line = document.createElement("div");
      line.textContent = relic?.desc?.[0] && relic.desc[0].length > 0 ? relic.desc[0] : "(No description)";
      desc.appendChild(line);

      const foot = document.createElement("div");
      foot.className = "vendorStateText";
      if (offer.isSold) foot.textContent = "Sold";
      else if (!canAfford) foot.textContent = `Need ${offer.priceG}g`;
      else foot.textContent = "Available";

      btn.appendChild(topRow);
      btn.appendChild(name);
      btn.appendChild(desc);
      btn.appendChild(foot);
      tapSafe.bindActivate(btn, () => args.onBuyRelic(i));
      relics.appendChild(btn);
    }

    const leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.className = `vendorLeaveButton${selectedIndex === state.relicOffers.length ? " selected" : ""}`;
    leaveBtn.textContent = "Leave";
    tapSafe.bindActivate(leaveBtn, args.onLeave);
    actions.appendChild(leaveBtn);
  };

  const render = (state: VendorShopState | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) {
      entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;
    }
    renderRelics();
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
