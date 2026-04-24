// DEV-only slot position tuning overlay for the hands screen.
// Activated by Shift+D while hands screen is open.

import { Container, Graphics, Text } from "pixi.js";
import { COLORS, TEXT_STYLES } from "../pixiTheme";
import {
  getSlotConfigs,
  updateSlotConfig,
  exportSlotConfigsJSON,
  type SlotConfig,
} from "./ringSlotConfig";
import type { RingSlotView } from "./ringSlot";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";

export class DebugSlotTuner extends Container {
  private overlayCircles: Map<FingerSlotId, Graphics> = new Map();
  private overlayLabels: Map<FingerSlotId, Text> = new Map();
  private domPanel: HTMLDivElement | null = null;
  private _active = false;
  private slotViews: RingSlotView[];
  private handsW = 0;
  private handsH = 0;

  constructor(slotViews: RingSlotView[]) {
    super();
    this.slotViews = slotViews;
    this.visible = false;
  }

  get active(): boolean {
    return this._active;
  }

  toggle(): void {
    if (this._active) this.deactivate();
    else this.activate();
  }

  activate(): void {
    if (!import.meta.env.DEV) return;
    this._active = true;
    this.visible = true;
    this.rebuild();
    this.createDomPanel();
  }

  deactivate(): void {
    this._active = false;
    this.visible = false;
    this.removeDomPanel();
  }

  updateDimensions(handsW: number, handsH: number): void {
    this.handsW = handsW;
    this.handsH = handsH;
    if (this._active) this.rebuild();
  }

  private rebuild(): void {
    this.removeChildren();
    this.overlayCircles.clear();
    this.overlayLabels.clear();

    for (const config of getSlotConfigs()) {
      const x = (config.xPct / 100) * this.handsW;
      const y = (config.yPct / 100) * this.handsH;

      // Hit radius circle
      const circle = new Graphics();
      circle
        .circle(x, y, config.hitRadius)
        .stroke({ color: 0x00ff00, width: 1, alpha: 0.5 });
      this.addChild(circle);
      this.overlayCircles.set(config.slotId, circle);

      // Label
      const label = new Text({
        text: `${config.slotId}\n(${config.xPct.toFixed(1)}, ${config.yPct.toFixed(1)})`,
        style: {
          fontSize: 9,
          fill: 0x00ff00,
          fontFamily: "monospace",
        },
      });
      label.x = x + config.hitRadius + 4;
      label.y = y - 8;
      this.addChild(label);
      this.overlayLabels.set(config.slotId, label);
    }
  }

  private createDomPanel(): void {
    this.removeDomPanel();
    const panel = document.createElement("div");
    panel.id = "debugSlotTuner";
    panel.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 200;
      background: rgba(0,0,0,0.9); border: 1px solid #333; border-radius: 6px;
      padding: 12px; font-family: monospace; font-size: 11px; color: #0f0;
      max-height: 80vh; overflow-y: auto; width: 280px;
    `;

    const title = document.createElement("div");
    title.textContent = "Slot Tuner (Shift+D to close)";
    title.style.marginBottom = "10px";
    title.style.fontWeight = "bold";
    panel.appendChild(title);

    for (const config of getSlotConfigs()) {
      const row = document.createElement("div");
      row.style.marginBottom = "8px";
      row.style.borderBottom = "1px solid #222";
      row.style.paddingBottom = "6px";

      const label = document.createElement("div");
      label.textContent = config.slotId;
      label.style.fontWeight = "bold";
      label.style.marginBottom = "4px";
      row.appendChild(label);

      row.appendChild(this.createSlider("x%", config.xPct, 0, 100, 0.5, (v) => {
        updateSlotConfig(config.slotId, { xPct: v });
        this.syncSlotView(config.slotId);
      }));
      row.appendChild(this.createSlider("y%", config.yPct, 0, 100, 0.5, (v) => {
        updateSlotConfig(config.slotId, { yPct: v });
        this.syncSlotView(config.slotId);
      }));
      row.appendChild(this.createSlider("rot", config.rotationDeg, -180, 180, 5, (v) => {
        updateSlotConfig(config.slotId, { rotationDeg: v });
        this.syncSlotView(config.slotId);
      }));
      row.appendChild(this.createSlider("scale", config.scale, 0.3, 2, 0.05, (v) => {
        updateSlotConfig(config.slotId, { scale: v });
        this.syncSlotView(config.slotId);
      }));
      row.appendChild(this.createSlider("hit", config.hitRadius, 5, 40, 1, (v) => {
        updateSlotConfig(config.slotId, { hitRadius: v });
        this.syncSlotView(config.slotId);
      }));

      panel.appendChild(row);
    }

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy All (JSON)";
    copyBtn.style.cssText = `
      margin-top: 8px; padding: 6px 12px; background: #222; color: #0f0;
      border: 1px solid #0f0; border-radius: 3px; cursor: pointer; font-family: monospace;
    `;
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(exportSlotConfigsJSON()).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy All (JSON)"; }, 1500);
      });
    });
    panel.appendChild(copyBtn);

    document.body.appendChild(panel);
    this.domPanel = panel;
  }

  private createSlider(
    label: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.marginBottom = "2px";

    const lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.style.width = "35px";
    row.appendChild(lbl);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initialValue);
    slider.style.flex = "1";
    row.appendChild(slider);

    const valSpan = document.createElement("span");
    valSpan.textContent = initialValue.toFixed(1);
    valSpan.style.width = "40px";
    valSpan.style.textAlign = "right";
    row.appendChild(valSpan);

    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      valSpan.textContent = v.toFixed(1);
      onChange(v);
    });

    return row;
  }

  private syncSlotView(slotId: FingerSlotId): void {
    const config = getSlotConfigs().find((c) => c.slotId === slotId);
    if (!config) return;
    const sv = this.slotViews.find((s) => s.slotId === slotId);
    if (sv) {
      sv.updateConfig(config);
      sv.positionOnHands(this.handsW, this.handsH);
    }
    this.rebuild();
  }

  private removeDomPanel(): void {
    if (this.domPanel) {
      this.domPanel.remove();
      this.domPanel = null;
    }
  }

  destroy(): void {
    this.removeDomPanel();
    super.destroy({ children: true });
  }
}
