import { cardViewModel, rarityClass } from "../cards/cardUi";

export type VendorShopCard = {
  cardId: string;
  purchased: boolean;
};

export type VendorShopState = {
  active: boolean;
  gold: number;
  price: number;
  cards: VendorShopCard[];
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

    let actions = panel.querySelector(".vendorActions") as HTMLElement | null;
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "vendorActions";
      panel.appendChild(actions);
    }

    return { top, title, sub, cards, actions };
  };

  const renderCards = (): void => {
    if (!currentState || !currentState.active) return;
    const { top, title, sub, cards, actions } = ensureStructure();
    top.textContent = `Gold: ${currentState.gold}`;
    title.textContent = "Vendor";
    sub.textContent = "Choose one card to buy";
    cards.innerHTML = "";
    actions.innerHTML = "";
    const totalSlots = currentState.cards.length + 1; // + Leave button
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
      btn.addEventListener("mouseenter", () => {
        selectedIndex = i;
        renderCards();
      });
      btn.addEventListener("focus", () => {
        selectedIndex = i;
        renderCards();
      });
      btn.addEventListener("click", () => args.onBuy(i));
      cards.appendChild(btn);
    }

    const leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.className = `vendorLeaveButton${selectedIndex === currentState.cards.length ? " selected" : ""}`;
    leaveBtn.textContent = "Leave";
    leaveBtn.addEventListener("mouseenter", () => {
      selectedIndex = currentState ? currentState.cards.length : 0;
      renderCards();
    });
    leaveBtn.addEventListener("focus", () => {
      selectedIndex = currentState ? currentState.cards.length : 0;
      renderCards();
    });
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

  const onKeydown = (e: KeyboardEvent): void => {
    if (!currentState || !currentState.active || root.hidden) return;
    const slotCount = currentState.cards.length + 1; // + leave
    if (slotCount <= 0) return;

    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      selectedIndex = (selectedIndex - 1 + slotCount) % slotCount;
      renderCards();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D" || e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      selectedIndex = (selectedIndex + 1) % slotCount;
      renderCards();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      if (selectedIndex === currentState.cards.length) {
        args.onLeave();
      } else {
        const card = currentState.cards[selectedIndex];
        const canAfford = currentState.gold >= currentState.price;
        if (!card?.purchased && canAfford) args.onBuy(selectedIndex);
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      args.onClose();
      e.preventDefault();
    }
  };

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("keydown", onKeydown);
  }

  return {
    render,
    destroy: () => {
      root.hidden = true;
      root.innerHTML = "";
      currentState = null;
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("keydown", onKeydown);
      }
    },
  };
}
