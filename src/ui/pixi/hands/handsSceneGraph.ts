import { Container, Graphics, Sprite, Assets, Texture } from "pixi.js";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS } from "../pixiTheme";
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
  closeBtn: InteractiveRegion;
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
  "/assets-runtime/UI/rings/ring_test.png",
  "/assets-runtime/UI/rings/ring_test2.png",
  "/assets-runtime/UI/rings/ring_test3.png",
];

const HANDS_PATH = "/assets-runtime/UI/hands/ratHands.png";

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
  bgOverlay.rect(0, 0, layout.screenW, layout.screenH).fill({ color: COLORS.bg, alpha: 0.85 });
  bgOverlay.eventMode = "static";
  screenRoot.addChild(bgOverlay);

  // ── Top bar ──
  const topBar = new Container();
  {
    const topBg = new Graphics();
    topBg.rect(0, 0, layout.screenW, layout.topBarH).fill({ color: COLORS.bgPanel });
    topBg
      .rect(0, layout.topBarH - 1, layout.screenW, 1)
      .fill({ color: COLORS.border, alpha: 0.65 });
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

  // Close button
  const closeBtn = new InteractiveRegion({
    width: 26,
    height: 26,
    onHoverChange: (h) => {
      closeBtnText.style.fill = h ? COLORS.text : COLORS.textMuted;
    },
  });
  closeBtn.x = layout.screenW - COLORS.border - 46; // position near right of top bar
  closeBtn.y = (layout.topBarH - 26) / 2;

  const closeBtnBorder = new Graphics();
  closeBtnBorder.roundRect(0, 0, 26, 26, 2).stroke({ color: COLORS.border, width: 1 });
  closeBtn.addChild(closeBtnBorder);

  const closeBtnText = createTextLabel("\u2715", "muted");
  closeBtnText.x = (26 - closeBtnText.width) / 2;
  closeBtnText.y = (26 - closeBtnText.height) / 2;
  closeBtn.addChild(closeBtnText);
  topBar.addChild(closeBtn);

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
    closeBtn,
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
    .fill({ color: COLORS.bg, alpha: 0.85 });

  // Top bar background: redraw
  const topBg = nodes.topBar.getChildAt(0) as Graphics;
  topBg.clear();
  topBg.rect(0, 0, layout.screenW, layout.topBarH).fill({ color: COLORS.bgPanel });
  topBg
    .rect(0, layout.topBarH - 1, layout.screenW, 1)
    .fill({ color: COLORS.border, alpha: 0.65 });

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
