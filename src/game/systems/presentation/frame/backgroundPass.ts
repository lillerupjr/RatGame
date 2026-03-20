import { ViewportTransform } from "../viewportTransform";

const HARDCODED_VOID_TOP_SRC = `${import.meta.env.BASE_URL}assets-runtime/tiles/floor/void.png`;
const VOID_BG_MODE: "SOLID" | "PATTERN" = "SOLID";

let voidBgPattern: CanvasPattern | null = null;
let voidBgPatternImgRef: HTMLImageElement | null = null;
let hardcodedVoidTopImage: HTMLImageElement | null = null;
let hardcodedVoidTopReady = false;
let hardcodedVoidTopFailed = false;

function getHardcodedVoidTop(): { ready: boolean; img: HTMLImageElement | null } {
  if (hardcodedVoidTopReady && hardcodedVoidTopImage) {
    return { ready: true, img: hardcodedVoidTopImage };
  }
  if (hardcodedVoidTopFailed) {
    return { ready: false, img: null };
  }
  if (!hardcodedVoidTopImage) {
    const img = new Image();
    img.src = HARDCODED_VOID_TOP_SRC;
    img.onload = () => { hardcodedVoidTopReady = true; };
    img.onerror = () => { hardcodedVoidTopFailed = true; };
    hardcodedVoidTopImage = img;
  }
  return { ready: false, img: hardcodedVoidTopImage };
}

export function drawVoidBackgroundOnce(
  ctx: CanvasRenderingContext2D,
  devW: number,
  devH: number,
  viewport: ViewportTransform,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  if (VOID_BG_MODE === "SOLID") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
    return;
  }

  const rec = getHardcodedVoidTop();
  const img = rec.ready ? rec.img : null;
  if (!img || img.width <= 0 || img.height <= 0) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
    return;
  }

  if (!voidBgPattern || voidBgPatternImgRef !== img) {
    voidBgPatternImgRef = img;
    voidBgPattern = ctx.createPattern(img, "repeat");
  }

  if (voidBgPattern) {
    const patternOffset = viewport.getPatternOffsetDevice();
    const ox = patternOffset.x;
    const oy = patternOffset.y;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = voidBgPattern;
    ctx.fillRect(-ox, -oy, devW, devH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
  }

  ctx.restore();
}
