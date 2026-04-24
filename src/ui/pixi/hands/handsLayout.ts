// Computes positions/sizes from screen dimensions for the hands screen.

export type HandsLayoutMetrics = {
  screenW: number;
  screenH: number;
  topBarH: number;
  statsRailW: number;
  drawerH: number;
  bannerH: number;
  centerW: number;
  centerH: number;
  handsScale: number;
  handsW: number;
  handsH: number;
  handsX: number;
  handsY: number;
  handsShiftY: number;
};

const TOP_BAR_H = 50;
const STATS_RAIL_W = 264;
const DRAWER_H = 198;
const BANNER_H = 40;
const HANDS_IMG_W = 1536;
const HANDS_IMG_H = 1024;
const HANDS_SHIFT_Y = -60;

export function computeLayout(screenW: number, screenH: number): HandsLayoutMetrics {
  const centerW = Math.max(100, screenW - STATS_RAIL_W);
  const centerH = Math.max(100, screenH - TOP_BAR_H);

  // Scale hands to fit ~61% of center height (like prototype), but not exceed center width
  const targetH = centerH * 0.61;
  const scaleByHeight = targetH / HANDS_IMG_H;
  const scaleByWidth = (centerW * 0.95) / HANDS_IMG_W;
  const handsScale = Math.min(scaleByHeight, scaleByWidth);

  const handsW = HANDS_IMG_W * handsScale;
  const handsH = HANDS_IMG_H * handsScale;
  const handsX = (centerW - handsW) / 2;
  const handsY = (centerH - DRAWER_H - handsH) / 2 + TOP_BAR_H;

  return {
    screenW,
    screenH,
    topBarH: TOP_BAR_H,
    statsRailW: STATS_RAIL_W,
    drawerH: DRAWER_H,
    bannerH: BANNER_H,
    centerW,
    centerH,
    handsScale,
    handsW,
    handsH,
    handsX: Math.max(0, handsX),
    handsY: Math.max(TOP_BAR_H, handsY),
    handsShiftY: HANDS_SHIFT_Y,
  };
}
