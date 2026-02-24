import { cardViewModel, rarityClass } from "../cards/cardUi";

export function mountCardRewardMenu(args: {
  root: HTMLElement;
  onPick: (cardId: string) => void;
}): {
  render: (state: { active: boolean; source: string; options: string[] } | null) => void;
  destroy: () => void;
} {
  const root = args.root;

  let currentState: { active: boolean; source: string; options: string[] } | null = null;
  let selectedIndex = 0;

  const ensureStructure = () => {
    const existing = root.className ? `${root.className} ` : "";
    root.className = `${existing}deckOverlay rewardOverlay`.trim();
    let panel = root.querySelector(".panel") as HTMLElement | null;
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "panel";
      root.appendChild(panel);
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

    let choices = (panel.querySelector(".deckCardGrid") as HTMLElement | null)
      ?? (panel.querySelector("#luChoices") as HTMLElement | null);
    if (!choices) {
      choices = document.createElement("div");
      panel.appendChild(choices);
    }
    choices.className = "deckCardGrid";

    return { title, sub, choices };
  };

  const sourceLabel = (source: string): string => {
    if (source === "BOSS_CHEST") return "Boss Chest";
    return "Zone Trial";
  };

  const renderCards = (): void => {
    if (!currentState || !currentState.active) return;
    const { title, sub, choices } = ensureStructure();
    title.textContent = "Choose a Card";
    sub.textContent = `Pick 1 reward (${sourceLabel(currentState.source)})`;
    choices.innerHTML = "";
    if (selectedIndex >= currentState.options.length) selectedIndex = 0;

    for (let i = 0; i < currentState.options.length; i++) {
      const cardId = currentState.options[i];
      const card = cardViewModel(cardId);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deckCardButton ${rarityClass(card.rarity)}${i === selectedIndex ? " selected" : ""}`;
      btn.dataset.cardId = cardId;
      btn.dataset.index = String(i);
      btn.dataset.selected = i === selectedIndex ? "true" : "false";

      const tierRow = document.createElement("div");
      tierRow.className = "deckCardTopRow";
      const tier = document.createElement("span");
      tier.className = "deckCardTier";
      tier.textContent = card.tier ? `Tier ${card.tier}` : "Tier ?";
      const rarity = document.createElement("span");
      rarity.className = "deckCardRarity";
      rarity.textContent = card.rarity ? `R${card.rarity}` : "R?";
      tierRow.appendChild(tier);
      tierRow.appendChild(rarity);

      const titleRow = document.createElement("div");
      titleRow.className = "deckCardTitle";
      titleRow.textContent = card.name;

      const desc = document.createElement("div");
      desc.className = "deckCardDesc";
      for (let lineIdx = 0; lineIdx < card.lines.length; lineIdx++) {
        const line = document.createElement("div");
        line.textContent = card.lines[lineIdx];
        desc.appendChild(line);
      }

      btn.appendChild(tierRow);
      btn.appendChild(titleRow);
      btn.appendChild(desc);
      btn.addEventListener("mouseenter", () => {
        selectedIndex = i;
        renderCards();
      });
      btn.addEventListener("focus", () => {
        selectedIndex = i;
        renderCards();
      });
      btn.addEventListener("click", () => args.onPick(cardId));
      choices.appendChild(btn);
    }
  };

  const render = (state: { active: boolean; source: string; options: string[] } | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      return;
    }
    if (selectedIndex >= currentState.options.length) selectedIndex = 0;
    renderCards();
    root.hidden = false;
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (!currentState || !currentState.active || root.hidden) return;
    if (currentState.options.length === 0) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      selectedIndex = (selectedIndex - 1 + currentState.options.length) % currentState.options.length;
      renderCards();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D" || e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      selectedIndex = (selectedIndex + 1) % currentState.options.length;
      renderCards();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      const cardId = currentState.options[selectedIndex];
      if (cardId) args.onPick(cardId);
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
