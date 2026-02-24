export function mountCardRewardMenu(args: {
  root: HTMLElement;
  onPick: (cardId: string) => void;
}): {
  render: (state: { active: boolean; source: string; options: string[] } | null) => void;
  destroy: () => void;
} {
  const root = args.root;

  const ensureStructure = () => {
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

    let choices = panel.querySelector("#luChoices") as HTMLElement | null;
    if (!choices) {
      choices = document.createElement("div");
      choices.id = "luChoices";
      panel.appendChild(choices);
    }

    return { title, sub, choices };
  };

  const sourceLabel = (source: string): string => {
    if (source === "BOSS_CHEST") return "Boss Chest";
    return "Zone Trial";
  };

  const render = (state: { active: boolean; source: string; options: string[] } | null): void => {
    if (!state || !state.active) {
      root.hidden = true;
      return;
    }

    const { title, sub, choices } = ensureStructure();
    title.textContent = "Reward";
    sub.textContent = `Choose 1 card (${sourceLabel(state.source)})`;
    choices.innerHTML = "";

    for (let i = 0; i < state.options.length; i++) {
      const cardId = state.options[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choiceBtn";
      btn.dataset.cardId = cardId;

      const titleRow = document.createElement("div");
      titleRow.className = "choiceTitle";
      titleRow.textContent = cardId;

      const desc = document.createElement("div");
      desc.className = "choiceDesc";
      desc.textContent = "Pick this card";

      btn.appendChild(titleRow);
      btn.appendChild(desc);
      btn.addEventListener("click", () => args.onPick(cardId));
      choices.appendChild(btn);
    }

    root.hidden = false;
  };

  return {
    render,
    destroy: () => {
      root.hidden = true;
      root.innerHTML = "";
    },
  };
}
