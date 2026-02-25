import { cardViewModel, rarityClass } from "../cards/cardUi";
import { getRelicById } from "../../game/content/relics";

export type VendorShopCard = {
  cardId: string;
  purchased: boolean;
};

export type VendorShopState = {
  active: boolean;
  gold: number;
  price: number;
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

    return { top, title, sub, cards, relicTitle, relics, actions };
  };

  const renderCards = (): void => {
    if (!currentState || !currentState.active) return;
    const { top, title, sub, cards, relicTitle, relics, actions } = ensureStructure();
    top.textContent = `Gold: ${currentState.gold}`;
    title.textContent = "Vendor";
    sub.textContent = "Choose cards and relics to buy";
    cards.innerHTML = "";
    relics.innerHTML = "";
    actions.innerHTML = "";
    relicTitle.textContent = "Relics";
    const totalSlots = currentState.cards.length + currentState.relicOffers.length + 1; // + Leave button
    if (selectedIndex >= totalSlots) selectedIndex = 0;

    for (let i = 0; i < currentState.cards.length; i++) {
      const item = currentState.cards[i];
      const vm = cardViewModel(item.cardId);
      const canAfford = currentState.gold >= currentState.price;
      const disabled = item.purchased || !canAfford;
      const stateClass = item.purchased ? "sold" : !canAfford ? "locked" : "available";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        `deckCardButton vendorCard ${rarityClass(vm.rarity)} ${stateClass}${i === selectedIndex ? " selected" : ""}`;
      btn.disabled = disabled;
      btn.dataset.index = String(i);

      const topRow = document.createElement("div");
      topRow.className = "deckCardTopRow";
      const tier = document.createElement("span");
      tier.className = "deckCardTier";
      tier.textContent = vm.tier ? `Tier ${vm.tier}` : "Tier ?";
      const price = document.createElement("span");
      price.className = "vendorPriceBadge";
      price.textContent = item.purchased ? "SOLD" : `${currentState.price}g`;
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
      btn.addEventListener("click", () => args.onBuy(i));
      cards.appendChild(btn);
    }

    for (let i = 0; i < currentState.relicOffers.length; i++) {
      const offer = currentState.relicOffers[i];
      const relic = getRelicById(offer.relicId);
      const canAfford = currentState.gold >= offer.priceG;
      const disabled = offer.isSold || !canAfford;
      const stateClass = offer.isSold ? "sold" : !canAfford ? "locked" : "available";
      const idx = currentState.cards.length + i;

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
      btn.addEventListener("click", () => args.onBuyRelic(i));
      relics.appendChild(btn);
    }

    const leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.className = `vendorLeaveButton${selectedIndex === currentState.cards.length + currentState.relicOffers.length ? " selected" : ""}`;
    leaveBtn.textContent = "Leave";
    leaveBtn.addEventListener("click", args.onLeave);
    actions.appendChild(leaveBtn);
  };

  const render = (state: VendorShopState | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      return;
    }
    renderCards();
    root.hidden = false;
  };

  return {
    render,
    destroy: () => {
      root.hidden = true;
      root.innerHTML = "";
      currentState = null;
    },
  };
}
