// DEV-only slot position / rotation tuning overlay for the hands screen.
// Activated by Shift+D while hands screen is open.
// Slots can be repositioned by dragging them directly on the hands sprite.

import { Container, Graphics, Text, FederatedPointerEvent } from "pixi.js";
import {
  getSlotConfigs,
  updateSlotConfig,
  resetSlotConfigs,
  exportSlotConfigsJSON,
  type SlotConfig,
} from "./ringSlotConfig";
import type { RingSlotView } from "./ringSlot";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";

// ── Injected stylesheet ─────────────────────────────────────────────────────
const STYLE_ID = "__slotTunerStyle";

const TUNER_CSS = `
  .slt-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:290px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(12,20,35,.88);color:#d0e8f0;
    -webkit-backdrop-filter:blur(24px) saturate(140%);backdrop-filter:blur(24px) saturate(140%);
    border:.5px solid rgba(118,232,255,.18);border-radius:12px;
    box-shadow:0 1px 0 rgba(118,232,255,.08) inset,0 12px 40px rgba(0,0,0,.45);
    font:11px/1.4 'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden}

  .slt-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 10px 10px 14px;cursor:move;user-select:none;
    border-bottom:.5px solid rgba(118,232,255,.12)}
  .slt-hd b{font-size:11px;font-weight:600;letter-spacing:.08em;color:#76e8ff}
  .slt-hd-sub{font-size:9px;color:rgba(190,226,235,.45);letter-spacing:.04em;margin-left:8px}
  .slt-x{appearance:none;border:0;background:transparent;color:rgba(118,232,255,.4);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .slt-x:hover{background:rgba(118,232,255,.1);color:#76e8ff}

  .slt-body{padding:4px 12px 12px;display:flex;flex-direction:column;gap:2px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(118,232,255,.15) transparent}
  .slt-body::-webkit-scrollbar{width:6px}
  .slt-body::-webkit-scrollbar-track{background:transparent}
  .slt-body::-webkit-scrollbar-thumb{background:rgba(118,232,255,.15);border-radius:3px}
  .slt-body::-webkit-scrollbar-thumb:hover{background:rgba(118,232,255,.28)}

  .slt-sect{cursor:pointer;user-select:none;display:flex;align-items:center;
    justify-content:space-between;padding:8px 0 4px;
    border-bottom:.5px solid rgba(118,232,255,.08)}
  .slt-sect-label{font-size:10px;font-weight:600;letter-spacing:.06em;
    text-transform:uppercase;color:rgba(118,232,255,.7)}
  .slt-sect-arrow{font-size:8px;color:rgba(118,232,255,.35);transition:transform .15s}
  .slt-sect-arrow.open{transform:rotate(90deg)}
  .slt-sect-body{overflow:hidden;display:flex;flex-direction:column;gap:3px;padding:6px 0 4px}
  .slt-sect-body.collapsed{display:none}

  .slt-row{display:flex;align-items:center;gap:6px;height:22px}
  .slt-row-lbl{width:28px;flex-shrink:0;font-size:9px;font-weight:500;
    color:rgba(190,226,235,.5);letter-spacing:.04em;text-transform:uppercase}
  .slt-row-val{width:42px;flex-shrink:0;text-align:right;font-size:10px;
    font-variant-numeric:tabular-nums;color:rgba(190,226,235,.7)}

  .slt-slider{appearance:none;-webkit-appearance:none;flex:1;height:3px;
    border-radius:999px;background:rgba(118,232,255,.12);outline:none;margin:0}
  .slt-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:12px;height:12px;border-radius:50%;background:#76e8ff;
    border:none;box-shadow:0 0 6px rgba(118,232,255,.4);cursor:default}
  .slt-slider::-moz-range-thumb{width:12px;height:12px;border-radius:50%;
    background:#76e8ff;border:none;box-shadow:0 0 6px rgba(118,232,255,.4);cursor:default}
  .slt-slider::-webkit-slider-thumb:hover{box-shadow:0 0 10px rgba(118,232,255,.6)}

  .slt-actions{display:flex;gap:6px;padding:8px 0 0;border-top:.5px solid rgba(118,232,255,.1)}
  .slt-btn{appearance:none;flex:1;height:26px;border:0;border-radius:6px;
    font:inherit;font-size:10px;font-weight:600;letter-spacing:.04em;cursor:default;
    text-transform:uppercase}
  .slt-btn-primary{background:rgba(118,232,255,.15);color:#76e8ff}
  .slt-btn-primary:hover{background:rgba(118,232,255,.22)}
  .slt-btn-secondary{background:rgba(255,255,255,.05);color:rgba(190,226,235,.6)}
  .slt-btn-secondary:hover{background:rgba(255,255,255,.08);color:rgba(190,226,235,.8)}
  .slt-btn-danger{background:rgba(255,80,80,.12);color:rgba(255,130,130,.8)}
  .slt-btn-danger:hover{background:rgba(255,80,80,.18)}

  .slt-toast{position:fixed;bottom:60px;right:16px;z-index:2147483647;
    padding:6px 14px;border-radius:8px;font:11px/1.4 'IBM Plex Mono',monospace;
    background:rgba(118,232,255,.15);color:#76e8ff;
    backdrop-filter:blur(12px);pointer-events:none;
    animation:slt-fade .8s ease-out forwards}
  @keyframes slt-fade{0%{opacity:1;transform:translateY(0)}
    70%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}

  .slt-hint{font-size:9px;color:rgba(190,226,235,.35);text-align:center;
    padding:4px 0 2px;letter-spacing:.02em}
`;

