import { Container, Graphics, Text } from "pixi.js";
import { Panel } from "../primitives/Panel";
import { InteractiveRegion } from "../primitives/InteractiveRegion";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, SPACING, TEXT_STYLES } from "../pixiTheme";
import type { HandsMode } from "./handsState";
import type { FingerSlotId } from "../../../game/progression/rings/ringTypes";

export type DrawerContent = {
  ringName: string;
  familyId: string;
  description: string;
  statMods: string[];
  mode: HandsMode;
  replacingRingName?: string | null;
  // Token info (selected mode)
  levelUpTokens?: number;
  effectTokens?: number;
  // Talent info (selected mode)
  unlockedTalentCount?: number;
  totalTalentCount?: number;
  availablePassivePoints?: number;
  // Slot/instance context for actions
  slotId?: FingerSlotId | null;
  instanceId?: string | null;
} | null;

export type DrawerCallbacks = {
  onUnequip?: (slotId: FingerSlotId) => void;
  onApplyToken?: (instanceId: string, tokenType: "LEVEL_UP" | "INCREASED_EFFECT_20") => void;
};

export class DetailDrawer extends Container {
  private panel: Panel;
  private contentContainer: Container;
  private maskGfx: Graphics;
  private width_: number;
  private maxHeight: number;
  private currentH = 0;
  private callbacks: DrawerCallbacks = {};

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

  setCallbacks(cb: DrawerCallbacks): void {
    this.callbacks = cb;
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
    // Draw a 2px accent line with gradient effect (solid left -> fading right)
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

    // Talent info (selected mode only)
    if (content.mode === "selected" && content.totalTalentCount != null && content.totalTalentCount > 0) {
      const talentStr = `Talents: ${content.unlockedTalentCount ?? 0}/${content.totalTalentCount}`;
      const talentText = createTextLabel(talentStr, "statLabel");
      talentText.y = yPos;
      this.contentContainer.addChild(talentText);

      if (content.availablePassivePoints != null && content.availablePassivePoints > 0) {
        const ppStyle = TEXT_STYLES.muted.clone();
        ppStyle.fill = COLORS.amber;
        const ppText = new Text({
          text: `${content.availablePassivePoints} point${content.availablePassivePoints !== 1 ? "s" : ""} available`,
          style: ppStyle,
        });
        ppText.x = talentText.width + 12;
        ppText.y = yPos;
        this.contentContainer.addChild(ppText);
      }
      yPos += 20;
    }

    // Replacement warning (choose-slot mode, occupied slot)
    if (content.mode === "choose-slot" && content.replacingRingName) {
      const warnStyle = TEXT_STYLES.muted.clone();
      warnStyle.fill = COLORS.amber;
      const warnText = new Text({
        text: `Replaces ${content.replacingRingName}`,
        style: warnStyle,
      });
      warnText.y = yPos;

      const warnIcon = new Graphics();
      warnIcon.poly([-5, yPos + 13, 0, yPos + 4, 5, yPos + 13]).stroke({ color: COLORS.amber, width: 1.2, alpha: 0.8 });
      warnIcon.circle(0, yPos + 10, 1).fill({ color: COLORS.amber, alpha: 0.8 });
      this.contentContainer.addChild(warnIcon);

      warnText.x = 12;
      this.contentContainer.addChild(warnText);
      yPos += 20;
    }

    // Actions
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
      // Action buttons row
      let btnX = 0;

      // Unequip button
      if (content.slotId) {
        const slotId = content.slotId;
        const unequipBtn = this.createActionButton("UNEQUIP", COLORS.crimson, () => {
          this.callbacks.onUnequip?.(slotId);
        });
        unequipBtn.x = btnX;
        unequipBtn.y = yPos;
        this.contentContainer.addChild(unequipBtn);
        btnX += 90;
      }

      // Token action buttons
      if (content.instanceId) {
        const instanceId = content.instanceId;

        if (content.levelUpTokens != null && content.levelUpTokens > 0) {
          const lvlBtn = this.createActionButton(
            `LEVEL UP (${content.levelUpTokens})`,
            COLORS.amber,
            () => {
              this.callbacks.onApplyToken?.(instanceId, "LEVEL_UP");
            },
          );
          lvlBtn.x = btnX;
          lvlBtn.y = yPos;
          this.contentContainer.addChild(lvlBtn);
          btnX += lvlBtn.width + 8;
        }

        if (content.effectTokens != null && content.effectTokens > 0) {
          const effBtn = this.createActionButton(
            `+20% EFFECT (${content.effectTokens})`,
            COLORS.amber,
            () => {
              this.callbacks.onApplyToken?.(instanceId, "INCREASED_EFFECT_20");
            },
          );
          effBtn.x = btnX;
          effBtn.y = yPos;
          this.contentContainer.addChild(effBtn);
        }
      }
    }
  }

  private createActionButton(label: string, color: number, onPress: () => void): Container {
    const btnH = 22;
    const btnStyle = TEXT_STYLES.sectionHeader.clone();
    btnStyle.fill = color;
    btnStyle.letterSpacing = 1.0;
    const btnLabel = new Text({ text: label, style: btnStyle });
    const btnW = btnLabel.width + 16;

    const btnBorder = new Graphics();
    btnBorder.roundRect(0, 0, btnW, btnH, 3).stroke({ color, width: 1, alpha: 0.5 });

    const btn = new InteractiveRegion({
      width: btnW,
      height: btnH,
      onHoverChange: (h) => {
        btnBorder.clear();
        btnBorder.roundRect(0, 0, btnW, btnH, 3).stroke({
          color,
          width: 1,
          alpha: h ? 0.9 : 0.5,
        });
        if (h) {
          btnBorder.roundRect(0, 0, btnW, btnH, 3).fill({ color, alpha: 0.1 });
        }
      },
    });
    btn.setOnPress(onPress);
    btn.addChild(btnBorder);
    btnLabel.x = 8;
    btnLabel.y = (btnH - btnLabel.height) / 2;
    btn.addChild(btnLabel);

    return btn;
  }
}
