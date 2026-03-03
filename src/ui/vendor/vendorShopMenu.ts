import { cardViewModel, rarityClass, tierClass } from "../cards/cardUi";
import { getRelicById } from "../../game/content/relics";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export type VendorShopCard = {
  cardId: string;
  priceG: number;
  purchased: boolean;
};


export type VendorShopState = {
  active: boolean;
  gold: number;
  cards: VendorShopCard[];
  relicOffers: Array<{ relicId: string; priceG: number; isSold: boolean }>;
};

export function mountVendorShopMenu(args: {
  root: HTMLElement;
  onBuy: (index: number) => void;
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
  let activeTab: "cards" | "relics" = "cards";
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

    let tabs = panel.querySelector(".vendorTabs") as HTMLElement | null;
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.className = "vendorTabs";
      panel.appendChild(tabs);
    }

    let cards = panel.querySelector(".deckCardGrid") as HTMLElement | null;
    if (!cards) {
      cards = document.createElement("div");
      cards.className = "deckCardGrid";
      panel.appendChild(cards);
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

    return { top, title, sub, tabs, cards, relicTitle, relics, actions };
  };

  const renderCards = (): void => {
    if (!currentState || !currentState.active) return;
    const state = currentState;
    const { top, title, sub, tabs, cards, relicTitle, relics, actions } = ensureStructure();
    top.textContent = `Gold: ${state.gold}`;
    title.textContent = "Vendor";
    sub.textContent = "Choose cards and relics to buy";
    tabs.innerHTML = "";
    cards.innerHTML = "";
    relics.innerHTML = "";
    actions.innerHTML = "";
    relicTitle.textContent = "Relics";
    const hasCards = state.cards.length > 0;
    const hasRelics = state.relicOffers.length > 0;
    if (!hasCards && hasRelics) activeTab = "relics";
    if (!hasRelics && hasCards) activeTab = "cards";
    if (!hasCards && !hasRelics) activeTab = "cards";

    const cardsTab = document.createElement("button");
    cardsTab.type = "button";
    cardsTab.className = `vendorTabBtn${activeTab === "cards" ? " active" : ""}`;
    cardsTab.textContent = `Cards (${state.cards.length})`;
    cardsTab.disabled = !hasCards;
    tapSafe.bindActivate(cardsTab, () => {
      if (activeTab === "cards" || !hasCards) return;
      activeTab = "cards";
      selectedIndex = 0;
      renderCards();
    });
    tabs.appendChild(cardsTab);

    const relicsTab = document.createElement("button");
    relicsTab.type = "button";
    relicsTab.className = `vendorTabBtn${activeTab === "relics" ? " active" : ""}`;
    relicsTab.textContent = `Relics (${state.relicOffers.length})`;
    relicsTab.disabled = !hasRelics;
    tapSafe.bindActivate(relicsTab, () => {
      if (activeTab === "relics" || !hasRelics) return;
      activeTab = "relics";
      selectedIndex = state.cards.length;
      renderCards();
    });
    tabs.appendChild(relicsTab);

    const totalSlots = state.cards.length + state.relicOffers.length + 1; // + Leave button
    if (selectedIndex >= totalSlots) selectedIndex = 0;
    if (activeTab === "cards" && !hasCards && hasRelics) selectedIndex = state.cards.length;
    if (activeTab === "relics" && !hasRelics && hasCards) selectedIndex = 0;

    cards.hidden = activeTab !== "cards";
    relicTitle.hidden = activeTab !== "relics";
    relics.hidden = activeTab !== "relics";

    if (activeTab === "cards") {
      for (let i = 0; i < state.cards.length; i++) {
      const item = state.cards[i];
      const vm = cardViewModel(item.cardId);
      const canAfford = state.gold >= item.priceG;
      const disabled = item.purchased || !canAfford;
      const stateClass = item.purchased ? "sold" : !canAfford ? "locked" : "available";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        `deckCardButton vendorCard ${tierClass(vm.tier)} ${rarityClass(vm.rarity)} ${stateClass}${i === selectedIndex ? " selected" : ""}`;
      btn.disabled = disabled;
      btn.dataset.index = String(i);

      const topRow = document.createElement("div");
      topRow.className = "deckCardTopRow";
      const tier = document.createElement("span");
      tier.className = "deckCardTier";
      tier.textContent = vm.tier ? `Tier ${vm.tier}` : "Tier ?";
      const price = document.createElement("span");
      price.className = "vendorPriceBadge";
      price.textContent = item.purchased ? "SOLD" : `${item.priceG}g`;
      topRow.appendChild(tier);
      topRow.appendChild(price);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = vm.name;

      const desc = document.createElement("div");
      desc.className = "deckCardDesc";
      for (let j = 0; j < vm.lines.length; j++) {
        const line = document.createElement("div");
        line.textContent = vm.lines[j];
        desc.appendChild(line);
      }

      const foot = document.createElement("div");
      foot.className = "vendorStateText";
      if (item.purchased) foot.textContent = "Sold";
      else if (!canAfford) foot.textContent = "Not enough gold";
      else foot.textContent = "Available";

      btn.appendChild(topRow);
      btn.appendChild(name);
      btn.appendChild(desc);
      btn.appendChild(foot);
      tapSafe.bindActivate(btn, () => args.onBuy(i));
      cards.appendChild(btn);
    }
    }

    if (activeTab === "relics") {
      for (let i = 0; i < state.relicOffers.length; i++) {
      const offer = state.relicOffers[i];
      const relic = getRelicById(offer.relicId);
      const canAfford = state.gold >= offer.priceG;
      const disabled = offer.isSold || !canAfford;
      const stateClass = offer.isSold ? "sold" : !canAfford ? "locked" : "available";
      const idx = state.cards.length + i;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deckCardButton vendorCard ${stateClass}${idx === selectedIndex ? " selected" : ""}`;
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
      const d = relic?.desc?.[0];
      line.textContent = d && d.length > 0 ? d : "(No description)";
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
    }

    const leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.className = `vendorLeaveButton${selectedIndex === state.cards.length + state.relicOffers.length ? " selected" : ""}`;
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
    renderCards();
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
