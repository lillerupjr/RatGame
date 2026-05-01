import { BlurFilter, Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";
import { COLORS, TEXT_STYLES } from "../pixiTheme";
import type { SlotConfig } from "./ringSlotConfig";
import type { HandsMode } from "./handsState";

const FINGER_LABELS: Record<string, string> = {
  "LEFT:0": "L Pinky",
  "LEFT:1": "L Ring",
  "LEFT:2": "L Middle",
  "LEFT:3": "L Index",
  "RIGHT:0": "R Index",
  "RIGHT:1": "R Middle",
  "RIGHT:2": "R Ring",
  "RIGHT:3": "R Pinky",
};

export type RingSlotVisualState = {
  equipped: boolean;
  ringTexture: Texture | null;
  familyColor: number;
  isSelected: boolean;
  mode: HandsMode;
  ringName?: string | null;
  empowermentScalar?: number;
};

export class RingSlotView extends Container {
  readonly slotId: FingerSlotId;
  private config: SlotConfig;
  private diamondGfx: Graphics;
  private ringSprite: Sprite | null = null;
  private glowSprite: Sprite | null = null;
  private glowFilter: BlurFilter;
  private hitArea_: Graphics;
  private tooltip: Container;
  private _visualState: RingSlotVisualState;
  private _pulseTime = Math.random() * Math.PI * 2; // random phase offset
  private _hovered = false;

  onSlotClick: ((slotId: FingerSlotId) => void) | null = null;
  onSlotHover: ((slotId: FingerSlotId, hovered: boolean) => void) | null = null;
  private empowerGfx: Graphics | null = null;

  constructor(config: SlotConfig) {
    super();
    this.slotId = config.slotId;
    this.config = config;

    this._visualState = {
      equipped: false,
      ringTexture: null,
      familyColor: COLORS.goldDim,
      isSelected: false,
      mode: "browse",
    };

    // Blur filter for glow sprite (shared instance)
    this.glowFilter = new BlurFilter({ strength: 8, quality: 3 });

    // Diamond marker (replaces old emptyCircle)
    this.diamondGfx = new Graphics();
    this.addChild(this.diamondGfx);

    // Hit area
    this.hitArea_ = new Graphics();
    this.hitArea_.alpha = 0;
    const hr = config.hitRadius;
    this.hitArea_.circle(0, 0, hr).fill({ color: 0xffffff });
    this.addChild(this.hitArea_);

    // Tooltip
    this.tooltip = this.buildTooltip();
    this.tooltip.visible = false;
    this.addChild(this.tooltip);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointertap", () => {
      this.onSlotClick?.(this.slotId);
    });
    this.on("pointerover", () => {
      this._hovered = true;
      this.updateTooltip();
      this.tooltip.visible = true;
      this.onSlotHover?.(this.slotId, true);
    });
    this.on("pointerout", () => {
      this._hovered = false;
      this.tooltip.visible = false;
      this.onSlotHover?.(this.slotId, false);
    });

    this.drawDiamond("browse", false);
  }

  /** Position this slot on the hands sprite given the sprite's pixel dimensions. */
  positionOnHands(handsW: number, handsH: number): void {
    this.x = (this.config.xPct / 100) * handsW;
    this.y = (this.config.yPct / 100) * handsH;
    // Rotation applied only to ring sprite, not the whole container
    this.scale.set(this.config.scale);
  }

  updateConfig(config: SlotConfig): void {
    this.config = config;
  }

  setVisualState(vs: RingSlotVisualState): void {
    this._visualState = vs;
    if (vs.equipped && vs.ringTexture) {
      this.showEquipped(vs.ringTexture, vs.familyColor, vs.isSelected, vs.mode);
    } else {
      this.showEmpty(vs.mode);
    }
  }

  private showEquipped(tex: Texture, color: number, selected: boolean, mode: HandsMode): void {
    this.diamondGfx.visible = false;
    const empScalar = this._visualState.empowermentScalar ?? 0;

    // Glow sprite (blurred tinted copy behind ring) — create once, reuse
    if (!this.glowSprite) {
      this.glowSprite = new Sprite(tex);
      this.glowSprite.anchor.set(0.5);
      this.glowSprite.filters = [this.glowFilter];
      this.addChildAt(this.glowSprite, 0); // behind everything
    } else {
      this.glowSprite.texture = tex;
    }

    if (!this.ringSprite) {
      this.ringSprite = new Sprite(tex);
      this.ringSprite.anchor.set(0.5);
      this.addChildAt(this.ringSprite, 1); // after glow, before hitArea
    } else {
      this.ringSprite.texture = tex;
    }
    this.ringSprite.visible = true;

    // Apply per-finger rotation only to ring sprite and glow
    const rot = (this.config.rotationDeg * Math.PI) / 180;
    this.ringSprite.rotation = rot;
    this.glowSprite.rotation = rot;

    // Size depends on state + hover
    let size: number;
    if (selected) {
      size = 80;
    } else if (this._hovered) {
      size = 64;
    } else {
      size = 52;
    }
    this.ringSprite.width = size;
    this.ringSprite.height = size;

    // Empowerment multiplier: increases glow intensity and scale
    const empGlowMult = 1 + empScalar;

    // Glow: tinted blurred copy, larger than the ring
    if (selected || mode === "choose-slot") {
      const glowScale = 1.35 * empGlowMult;
      this.glowSprite.width = size * glowScale;
      this.glowSprite.height = size * glowScale;
      this.glowSprite.tint = color;
      this.glowSprite.alpha = Math.min(1, 0.8 * empGlowMult);
      this.glowFilter.strength = 8 + empScalar * 4;
      this.glowSprite.visible = true;
    } else if (this._hovered) {
      const glowScale = 1.15 * empGlowMult;
      this.glowSprite.width = size * glowScale;
      this.glowSprite.height = size * glowScale;
      this.glowSprite.tint = color;
      this.glowSprite.alpha = Math.min(1, 0.4 * empGlowMult);
      this.glowFilter.strength = 6 + empScalar * 3;
      this.glowSprite.visible = true;
    } else {
      // Subtle ambient glow — empowerment makes it more prominent
      const glowScale = (1.1 + empScalar * 0.15);
      this.glowSprite.width = size * glowScale;
      this.glowSprite.height = size * glowScale;
      this.glowSprite.tint = color;
      this.glowSprite.alpha = Math.min(1, 0.25 + empScalar * 0.2);
      this.glowFilter.strength = 4 + empScalar * 3;
      this.glowSprite.visible = true;
    }

    // Empowerment indicator: small diamond icon below the ring
    this.updateEmpowermentIndicator(empScalar);
  }

  private updateEmpowermentIndicator(scalar: number): void {
    if (scalar <= 0) {
      if (this.empowerGfx) this.empowerGfx.visible = false;
      return;
    }
    if (!this.empowerGfx) {
      this.empowerGfx = new Graphics();
      this.addChild(this.empowerGfx);
    }
    this.empowerGfx.clear();
    this.empowerGfx.visible = true;

    // Small empowerment pip(s) below the ring — one per 0.2 scalar
    const pips = Math.round(scalar / 0.2);
    const pipSize = 3;
    const pipGap = 7;
    const startX = -((pips - 1) * pipGap) / 2;
    for (let i = 0; i < pips; i++) {
      const px = startX + i * pipGap;
      this.empowerGfx.poly([px, 28, px + pipSize, 28 + pipSize, px, 28 + pipSize * 2, px - pipSize, 28 + pipSize])
        .fill({ color: COLORS.amber, alpha: 0.75 });
    }
  }

  private showEmpty(mode: HandsMode): void {
    if (this.ringSprite) this.ringSprite.visible = false;
    if (this.glowSprite) this.glowSprite.visible = false;
    if (this.empowerGfx) this.empowerGfx.visible = false;
    this.diamondGfx.visible = true;

    if (mode === "choose-slot") {
      this.drawDiamond("choose-slot", this._hovered);
    } else {
      this.drawDiamond("browse", this._hovered);
    }
  }

  private drawDiamond(mode: "browse" | "choose-slot", hovered: boolean): void {
    this.diamondGfx.clear();

    let color: number;
    let strokeOuter: number;
    let strokeInner: number;
    let dotAlpha: number;
    let fillAlpha: number;

    if (mode === "choose-slot") {
      color = COLORS.green;
      strokeOuter = 0.85;
      strokeInner = 0.35;
      dotAlpha = 0.9;
      fillAlpha = 0.08;
    } else if (hovered) {
      color = COLORS.gold;
      strokeOuter = 0.70;
      strokeInner = 0.18;
      dotAlpha = 0.5;
      fillAlpha = 0;
    } else {
      color = COLORS.gold;
      strokeOuter = 0.42;
      strokeInner = 0.18;
      dotAlpha = 0.5;
      fillAlpha = 0;
    }

    // Outer diamond
    this.diamondGfx.poly([0, -11, 11, 0, 0, 11, -11, 0]).stroke({ color, width: 1.2, alpha: strokeOuter });
    // Inner diamond
    this.diamondGfx.poly([0, -6.5, 6.5, 0, 0, 6.5, -6.5, 0]).stroke({ color, width: 0.8, alpha: strokeInner });
    // Center dot
    this.diamondGfx.circle(0, 0, 2.8).fill({ color, alpha: dotAlpha });
    // Fill for choose-slot mode
    if (fillAlpha > 0) {
      this.diamondGfx.poly([0, -11, 11, 0, 0, 11, -11, 0]).fill({ color, alpha: fillAlpha });
    }
  }

  private buildTooltip(): Container {
    const c = new Container();
    c.y = -(this.config.hitRadius + 22);

    const bg = new Graphics();
    c.addChild(bg);

    const labelStyle = TEXT_STYLES.slotLabel.clone();
    labelStyle.fill = COLORS.text;
    const label = new Text({ text: FINGER_LABELS[this.slotId] ?? this.slotId, style: labelStyle });
    label.anchor.set(0.5, 0);
    label.x = 0;
    label.y = 4;
    c.addChild(label);

    const padX = 8;
    const padY = 4;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    bg.roundRect(-w / 2, 0, w, h, 3).fill({ color: COLORS.bgPanel, alpha: 0.92 });
    bg.roundRect(-w / 2, 0, w, h, 3).stroke({ color: COLORS.border, width: 1, alpha: 0.5 });

    return c;
  }

  private updateTooltip(): void {
    const vs = this._visualState;
    const label = this.tooltip.getChildAt(1) as Text;
    const fingerLabel = FINGER_LABELS[this.slotId] ?? this.slotId;
    if (vs.equipped && vs.ringName) {
      label.text = `${fingerLabel} — ${vs.ringName}`;
    } else {
      label.text = `${fingerLabel} — Empty`;
    }

    // Rebuild bg to fit new text
    const bg = this.tooltip.getChildAt(0) as Graphics;
    bg.clear();
    const padX = 8;
    const padY = 4;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    bg.roundRect(-w / 2, 0, w, h, 3).fill({ color: COLORS.bgPanel, alpha: 0.92 });
    bg.roundRect(-w / 2, 0, w, h, 3).stroke({ color: COLORS.border, width: 1, alpha: 0.5 });
  }

  /** Call each frame for pulse/float animations. */
  tickAnimations(dtMs: number): void {
    this._pulseTime += dtMs * 0.003;
    const vs = this._visualState;

    if (!vs.equipped && vs.mode === "browse") {
      // Pulse empty diamond: alpha 0.38↔0.78
      this.diamondGfx.alpha = 0.38 + 0.40 * (0.5 + 0.5 * Math.sin(this._pulseTime));
    } else if (!vs.equipped && vs.mode === "choose-slot") {
      // Choose-slot pulse: scale 1.0↔1.22 + alpha
      const t = 0.5 + 0.5 * Math.sin(this._pulseTime * 1.2);
      this.diamondGfx.scale.set(1 + 0.22 * t);
      this.diamondGfx.alpha = 0.75 + 0.25 * t;
    } else if (vs.equipped && vs.isSelected && this.ringSprite) {
      // Selected ring float: Y +/- 4px
      this.ringSprite.y = 4 * Math.sin(this._pulseTime * 0.8);
    } else if (this.ringSprite) {
      this.ringSprite.y = 0;
    }

    // Re-draw diamond state when hovered changes (handled per-frame for simplicity)
    if (!vs.equipped) {
      const mode = vs.mode === "choose-slot" ? "choose-slot" : "browse";
      // Only redraw on hover change — check via a simple flag
      this.drawDiamond(mode, this._hovered);
    } else if (this.ringSprite) {
      // Update ring size on hover
      let size: number;
      if (vs.isSelected) {
        size = 80;
      } else if (this._hovered) {
        size = 64;
      } else {
        size = 52;
      }
      this.ringSprite.width = size;
      this.ringSprite.height = size;
    }
  }
}