const FINGER_NAMES: Record<string, string> = {
  "LEFT:0": "L Pinky",
  "LEFT:1": "L Ring",
  "LEFT:2": "L Middle",
  "LEFT:3": "L Index",
  "RIGHT:0": "R Index",
  "RIGHT:1": "R Middle",
  "RIGHT:2": "R Ring",
  "RIGHT:3": "R Pinky",
};

type SliderRefs = {
  xSlider: HTMLInputElement;
  xVal: HTMLSpanElement;
  ySlider: HTMLInputElement;
  yVal: HTMLSpanElement;
};

export class DebugSlotTuner extends Container {
  private overlayGfx: Map<FingerSlotId, Graphics> = new Map();
  private overlayLabels: Map<FingerSlotId, Text> = new Map();
  private dragHandles: Map<FingerSlotId, Graphics> = new Map();
  private domPanel: HTMLDivElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private _active = false;
  private slotViews: RingSlotView[];
  private handsW = 0;
  private handsH = 0;
  private panelDragOffset = { x: 16, y: 16 };
  private collapsedSlots: Set<string> = new Set();

  // References to DOM slider inputs so we can sync them during canvas drag
  private sliderRefs: Map<FingerSlotId, SliderRefs> = new Map();

  // Currently dragged slot (null if not dragging)
  private draggingSlot: FingerSlotId | null = null;

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
    this.injectStyle();
    this.createDomPanel();
  }

  deactivate(): void {
    this._active = false;
    this.visible = false;
    this.draggingSlot = null;
    this.removeDomPanel();
  }

  updateDimensions(handsW: number, handsH: number): void {
    this.handsW = handsW;
    this.handsH = handsH;
    if (this._active) this.rebuild();
  }

  // ── Pixi overlay with drag handles ────────────────────────────────────────

  private rebuild(): void {
    this.removeChildren();
    this.overlayGfx.clear();
    this.overlayLabels.clear();
    this.dragHandles.clear();

    for (const config of getSlotConfigs()) {
      const x = (config.xPct / 100) * this.handsW;
      const y = (config.yPct / 100) * this.handsH;

      // Visual overlay (non-interactive): circle + rotation line
      const gfx = new Graphics();
      this.drawSlotOverlay(gfx, x, y, config);
      this.addChild(gfx);
      this.overlayGfx.set(config.slotId, gfx);

      // Label
      const label = new Text({
        text: this.formatLabel(config),
        style: {
          fontSize: 9,
          fill: 0x76e8ff,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: 0.3,
        },
      });
      label.x = x + config.hitRadius + 4;
      label.y = y - 8;
      label.alpha = 0.7;
      this.addChild(label);
      this.overlayLabels.set(config.slotId, label);

      // Drag handle: invisible larger circle for grabbing
      const handle = new Graphics();
      handle.circle(0, 0, Math.max(config.hitRadius, 14));
      handle.fill({ color: 0xffffff, alpha: 0.001 }); // near-invisible but hittable
      handle.x = x;
      handle.y = y;
      handle.eventMode = "static";
      handle.cursor = "grab";

      handle.on("pointerdown", (e: FederatedPointerEvent) => {
        this.onHandleDragStart(config.slotId, e);
      });

      this.addChild(handle);
      this.dragHandles.set(config.slotId, handle);
    }

    // Global move/up listeners on the tuner container
    this.eventMode = "static";
  }

  private drawSlotOverlay(gfx: Graphics, x: number, y: number, config: SlotConfig): void {
    const isDragging = this.draggingSlot === config.slotId;
    const circleAlpha = isDragging ? 0.7 : 0.35;
    const lineAlpha = isDragging ? 0.8 : 0.5;
    const circleColor = isDragging ? 0x4ade80 : 0x76e8ff;

    gfx.clear();
    gfx.circle(x, y, config.hitRadius)
      .stroke({ color: circleColor, width: isDragging ? 1.5 : 1, alpha: circleAlpha });

    // Rotation indicator line
    const rad = (config.rotationDeg * Math.PI) / 180;
    const lx = x + Math.sin(rad) * config.hitRadius;
    const ly = y - Math.cos(rad) * config.hitRadius;
    gfx.moveTo(x, y).lineTo(lx, ly)
      .stroke({ color: circleColor, width: 1, alpha: lineAlpha });

    // Center crosshair when dragging
    if (isDragging) {
      const ch = 4;
      gfx.moveTo(x - ch, y).lineTo(x + ch, y)
        .stroke({ color: circleColor, width: 1, alpha: 0.5 });
      gfx.moveTo(x, y - ch).lineTo(x, y + ch)
        .stroke({ color: circleColor, width: 1, alpha: 0.5 });
    }
  }

  private formatLabel(config: SlotConfig): string {
    const name = FINGER_NAMES[config.slotId] ?? config.slotId;
    return `${name}\n${config.xPct.toFixed(1)}, ${config.yPct.toFixed(1)}  ${config.rotationDeg}°`;
  }

  // ── Canvas drag ───────────────────────────────────────────────────────────

  private onHandleDragStart(slotId: FingerSlotId, e: FederatedPointerEvent): void {
    this.draggingSlot = slotId;
    e.stopPropagation();

    const handle = this.dragHandles.get(slotId);
    if (handle) handle.cursor = "grabbing";

    // Highlight the dragged overlay
    this.redrawOverlayForSlot(slotId);

    // Walk up to screenRoot (the topmost interactive container) for global drag capture
    let stage: Container | null = this.parent;
    while (stage?.parent && stage.parent.parent) stage = stage.parent;
    if (!stage) return;

    const onMove = (ev: FederatedPointerEvent) => {
      if (this.draggingSlot !== slotId) return;

      // Convert global position to local (within tuner/hands sprite space)
      const local = this.toLocal(ev.global);
      const newXPct = Math.max(0, Math.min(100, (local.x / this.handsW) * 100));
      const newYPct = Math.max(0, Math.min(100, (local.y / this.handsH) * 100));

      // Snap to 0.5% grid
      const snappedX = Math.round(newXPct * 2) / 2;
      const snappedY = Math.round(newYPct * 2) / 2;

      updateSlotConfig(slotId, { xPct: snappedX, yPct: snappedY });

      // Update the slot view in real time
      const sv = this.slotViews.find((s) => s.slotId === slotId);
      const cfg = getSlotConfigs().find((c) => c.slotId === slotId);
      if (sv && cfg) {
        sv.updateConfig(cfg);
        sv.positionOnHands(this.handsW, this.handsH);
      }

      // Update the drag handle position
      if (handle) {
        handle.x = (snappedX / 100) * this.handsW;
        handle.y = (snappedY / 100) * this.handsH;
      }

      // Redraw this slot's overlay + label without full rebuild
      this.updateOverlayForSlot(slotId, snappedX, snappedY);

      // Sync DOM sliders
      this.syncDomSliders(slotId, snappedX, snappedY);
    };

    const onUp = () => {
      this.draggingSlot = null;
      if (handle) handle.cursor = "grab";
      stage.off("pointermove", onMove);
      stage.off("pointerup", onUp);
      stage.off("pointerupoutside", onUp);
      // Full rebuild to clean up visuals
      this.rebuild();
    };

    stage.eventMode = "static";
    stage.on("pointermove", onMove);
    stage.on("pointerup", onUp);
    stage.on("pointerupoutside", onUp);
  }

  private updateOverlayForSlot(slotId: FingerSlotId, xPct: number, yPct: number): void {
    const config = getSlotConfigs().find((c) => c.slotId === slotId);
    if (!config) return;

    const x = (xPct / 100) * this.handsW;
    const y = (yPct / 100) * this.handsH;

    const gfx = this.overlayGfx.get(slotId);
    if (gfx) this.drawSlotOverlay(gfx, x, y, config);

    const label = this.overlayLabels.get(slotId);
    if (label) {
      label.text = this.formatLabel(config);
      label.x = x + config.hitRadius + 4;
      label.y = y - 8;
    }
  }

  private redrawOverlayForSlot(slotId: FingerSlotId): void {
    const config = getSlotConfigs().find((c) => c.slotId === slotId);
    if (!config) return;
    const x = (config.xPct / 100) * this.handsW;
    const y = (config.yPct / 100) * this.handsH;
    const gfx = this.overlayGfx.get(slotId);
    if (gfx) this.drawSlotOverlay(gfx, x, y, config);
  }

  private syncDomSliders(slotId: FingerSlotId, xPct: number, yPct: number): void {
    const refs = this.sliderRefs.get(slotId);
    if (!refs) return;
    refs.xSlider.value = String(xPct);
    refs.xVal.textContent = xPct.toFixed(1) + "%";
    refs.ySlider.value = String(yPct);
    refs.yVal.textContent = yPct.toFixed(1) + "%";
  }

  // ── Style injection ───────────────────────────────────────────────────────

  private injectStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = TUNER_CSS;
    document.head.appendChild(el);
    this.styleEl = el;
  }

  // ── DOM panel ─────────────────────────────────────────────────────────────

  private createDomPanel(): void {
    this.removeDomPanel();
    this.sliderRefs.clear();

    const panel = document.createElement("div");
    panel.className = "slt-panel";
    panel.style.right = this.panelDragOffset.x + "px";
    panel.style.bottom = this.panelDragOffset.y + "px";

    // ── Header ──
    const hd = document.createElement("div");
    hd.className = "slt-hd";
    hd.innerHTML = `<div><b>SLOT TUNER</b><span class="slt-hd-sub">Shift+D to close</span></div>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "slt-x";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", () => this.deactivate());
    hd.appendChild(closeBtn);
    this.setupPanelDrag(hd, panel);
    panel.appendChild(hd);

    // ── Body ──
    const body = document.createElement("div");
    body.className = "slt-body";

    // Hint
    const hint = document.createElement("div");
    hint.className = "slt-hint";
    hint.textContent = "Drag slots directly on the hands to reposition";
    body.appendChild(hint);

    for (const config of getSlotConfigs()) {
      body.appendChild(this.buildSlotSection(config));
    }

    // ── Actions ──
    const actions = document.createElement("div");
    actions.className = "slt-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "slt-btn slt-btn-primary";
    copyBtn.textContent = "COPY JSON";
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(exportSlotConfigsJSON()).then(() => {
        this.showToast("Copied to clipboard");
      });
    });
    actions.appendChild(copyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "slt-btn slt-btn-danger";
    resetBtn.textContent = "RESET";
    resetBtn.addEventListener("click", () => {
      resetSlotConfigs();
      for (const sv of this.slotViews) {
        const cfg = getSlotConfigs().find((c) => c.slotId === sv.slotId);
        if (cfg) {
          sv.updateConfig(cfg);
          sv.positionOnHands(this.handsW, this.handsH);
        }
      }
      this.rebuild();
      this.removeDomPanel();
      this.createDomPanel();
      this.showToast("Reset to defaults");
    });
    actions.appendChild(resetBtn);

    body.appendChild(actions);
    panel.appendChild(body);

    document.body.appendChild(panel);
    this.domPanel = panel;
  }

  private buildSlotSection(config: SlotConfig): HTMLElement {
    const wrapper = document.createElement("div");
    const fingerName = FINGER_NAMES[config.slotId] ?? config.slotId;

    // Section header (collapsible)
    const header = document.createElement("div");
    header.className = "slt-sect";

    const label = document.createElement("span");
    label.className = "slt-sect-label";
    label.textContent = fingerName;
    header.appendChild(label);

    const arrow = document.createElement("span");
    arrow.className = "slt-sect-arrow";
    arrow.textContent = "\u25B6";
    if (!this.collapsedSlots.has(config.slotId)) arrow.classList.add("open");
    header.appendChild(arrow);

    // Section body
    const sectionBody = document.createElement("div");
    sectionBody.className = "slt-sect-body";
    if (this.collapsedSlots.has(config.slotId)) sectionBody.classList.add("collapsed");

    header.addEventListener("click", () => {
      const isCollapsed = sectionBody.classList.toggle("collapsed");
      arrow.classList.toggle("open", !isCollapsed);
      if (isCollapsed) {
        this.collapsedSlots.add(config.slotId);
      } else {
        this.collapsedSlots.delete(config.slotId);
      }
    });

    // X slider
    const [xRow, xSlider, xVal] = this.buildSliderRow("X", config.xPct, 0, 100, 0.5, "%", (v) => {
      updateSlotConfig(config.slotId, { xPct: v });
      this.syncSlotView(config.slotId);
    });
    sectionBody.appendChild(xRow);

    // Y slider
    const [yRow, ySlider, yVal] = this.buildSliderRow("Y", config.yPct, 0, 100, 0.5, "%", (v) => {
      updateSlotConfig(config.slotId, { yPct: v });
      this.syncSlotView(config.slotId);
    });
    sectionBody.appendChild(yRow);

    // Store refs for syncing during canvas drag
    this.sliderRefs.set(config.slotId, { xSlider, xVal, ySlider, yVal });

    sectionBody.appendChild(
      this.buildSliderRow("ROT", config.rotationDeg, -90, 90, 1, "\u00B0", (v) => {
        updateSlotConfig(config.slotId, { rotationDeg: v });
        this.syncSlotView(config.slotId);
      })[0],
    );
    sectionBody.appendChild(
      this.buildSliderRow("SCL", config.scale, 0.3, 2, 0.05, "x", (v) => {
        updateSlotConfig(config.slotId, { scale: v });
        this.syncSlotView(config.slotId);
      })[0],
    );
    sectionBody.appendChild(
      this.buildSliderRow("HIT", config.hitRadius, 5, 40, 1, "px", (v) => {
        updateSlotConfig(config.slotId, { hitRadius: v });
        this.syncSlotView(config.slotId);
      })[0],
    );

    wrapper.appendChild(header);
    wrapper.appendChild(sectionBody);
    return wrapper;
  }

  private buildSliderRow(
    label: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (value: number) => void,
  ): [HTMLElement, HTMLInputElement, HTMLSpanElement] {
    const row = document.createElement("div");
    row.className = "slt-row";

    const lbl = document.createElement("span");
    lbl.className = "slt-row-lbl";
    lbl.textContent = label;
    row.appendChild(lbl);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "slt-slider";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initialValue);
    row.appendChild(slider);

    const decimals = (String(step).split(".")[1] || "").length;
    const valSpan = document.createElement("span");
    valSpan.className = "slt-row-val";
    valSpan.textContent = initialValue.toFixed(decimals) + unit;
    row.appendChild(valSpan);

    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      valSpan.textContent = v.toFixed(decimals) + unit;
      onChange(v);
    });

    return [row, slider, valSpan];
  }

  // ── Panel drag ────────────────────────────────────────────────────────────

  private setupPanelDrag(handle: HTMLElement, panel: HTMLElement): void {
    handle.addEventListener("mousedown", (e) => {
      const r = panel.getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      const startRight = window.innerWidth - r.right;
      const startBottom = window.innerHeight - r.bottom;

      const move = (ev: MouseEvent) => {
        this.panelDragOffset.x = Math.max(0, startRight - (ev.clientX - sx));
        this.panelDragOffset.y = Math.max(0, startBottom - (ev.clientY - sy));
        panel.style.right = this.panelDragOffset.x + "px";
        panel.style.bottom = this.panelDragOffset.y + "px";
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });
  }

  // ── Sync & helpers ────────────────────────────────────────────────────────

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

  private showToast(msg: string): void {
    const toast = document.createElement("div");
    toast.className = "slt-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 900);
  }

  private removeDomPanel(): void {
    if (this.domPanel) {
      this.domPanel.remove();
      this.domPanel = null;
    }
    this.sliderRefs.clear();
  }

  destroy(): void {
    this.removeDomPanel();
    this.styleEl?.remove();
    super.destroy({ children: true });
  }
}
