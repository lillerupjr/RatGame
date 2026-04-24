import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";
import { COLORS } from "../pixiTheme";
import type { SlotConfig } from "./ringSlotConfig";
import type { HandsMode } from "./handsState";

export type RingSlotVisualState = {
  equipped: boolean;
  ringTexture: Texture | null;
  familyColor: number;
  isSelected: boolean;
  mode: HandsMode;
};

export class RingSlotView extends Container {
  readonly slotId: FingerSlotId;
  private config: SlotConfig;
  private emptyCircle: Graphics;
  private ringSprite: Sprite | null = null;
  private glowGfx: Graphics;
  private hitArea_: Graphics;
  private _visualState: RingSlotVisualState;
  private _pulseTime = Math.random() * Math.PI * 2; // random phase offset

  onSlotClick: ((slotId: FingerSlotId) => void) | null = null;

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

    // Glow behind ring
    this.glowGfx = new Graphics();
    this.glowGfx.alpha = 0;
    this.addChild(this.glowGfx);

    // Empty slot circle
    this.emptyCircle = new Graphics();
    this.addChild(this.emptyCircle);

    // Hit area
    this.hitArea_ = new Graphics();
    this.hitArea_.alpha = 0;
    const hr = config.hitRadius;
    this.hitArea_.circle(0, 0, hr).fill({ color: 0xffffff });
    this.addChild(this.hitArea_);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointertap", () => {
      this.onSlotClick?.(this.slotId);
    });

    this.drawEmpty();
  }

  /** Position this slot on the hands sprite given the sprite's pixel dimensions. */
  positionOnHands(handsW: number, handsH: number): void {
    this.x = (this.config.xPct / 100) * handsW;
    this.y = (this.config.yPct / 100) * handsH;
    this.rotation = (this.config.rotationDeg * Math.PI) / 180;
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
    this.emptyCircle.visible = false;

    if (!this.ringSprite) {
      this.ringSprite = new Sprite(tex);
      this.ringSprite.anchor.set(0.5);
      this.addChildAt(this.ringSprite, 1); // after glow, before hitArea
    } else {
      this.ringSprite.texture = tex;
    }
    this.ringSprite.visible = true;

    const size = selected ? 42 : 30;
    this.ringSprite.width = size;
    this.ringSprite.height = size;

    // Glow
    this.glowGfx.clear();
    if (selected || mode === "choose-slot") {
      const gr = size * 0.7;
      this.glowGfx.circle(0, 0, gr).fill({ color, alpha: 0.3 });
      this.glowGfx.alpha = 1;
    } else {
      this.glowGfx.alpha = 0;
    }
  }

  private showEmpty(mode: HandsMode): void {
    if (this.ringSprite) this.ringSprite.visible = false;
    this.glowGfx.alpha = 0;
    this.emptyCircle.visible = true;
    this.drawEmpty();

    if (mode === "choose-slot") {
      this.drawChooseEmpty();
    }
  }

  private drawEmpty(): void {
    this.emptyCircle.clear();
    this.emptyCircle
      .circle(0, 0, 7)
      .stroke({ color: COLORS.goldDim, width: 1.5, alpha: 0.6 });
  }

  private drawChooseEmpty(): void {
    this.emptyCircle.clear();
    this.emptyCircle
      .circle(0, 0, 10)
      .stroke({ color: COLORS.green, width: 1.5, alpha: 0.85 });
  }

  /** Call each frame for pulse/float animations. */
  tickAnimations(dtMs: number): void {
    this._pulseTime += dtMs * 0.003;
    const vs = this._visualState;

    if (!vs.equipped && vs.mode === "browse") {
      // Pulse empty: alpha 0.4↔0.85
      this.emptyCircle.alpha = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(this._pulseTime));
    } else if (!vs.equipped && vs.mode === "choose-slot") {
      // Choose-slot pulse: scale 1.0↔1.2 + alpha
      const t = 0.5 + 0.5 * Math.sin(this._pulseTime * 1.2);
      this.emptyCircle.scale.set(1 + 0.2 * t);
      this.emptyCircle.alpha = 0.75 + 0.25 * t;
    } else if (vs.equipped && vs.isSelected && this.ringSprite) {
      // Selected ring float: Y +/- 4px
      this.ringSprite.y = 4 * Math.sin(this._pulseTime * 0.8);
    } else if (this.ringSprite) {
      this.ringSprite.y = 0;
    }
  }
}
