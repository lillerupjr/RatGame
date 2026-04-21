import {
  progressionRewardOptionView,
  type ProgressionRewardState,
} from "../../game/progression/rewards/progressionRewardFlow";
import { rewardFamilyLabel } from "../../game/progression/rewards/rewardFamilies";
import { createTapSafeActivator } from "../interaction/tapSafeActivate";

const OVERLAY_ENTRY_SHIELD_MS = 300;

function sourceLabel(source: string): string {
  if (source === "BOSS_CHEST") return "Boss Chest";
  if (source === "LEVEL_UP") return "Ring Token";
  if (source === "SIDE_OBJECTIVE") return "Side Objective";
  return "Floor Complete";
}

export function mountProgressionRewardMenu(args: {
  root: HTMLElement;
  onPick: (optionId: string) => void;
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

  const render = (state: ProgressionRewardState | null): void => {
    currentState = state;
    if (!currentState || !currentState.active) {
      root.hidden = true;
      wasActive = false;
      return;
    }
    if (!wasActive) entryShieldUntilMs = Date.now() + OVERLAY_ENTRY_SHIELD_MS;

    const { title, sub, choices } = ensureStructure();
    title.textContent = `Choose a ${rewardFamilyLabel(currentState.family)} Reward`;
    sub.textContent = `Pick 1 reward (${sourceLabel(currentState.source)})`;
    choices.innerHTML = "";

    for (const optionId of currentState.options) {
      const view = progressionRewardOptionView(currentState.family, optionId);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deckCardButton rarity-3";
      btn.dataset.progressionRewardId = optionId;

      const top = document.createElement("div");
      top.className = "deckCardTopRow";
      const family = document.createElement("span");
      family.className = "deckCardTier";
      family.textContent = rewardFamilyLabel(view.family);
      const slot = document.createElement("span");
      slot.className = "deckCardRarity";
      slot.textContent = "V1";
      top.appendChild(family);
      top.appendChild(slot);

      const name = document.createElement("div");
      name.className = "deckCardTitle";
      name.textContent = view.title;

      const subtitle = document.createElement("div");
      subtitle.className = "deckCardSub";
      subtitle.textContent = view.subtitle;

      btn.appendChild(top);
      btn.appendChild(name);
      btn.appendChild(subtitle);
      tapSafe.bindActivate(btn, () => args.onPick(optionId));
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
