import { Container, Graphics, Sprite, Assets, Texture, Text } from "pixi.js";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, TEXT_STYLES } from "../pixiTheme";
import { RingSlotView } from "./ringSlot";
import { StatsRail } from "./statsRail";
import { DetailDrawer } from "./detailDrawer";
import { AcquisitionBanner } from "./acquisitionBanner";
import { getSlotConfigs } from "./ringSlotConfig";
import { computeLayout, type HandsLayoutMetrics } from "./handsLayout";
import { InteractiveRegion } from "../primitives/InteractiveRegion";

export type HandsSceneNodes = {
  screenRoot: Container;
  bgOverlay: Graphics;
  topBar: Container;
  topBarModeText: Text;
  closeBtn: InteractiveRegion;
  devAddRingBtn: InteractiveRegion | null;
  centerColumn: Container;
  acquisitionBanner: AcquisitionBanner;
  handsViewport: Container;
  handsSprite: Sprite;
  slotsContainer: Container;
  slotViews: RingSlotView[];
  detailDrawer: DetailDrawer;
  statsRail: StatsRail;
  layout: HandsLayoutMetrics;
  ringTextures: Texture[];
};

const TEXTURE_PATHS = [
  `${import.meta.env.BASE_URL}assets-runtime/UI/rings/ring_test.png`,
  `${import.meta.env.BASE_URL}assets-runtime/UI/rings/ring_test2.png`,
  `${import.meta.env.BASE_URL}assets-runtime/UI/rings/ring_test3.png`,
];

const HANDS_PATH = `${import.meta.env.BASE_URL}assets-runtime/UI/hands/ratHands.png`;

const GRID_SIZE = 42;
const GRID_ALPHA = 0.04;

function drawGridOverlay(gfx: Graphics, w: number, h: number): void {
  // Vertical lines
  for (let x = 0; x <= w; x += GRID_SIZE) {
    gfx.rect(x, 0, 1, h).fill({ color: COLORS.gold, alpha: GRID_ALPHA });
  }
  // Horizontal lines
  for (let y = 0; y <= h; y += GRID_SIZE) {
    gfx.rect(0, y, w, 1).fill({ color: COLORS.gold, alpha: GRID_ALPHA });
  }
}

