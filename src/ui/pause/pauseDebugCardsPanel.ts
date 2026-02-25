import { getAllCardIds } from "../../game/combat_mods/content/cards/cardPool";
import { getCardById } from "../../game/combat_mods/content/cards/cardPool";
import { isPauseDebugCardsEnabled } from "../../userSettings";

export type PauseDebugCardsPanelController = {
  render(): void;
  destroy(): void;
};

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function getCardCountFromArray(cards: string[], cardId: string): number {
  let count = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i] === cardId) count += 1;
  }
  return count;
}

function readWorldCards(world: any): string[] {
  return Array.isArray(world?.cards) ? [...world.cards] : [];
}

function getCardLabel(cardId: string): string {
  const card = getCardById(cardId);
  return card?.displayName ?? cardId;
}

export function mountPauseDebugCardsPanel(args: {
  root: HTMLElement;
  getWorld: () => any;
  onChange: () => void;
}): PauseDebugCardsPanelController {
  const root = args.root;
  const cardIds = getAllCardIds();

  let expanded = false;
  let draftCounts = new Map<string, number>();
  let dirty = false;
  let initialized = false;

  const syncDraftFromWorld = () => {
    draftCounts = new Map<string, number>();
    const cards = readWorldCards(args.getWorld());
    for (let i = 0; i < cardIds.length; i++) {
      const id = cardIds[i];
      draftCounts.set(id, getCardCountFromArray(cards, id));
    }
    dirty = false;
    initialized = true;
  };

  const render = (): void => {
    clearChildren(root);

    if (!isPauseDebugCardsEnabled()) {
      root.hidden = true;
      return;
    }

    root.hidden = false;

    if (!initialized) syncDraftFromWorld();

    const headerRow = document.createElement("div");
    headerRow.className = "pauseDebugCardHeaderRow";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "pauseDebugCardToggleBtn";
    toggleBtn.setAttribute("data-debug-cards-toggle", "1");
    toggleBtn.textContent = expanded ? "Hide Debug Cards" : "Edit Debug Cards";
    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;
      render();
    });
    headerRow.appendChild(toggleBtn);
    root.appendChild(headerRow);

    if (!expanded) return;

    const controlsRow = document.createElement("div");
    controlsRow.className = "pauseDebugCardControls";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "pauseDebugCardSaveBtn";
    saveBtn.setAttribute("data-debug-cards-save", "1");
    saveBtn.textContent = dirty ? "Save Changes" : "Saved";
    saveBtn.disabled = !dirty;
    saveBtn.addEventListener("click", () => {
      if (!dirty) return;
      const world = args.getWorld();
      if (!world || typeof world !== "object") return;

      const nextCards: string[] = [];
      for (let i = 0; i < cardIds.length; i++) {
        const id = cardIds[i];
        const count = draftCounts.get(id) ?? 0;
        for (let k = 0; k < count; k++) nextCards.push(id);
      }
      world.cards = nextCards;
      dirty = false;
      args.onChange();
      render();
    });
    controlsRow.appendChild(saveBtn);
    root.appendChild(controlsRow);

    const list = document.createElement("div");
    list.className = "pauseDebugCardList";

    for (let i = 0; i < cardIds.length; i++) {
      const cardId = cardIds[i];
      const row = document.createElement("div");
      row.className = "pauseDebugCardRow";
      row.setAttribute("data-debug-card-id", cardId);

      const label = document.createElement("span");
      label.className = "pauseDebugCardId";
      label.textContent = getCardLabel(cardId);

      const count = document.createElement("span");
      count.className = "pauseCardCount";
      count.textContent = `x${draftCounts.get(cardId) ?? 0}`;

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "pauseDebugCardBtn";
      plusBtn.textContent = "+";
      plusBtn.setAttribute("data-debug-card-add", cardId);
      plusBtn.addEventListener("click", () => {
        const current = draftCounts.get(cardId) ?? 0;
        draftCounts.set(cardId, current + 1);
        dirty = true;
        render();
      });

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "pauseDebugCardBtn";
      minusBtn.textContent = "-";
      minusBtn.setAttribute("data-debug-card-remove", cardId);
      minusBtn.addEventListener("click", () => {
        const current = draftCounts.get(cardId) ?? 0;
        draftCounts.set(cardId, Math.max(0, current - 1));
        dirty = true;
        render();
      });

      row.appendChild(label);
      row.appendChild(count);
      row.appendChild(plusBtn);
      row.appendChild(minusBtn);
      list.appendChild(row);
    }

    root.appendChild(list);
  };

  return {
    render,
    destroy(): void {
      initialized = false;
      clearChildren(root);
    },
  };
}
