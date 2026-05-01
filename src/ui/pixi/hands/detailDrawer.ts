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
  private currentH = 0;

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
    // Preserve current drawer height across resizes
    this.maskGfx.clear();
    this.maskGfx.rect(0, 0, width, this.currentH).fill({ color: 0xffffff });
  }

  /** Set the visible height of the drawer (0 = closed, maxHeight = open). */
  setDrawerHeight(h: number): void {
    this.currentH = h;
    this.maskGfx.clear();
    this.maskGfx.rect(0, 0, this.width_, h).fill({ color: 0xffffff });
  }

  update(content: DrawerContent): void {
    this.contentContainer.removeChildren();
    if (!content) return;

    const contentW = this.width_ - SPACING.xxl * 2;
    let yPos = 0;

    // Top accent line — gradient from accent to transparent
    const accentColor = content.mode === "choose-slot" ? COLORS.green : COLORS.gold;
    const accent = new Graphics();
    // Draw a 2px accent line with gradient effect (solid left → fading right)
    accent.rect(-SPACING.xxl, -SPACING.xl, this.width_ * 0.6, 2).fill({
      color: accentColor,
      alpha: 0.7,
    });
    accent.rect(-SPACING.xxl + this.width_ * 0.6, -SPACING.xl, this.width_ * 0.4, 2).fill({
      color: accentColor,
      alpha: 0.2,
    });
    this.contentContainer.addChild(accent);

    // Ring name
    const nameText = createTextLabel(content.ringName.toUpperCase(), "ringName");
    nameText.y = yPos;
    this.contentContainer.addChild(nameText);

    // Family tag
    const familyStyle = TEXT_STYLES.ringFamily.clone();
    familyStyle.fill = COLORS.gold;
    const familyTag = new Text({
      text: content.familyId.toUpperCase(),
      style: familyStyle,
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
      const descStyle = TEXT_STYLES.muted.clone();
      descStyle.fontStyle = "italic";
      descStyle.wordWrap = true;
      descStyle.wordWrapWidth = contentW;
      const desc = new Text({
        text: content.description,
        style: descStyle,
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

      const actionStyle = TEXT_STYLES.accent.clone();
      actionStyle.fill = COLORS.green;
      const actionText = new Text({
        text: "Choose a finger to equip",
        style: actionStyle,
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
