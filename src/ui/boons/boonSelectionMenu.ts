import type { BoonOption } from "../../game/progression/rings/ringBoonSelection";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export type BoonSelectionState = {
  active: boolean;
  ringName: string;
  familyId: string;
  options: BoonOption[];
};

export function mountBoonSelectionMenu(args: {
  root: HTMLElement;
  onPick: (nodeId: string) => void;
}): {
  render: (state: BoonSelectionState | null) => void;
  destroy: () => void;
} {
  const root = args.root;
  let wasActive = false;
  let entryShieldUntilMs = 0;
  const tapSafe = createTapSafeActivator({
    isBlockedNow: () => Date.now() < entryShieldUntilMs,
  });

  const ensureStructure = () => {
    const existing = root.className ? `${root.className} ` : "";
    if (!root.className.includes("deckOverlay")) {
      root.className = `${existing}deckOverlay boonOverlay`.trim();
    }
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
      choices.className = "deckCardGrid";
      panel.appendChild(choices);
    }
    return { title, sub, choices };
  };

  const render = (state: BoonSelectionState | null): void => {
    if (!state || !state.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;

    const { title, sub, choices } = ensureStructure();
    title.textContent = "Choose a Boon";
    sub.textContent = `${state.ringName} \u2014 ${state.familyId} family`;
    choices.innerHTML = "";

    for (const option of state.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deckCardButton rarity-3";
      btn.dataset.boonNodeId = option.nodeId;

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = option.name;

      const desc = document.createElement("div");
      desc.className = "deckCardSub";
      desc.textContent = option.description;

      btn.appendChild(name);
      btn.appendChild(desc);
      tapSafe.bindActivate(btn, () => args.onPick(option.nodeId));
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
      wasActive = false;
    },
  };
}
