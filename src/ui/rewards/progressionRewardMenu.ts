import {
  type ProgressionRewardState,
} from "../../game/progression/rewards/progressionRewardFlow";
import { progressionRewardOptionView } from "../../game/progression/rewards/progressionOffers";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

export function mountProgressionRewardMenu(args: {
  root: HTMLElement;
  onPick: (optionId: string) => void;
  onReroll: () => void;
}): {
  render: (state: ProgressionRewardState | null) => void;
  destroy: () => void;
} {
  const root = args.root;
  let currentState: ProgressionRewardState | null = null;
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
    let actions = panel.querySelector(".rewardActionRow") as HTMLElement | null;
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "rewardActionRow";
      panel.appendChild(actions);
    }
    let choices = panel.querySelector(".deckCardGrid") as HTMLElement | null;
    if (!choices) {
      choices = document.createElement("div");
      panel.appendChild(choices);
    }
    choices.className = "deckCardGrid";
    return { title, actions, choices };
  };

  const render = (state: ProgressionRewardState | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;

    const { title, actions, choices } = ensureStructure();
    title.textContent = "Choose reward";
    actions.innerHTML = "";
    if (currentState.family === "RING" && currentState.rerollsRemaining > 0) {
      const reroll = document.createElement("button");
      reroll.type = "button";
      reroll.className = "rewardRerollButton";
      reroll.textContent = `Reroll (${currentState.rerollsRemaining})`;
      tapSafe.bindActivate(reroll, () => args.onReroll());
      actions.appendChild(reroll);
    }
    choices.innerHTML = "";

    for (const option of currentState.options) {
      const view = progressionRewardOptionView(option);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deckCardButton rarity-3";
      btn.dataset.progressionRewardId = option.id;

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
      tapSafe.bindActivate(btn, () => args.onPick(option.id));
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
