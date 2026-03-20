import type { UiPassContext } from "../contracts/uiPassContext";

export function renderUiPass(input: UiPassContext): void {
  const {
    overlayCtx,
    overlayDpr,
    hasUiOverlay,
    w,
    resolveNavArrowTarget,
    renderNavArrow,
    cssW,
    cssH,
    worldToScreen,
    viewport,
    safeOffsetX,
    safeOffsetY,
    debugFlags,
    executeDebugPass,
    scaledW,
    scaledH,
    getUserSettings,
    screenW,
    screenH,
  } = input as any;

  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
  if (hasUiOverlay && w.state === "RUN" && w.runState === "FLOOR") {
    const target = resolveNavArrowTarget(w);
    renderNavArrow(
      overlayCtx,
      target,
      { x: 0, y: 0, w: cssW, h: cssH },
      (wx: number, wy: number) => {
        const p = worldToScreen(wx, wy);
        return viewport.projectProjectedToCss(p.x, p.y);
      }
    );
  }
  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, safeOffsetX * overlayDpr, safeOffsetY * overlayDpr);
  if (debugFlags.showGrid) {
    executeDebugPass({
      phase: "gridCompass",
      input: {
        w,
        ctx: overlayCtx,
        ww: scaledW,
        hh: scaledH,
      },
    });
  }

  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
  if (getUserSettings().debug.dpsMeter) {
    renderDPSMeter(w, overlayCtx, screenW, screenH);
  }
  renderDeathFxOverlay(w, overlayCtx, screenW, screenH);
}

function deathFxClamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function renderDeathFxOverlay(w: any, ctx: CanvasRenderingContext2D, ww: number, hh: number): void {
  const deathFx = w.deathFx;
  if (!deathFx?.active) return;

  const blackAlpha = deathFxClamp01(deathFx.aBlack);
  const titleAlpha = deathFxClamp01(deathFx.aTitle);
  if (blackAlpha <= 0 && titleAlpha <= 0) return;

  ctx.fillStyle = `rgba(0, 0, 0, ${blackAlpha.toFixed(4)})`;
  ctx.fillRect(0, 0, ww, hh);

  if (titleAlpha <= 0) return;

  const cx = ww * 0.5;
  const cy = hh * 0.5;
  const textScale = 1.06 - 0.06 * titleAlpha;
  const fontSize = Math.round(Math.max(52, Math.min(120, ww * 0.14)));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(textScale, textScale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.08));
  ctx.strokeStyle = `rgba(0, 0, 0, ${(0.90 * titleAlpha).toFixed(4)})`;
  ctx.fillStyle = `rgba(165, 18, 18, ${(0.98 * titleAlpha).toFixed(4)})`;
  ctx.strokeText("WASTED", 0, 0);
  ctx.fillText("WASTED", 0, 0);
  ctx.restore();
}

function renderDPSMeter(w: any, ctx: CanvasRenderingContext2D, ww: number, hh: number): void {
  if (!w.dpsEnabled) return;

  const currentTime = w.time;
  const totalTime = currentTime - w.dpsStartTime;

  const avgDPS = totalTime > 0 ? w.dpsTotalDamage / totalTime : 0;

  let recentDPS = 0;
  if (w.dpsRecentDamage.length > 0) {
    const recentTotal = w.dpsRecentDamage.reduce((sum: number, dmg: number) => sum + dmg, 0);
    const oldestTime = w.dpsRecentTimes[0] || currentTime;
    const recentWindow = currentTime - oldestTime;
    recentDPS = recentWindow > 0 ? recentTotal / recentWindow : 0;
  }

  const panelW = 180;
  const panelH = 80;
  const x = ww - panelW - 12;
  const y = 12;

  ctx.save();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, panelW, panelH);

  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("DPS METER", x + 8, y + 8);

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#4fc3f7";
  ctx.fillText(`${Math.round(recentDPS).toLocaleString()}`, x + 8, y + 28);

  ctx.font = "11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("current", x + 8, y + 50);

  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "right";
  ctx.fillText(`avg: ${Math.round(avgDPS).toLocaleString()}`, x + panelW - 8, y + 28);

  ctx.font = "10px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`total: ${Math.round(w.dpsTotalDamage).toLocaleString()}`, x + panelW - 8, y + panelH - 10);

  ctx.restore();
}
