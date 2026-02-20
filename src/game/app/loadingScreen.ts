export function renderLoadingScreen(
  ctx: CanvasRenderingContext2D,
  progress: number,
): void {
  const cssW = Math.max(1, ctx.canvas.clientWidth || window.innerWidth || 1);
  const cssH = Math.max(1, ctx.canvas.clientHeight || window.innerHeight || 1);
  const devW = Math.max(1, ctx.canvas.width);
  const devH = Math.max(1, ctx.canvas.height);
  const dpr = Math.max(1, devW / cssW);
  const p = Math.max(0, Math.min(1, progress));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, devW, devH);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, cssW, cssH);

  const barW = Math.max(200, Math.floor(cssW * 0.45));
  const barH = 18;
  const x = Math.floor((cssW - barW) * 0.5);
  const y = Math.floor(cssH * 0.58);

  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = "#7ee787";
  ctx.fillRect(x, y, Math.floor(barW * p), barH);

  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  ctx.fillStyle = "#e6e6e6";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Loading...", Math.floor(cssW * 0.5), y - 20);
  ctx.fillText(`${Math.floor(p * 100)}%`, Math.floor(cssW * 0.5), y + 44);
  ctx.restore();
}
