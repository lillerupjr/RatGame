import { getRelicById } from "../../game/content/relics";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export function mountRelicRewardMenu(args: {
  root: HTMLElement;
  onPick: (relicId: string) => void;
}): {
  render: (state: { active: boolean; source: string; options: string[] } | null) => void;
  destroy: () => void;
} {
  const root = args.root;
  let currentState: { active: boolean; source: string; options: string[] } | null = null;
  let wasActive = false;
  let entryShieldUntilMs = 0;
  const tapSafe = createTapSafeActivator({
    isBlockedNow: () => Date.now() < entryShieldUntilMs,
  });

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
    let choices = panel.querySelector(".deckCardGrid") as HTMLElement | null;
    if (!choices) {
      choices = document.createElement("div");
      panel.appendChild(choices);
    }
    choices.className = "deckCardGrid";
    return { title, sub, choices };
  };

  const render = (state: { active: boolean; source: string; options: string[] } | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) {
      entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;
    }

    const { title, sub, choices } = ensureStructure();
    title.textContent = "Choose a Relic";
    sub.textContent = "Pick 1 reward (Objective Completion)";
    choices.innerHTML = "";

    for (let i = 0; i < currentState.options.length; i++) {
      const relicId = currentState.options[i];
      const relic = getRelicById(relicId);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deckCardButton rarity-3";
      btn.dataset.relicId = relicId;

      const top = document.createElement("div");
      top.className = "deckCardTopRow";
      const kind = document.createElement("span");
      kind.className = "deckCardTier";
      kind.textContent = relic?.kind ?? "RELIC";
      const slot = document.createElement("span");
      slot.className = "deckCardRarity";
      slot.textContent = "Relic";
      top.appendChild(kind);
      top.appendChild(slot);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = relic?.displayName ?? relicId;

      btn.appendChild(top);
      btn.appendChild(name);
      tapSafe.bindActivate(btn, () => args.onPick(relicId));
      choices.appendChild(btn);
    }

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
