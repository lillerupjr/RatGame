export type DialogChoiceRenderModel = {
  label: string;
  active: boolean;
  onSelect: () => void;
};

export function renderDialogChoices(container: HTMLElement, choices: DialogChoiceRenderModel[]): void {
  container.innerHTML = "";
  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = choice.active ? "dialogChoice active" : "dialogChoice";
    btn.textContent = choice.label;
    btn.addEventListener("click", () => choice.onSelect());
    container.appendChild(btn);
  }
}
