import { Container, Graphics, Text } from "pixi.js";
import { Panel } from "../primitives/Panel";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, SPACING, TEXT_STYLES } from "../pixiTheme";
import type { HandsMode } from "./handsState";

export type DrawerContent = {
  ringName: string;
  familyId: string;
  description: string;
  statMods: string[];
  mode: HandsMode;
} | null;

export class DetailDrawer extends Container {
  private panel: Panel;
  private contentContainer: Container;
  private maskGfx: Graphics;
  private width_: number;
  private maxHeight: number;

  constructor(width: number, maxHeight: number) {
    super();
    this.width_ = width;
    this.maxHeight = maxHeight;

    this.panel = new Panel({
      width,
      height: maxHeight,
      fill: COLORS.bgPanel,
      borderColor: COLORS.border,
      borderWidth: 1,
      radius: 0,
    });
    this.addChild(this.panel);

    this.contentContainer = new Container();
    this.contentContainer.x = SPACING.xxl;
    this.contentContainer.y = SPACING.xl;
    this.addChild(this.contentContainer);

    // Mask for clip content during open/close
    this.maskGfx = new Graphics();
    this.maskGfx.rect(0, 0, width, maxHeight).fill({ color: 0xffffff });
    this.addChild(this.maskGfx);
    this.mask = this.maskGfx;
  }

  resize(width: number, maxHeight: number): void {
    this.width_ = width;
    this.maxHeight = maxHeight;
    this.panel.resize(width, maxHeight);
    this.maskGfx.clear();
    this.maskGfx.rect(0, 0, width, maxHeight).fill({ color: 0xffffff });
  }

  /** Set the visible height of the drawer (0 = closed, maxHeight = open). */
  setDrawerHeight(h: number): void {
    this.maskGfx.clear();
    this.maskGfx.rect(0, 0, this.width_, h).fill({ color: 0xffffff });
  }

  update(content: DrawerContent): void {
    this.contentContainer.removeChildren();
    if (!content) return;

    const contentW = this.width_ - SPACING.xxl * 2;
    let yPos = 0;

    // Top accent line
    const accent = new Graphics();
    accent.rect(-SPACING.xxl, -SPACING.xl, this.width_, 1).fill({
      color: content.mode === "choose-slot" ? COLORS.green : COLORS.gold,
      alpha: 0.6,
    });
    this.contentContainer.addChild(accent);

    // Ring name
    const nameText = createTextLabel(content.ringName, "ringName");
    nameText.y = yPos;
    this.contentContainer.addChild(nameText);

    // Family tag
    const familyTag = new Text({
      text: content.familyId.toUpperCase(),
      style: { ...TEXT_STYLES.ringFamily, fill: COLORS.gold },
    });
    familyTag.x = nameText.width + 12;
    familyTag.y = yPos + 5;

    const tagBorder = new Graphics();
    tagBorder
      .roundRect(familyTag.x - 4, yPos + 2, familyTag.width + 8, 18, 2)
      .stroke({ color: COLORS.gold, alpha: 0.3, width: 1 });
    this.contentContainer.addChild(tagBorder);
    this.contentContainer.addChild(familyTag);
    yPos += 28;

    // Description
    if (content.description) {
      const desc = new Text({
        text: content.description,
        style: {
          ...TEXT_STYLES.muted,
          fontStyle: "italic",
          wordWrap: true,
          wordWrapWidth: contentW,
        },
      });
      desc.y = yPos;
      this.contentContainer.addChild(desc);
      yPos += desc.height + 8;
    }

    // Stat mods
    for (const mod of content.statMods) {
      const modText = createTextLabel(mod, "drawerStat");
      modText.y = yPos;
      this.contentContainer.addChild(modText);
      yPos += 20;
    }
    yPos += 4;

    // Action text
    if (content.mode === "choose-slot") {
      const dot = new Graphics();
      dot.circle(3, yPos + 6, 3).fill({ color: COLORS.green });
      dot.circle(3, yPos + 6, 5).fill({ color: COLORS.green, alpha: 0.2 });
      this.contentContainer.addChild(dot);

      const actionText = new Text({
        text: "Choose a finger to equip",
        style: { ...TEXT_STYLES.accent, fill: COLORS.green },
      });
      actionText.x = 14;
      actionText.y = yPos;
      this.contentContainer.addChild(actionText);
    } else if (content.mode === "selected") {
      const actionText = createTextLabel("Click ring again to deselect", "drawerAction");
      actionText.y = yPos;
      this.contentContainer.addChild(actionText);
    }
  }
}
