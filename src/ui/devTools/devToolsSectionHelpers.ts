export type ButtonVariant = "primary" | "secondary" | "danger";

export function applyButtonStyle(btn: HTMLButtonElement, variant: ButtonVariant = "secondary"): void {
  btn.style.border = "1px solid var(--border-default)";
  btn.style.borderRadius = "0";
  btn.style.background = variant === "primary"
    ? "var(--primary-btn-bg)"
    : (variant === "danger" ? "var(--danger-bg, #3a1717)" : "var(--focus-bg)");
  btn.style.color = "var(--text-primary)";
  btn.style.fontFamily = "var(--font-mono)";
  btn.style.fontWeight = "700";
  btn.style.cursor = "pointer";
  btn.style.padding = "6px 10px";
}

export function applySelectStyle(select: HTMLSelectElement): void {
  select.style.background = "var(--focus-bg)";
  select.style.color = "var(--text-primary)";
  select.style.border = "1px solid var(--border-default)";
  select.style.borderRadius = "0";
  select.style.fontFamily = "var(--font-mono)";
  select.style.setProperty("color-scheme", "dark");
}

export function createSection(root: HTMLElement, heading: string, note: string, danger = false): HTMLElement {
  const container = document.createElement("section");
  container.style.marginTop = "10px";
  container.style.border = `1px solid ${danger ? "var(--danger-border, #5a2d2d)" : "var(--border-default)"}`;
  container.style.padding = "10px";
  container.style.background = danger
    ? "linear-gradient(180deg, rgba(90,45,45,0.18), rgba(40,18,18,0.18))"
    : "rgba(0,0,0,0.15)";

  const h = document.createElement("h3");
  h.textContent = heading;
  h.style.margin = "0 0 4px 0";
  h.style.fontSize = "12px";
  h.style.fontWeight = "700";

  const p = document.createElement("p");
  p.textContent = note;
  p.style.margin = "0 0 10px 0";
  p.style.opacity = "0.85";

  container.appendChild(h);
  container.appendChild(p);
  root.appendChild(container);
  return container;
}

export function createToggleRow(
  root: HTMLElement,
  label: string,
  onChange: (checked: boolean) => void,
): HTMLInputElement {
  const row = document.createElement("label");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.padding = "3px 0";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.addEventListener("change", () => onChange(input.checked));

  row.appendChild(text);
  row.appendChild(input);
  root.appendChild(row);
  return input;
}

export function createSelectRow<T extends string | number>(
  root: HTMLElement,
  label: string,
  options: readonly T[],
  format: (value: T) => string,
  onChange: (value: T) => void,
): HTMLSelectElement {
  const row = document.createElement("label");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.padding = "3px 0";

  const text = document.createElement("span");
  text.textContent = label;

  const select = document.createElement("select");
  applySelectStyle(select);
  for (let i = 0; i < options.length; i++) {
    const optionValue = options[i];
    const opt = document.createElement("option");
    opt.value = `${optionValue}`;
    opt.textContent = format(optionValue);
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    const selected = options.find((optionValue) => `${optionValue}` === select.value) ?? options[0];
    onChange(selected);
  });

  row.appendChild(text);
  row.appendChild(select);
  root.appendChild(row);
  return select;
}

export function createSliderRow(
  root: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void,
): { input: HTMLInputElement; value: HTMLSpanElement } {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.gap = "4px";
  row.style.padding = "6px 0";

  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.alignItems = "center";
  top.style.justifyContent = "space-between";
  top.style.gap = "10px";

  const text = document.createElement("span");
  text.textContent = label;

  const value = document.createElement("span");

  const input = document.createElement("input");
  input.type = "range";
  input.min = `${min}`;
  input.max = `${max}`;
  input.step = `${step}`;
  input.addEventListener("input", () => {
    const parsed = Number.parseFloat(input.value);
    onChange(Number.isFinite(parsed) ? parsed : min);
  });

  top.appendChild(text);
  top.appendChild(value);
  row.appendChild(top);
  row.appendChild(input);
  root.appendChild(row);

  return { input, value };
}

export function createThreeColumnGrid(root: HTMLElement): HTMLElement {
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  grid.style.columnGap = "14px";
  grid.style.rowGap = "2px";
  root.appendChild(grid);
  return grid;
}

export function applyColumnMajorGridOrder(grid: HTMLElement, columns = 3): void {
  const childCount = grid.children.length;
  const rows = Math.max(1, Math.ceil(childCount / columns));
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, auto))`;
  grid.style.gridAutoFlow = "column";
}

export function createSubsectionGrid(root: HTMLElement, label: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "8px";
  const title = document.createElement("div");
  title.textContent = label;
  title.style.fontWeight = "700";
  title.style.margin = "0 0 4px 0";
  const grid = createThreeColumnGrid(wrap);
  wrap.appendChild(title);
  wrap.appendChild(grid);
  root.appendChild(wrap);
  return grid;
}