export async function buildHandsSceneGraph(): Promise<HandsSceneNodes> {
  // Load textures
  const [handsTex, ...ringTextures] = await Promise.all([
    Assets.load<Texture>(HANDS_PATH),
    ...TEXTURE_PATHS.map((p) => Assets.load<Texture>(p)),
  ]);

  const layout = computeLayout(window.innerWidth, window.innerHeight);
  const screenRoot = new Container();

  // ── Background overlay ──
  const bgOverlay = new Graphics();
  bgOverlay.rect(0, 0, layout.screenW, layout.screenH).fill({ color: COLORS.bg, alpha: 0.92 });
  drawGridOverlay(bgOverlay, layout.screenW, layout.screenH);
  bgOverlay.eventMode = "static";
  screenRoot.addChild(bgOverlay);

  // ── Top bar ──
  const topBar = new Container();
  {
    const topBg = new Graphics();
    topBg.rect(0, 0, layout.screenW, layout.topBarH).fill({ color: COLORS.bgPanel });
    topBg
      .rect(0, layout.topBarH - 1, layout.screenW, 1)
      .fill({ color: COLORS.gold, alpha: 0.18 });
    topBar.addChild(topBg);

    const title = createTextLabel("RINGS", "title");
    title.x = 20;
    title.y = (layout.topBarH - title.height) / 2;
    topBar.addChild(title);

    // Separator
    const sep = new Graphics();
    sep.rect(title.x + title.width + 12, (layout.topBarH - 18) / 2, 1, 18).fill({
      color: COLORS.border,
    });
    topBar.addChild(sep);
  }
  screenRoot.addChild(topBar);

  // Mode text (shows "CHOOSE SLOT" in choose-slot mode)
  const modeTextStyle = TEXT_STYLES.accent.clone();
  modeTextStyle.fontSize = 11;
  modeTextStyle.letterSpacing = 2.0;
  const topBarModeText = new Text({ text: "", style: modeTextStyle });
  // Position after the separator — the title and sep are children 1,2 of topBar
  const titleChild = topBar.getChildAt(1) as Text;
  topBarModeText.x = titleChild.x + titleChild.width + 28;
  topBarModeText.y = (layout.topBarH - topBarModeText.height) / 2;
  topBarModeText.visible = false;
  topBar.addChild(topBarModeText);

  // Close button
  const closeBtn = new InteractiveRegion({
    width: 26,
    height: 26,
    onHoverChange: (h) => {
      closeBtnText.style.fill = h ? COLORS.text : COLORS.textMuted;
      closeBtnBorder.clear();
      closeBtnBorder.roundRect(0, 0, 26, 26, 2).stroke({
        color: h ? COLORS.gold : COLORS.border,
        width: 1,
        alpha: h ? 0.5 : 1,
      });
    },
  });
  closeBtn.x = layout.screenW - layout.statsRailW - 46;
  closeBtn.y = (layout.topBarH - 26) / 2;

  const closeBtnBorder = new Graphics();
  closeBtnBorder.roundRect(0, 0, 26, 26, 2).stroke({ color: COLORS.border, width: 1 });
  closeBtn.addChild(closeBtnBorder);

  const closeBtnText = createTextLabel("\u2715", "muted");
  closeBtnText.x = (26 - closeBtnText.width) / 2;
  closeBtnText.y = (26 - closeBtnText.height) / 2;
  closeBtn.addChild(closeBtnText);
  topBar.addChild(closeBtn);

  // DEV: Add random ring button
  let devAddRingBtn: InteractiveRegion | null = null;
  if (import.meta.env.DEV) {
    const btnW = 100;
    const btnH = 22;
    const devBtnText = createTextLabel("+ ADD RING", "sectionHeader");
    devBtnText.style.fill = COLORS.green;
    devBtnText.style.letterSpacing = 1.0;

    const devBtnBorder = new Graphics();
    devBtnBorder.roundRect(0, 0, btnW, btnH, 3).stroke({ color: COLORS.green, width: 1, alpha: 0.4 });

    devAddRingBtn = new InteractiveRegion({
      width: btnW,
      height: btnH,
      onHoverChange: (h) => {
        devBtnBorder.clear();
        devBtnBorder.roundRect(0, 0, btnW, btnH, 3).stroke({
          color: COLORS.green,
          width: 1,
          alpha: h ? 0.8 : 0.4,
        });
        if (h) {
          devBtnBorder.roundRect(0, 0, btnW, btnH, 3).fill({ color: COLORS.green, alpha: 0.08 });
        }
      },
    });
    devAddRingBtn.addChild(devBtnBorder);
    devBtnText.x = (btnW - devBtnText.width) / 2;
    devBtnText.y = (btnH - devBtnText.height) / 2;
    devAddRingBtn.addChild(devBtnText);
    devAddRingBtn.x = closeBtn.x - btnW - 12;
    devAddRingBtn.y = (layout.topBarH - btnH) / 2;
    topBar.addChild(devAddRingBtn);
  }

  // ── Center column ──
  const centerColumn = new Container();
  centerColumn.y = layout.topBarH;
  screenRoot.addChild(centerColumn);

  // Acquisition banner
  const acquisitionBanner = new AcquisitionBanner(layout.centerW, layout.bannerH);
  acquisitionBanner.visible = false;
  centerColumn.addChild(acquisitionBanner);

  // Hands viewport (shifted container)
  const handsViewport = new Container();
  handsViewport.x = layout.handsX;
  handsViewport.y = layout.handsY - layout.topBarH;
  centerColumn.addChild(handsViewport);

  // Hands sprite
  const handsSprite = new Sprite(handsTex);
  handsSprite.width = layout.handsW;
  handsSprite.height = layout.handsH;
  handsSprite.texture.source.scaleMode = "nearest";
  handsViewport.addChild(handsSprite);

  // Slots container
  const slotsContainer = new Container();
  handsViewport.addChild(slotsContainer);

  // Create slot views
  const slotViews: RingSlotView[] = [];
  for (const config of getSlotConfigs()) {
    const sv = new RingSlotView(config);
    sv.positionOnHands(layout.handsW, layout.handsH);
    slotViews.push(sv);
    slotsContainer.addChild(sv);
  }

  // Detail drawer
  const detailDrawer = new DetailDrawer(layout.centerW, layout.drawerH);
  detailDrawer.x = 0;
  detailDrawer.y = layout.centerH - layout.drawerH;
  detailDrawer.setDrawerHeight(0);
  centerColumn.addChild(detailDrawer);

  // ── Stats rail ──
  const statsRail = new StatsRail(layout.statsRailW, layout.screenH - layout.topBarH);
  statsRail.x = layout.screenW - layout.statsRailW;
  statsRail.y = layout.topBarH;
  screenRoot.addChild(statsRail);

  return {
    screenRoot,
    bgOverlay,
    topBar,
    topBarModeText,
    closeBtn,
    devAddRingBtn,
    centerColumn,
    acquisitionBanner,
    handsViewport,
    handsSprite,
    slotsContainer,
    slotViews,
    detailDrawer,
    statsRail,
    layout,
    ringTextures,
  };
}

export function relayoutScene(nodes: HandsSceneNodes): void {
  const layout = computeLayout(window.innerWidth, window.innerHeight);
  nodes.layout = layout;

  // BG overlay
  nodes.bgOverlay.clear();
  nodes.bgOverlay
    .rect(0, 0, layout.screenW, layout.screenH)
    .fill({ color: COLORS.bg, alpha: 0.92 });
  drawGridOverlay(nodes.bgOverlay, layout.screenW, layout.screenH);

  // Top bar background: redraw
  const topBg = nodes.topBar.getChildAt(0) as Graphics;
  topBg.clear();
  topBg.rect(0, 0, layout.screenW, layout.topBarH).fill({ color: COLORS.bgPanel });
  topBg
    .rect(0, layout.topBarH - 1, layout.screenW, 1)
    .fill({ color: COLORS.gold, alpha: 0.18 });

  // Close button position
  nodes.closeBtn.x = layout.screenW - layout.statsRailW - 46;

  // Center column
  nodes.centerColumn.y = layout.topBarH;

  // Acquisition banner
  nodes.acquisitionBanner.resizeBanner(layout.centerW);

  // Hands viewport
  nodes.handsViewport.x = layout.handsX;
  nodes.handsViewport.y = layout.handsY - layout.topBarH;

  // Hands sprite
  nodes.handsSprite.width = layout.handsW;
  nodes.handsSprite.height = layout.handsH;

  // Slot positions
  for (const sv of nodes.slotViews) {
    sv.positionOnHands(layout.handsW, layout.handsH);
  }

  // Detail drawer
  nodes.detailDrawer.resize(layout.centerW, layout.drawerH);
  nodes.detailDrawer.y = layout.centerH - layout.drawerH;

  // Stats rail
  nodes.statsRail.resize(layout.statsRailW, layout.screenH - layout.topBarH);
  nodes.statsRail.x = layout.screenW - layout.statsRailW;
  nodes.statsRail.y = layout.topBarH;
}
