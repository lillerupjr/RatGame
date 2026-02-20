export function renderLoadingScreen(
  ctx: CanvasRenderingContext2D,
  progress: number,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const p = Math.max(0, Math.min(1, progress));

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  const barW = Math.max(200, Math.floor(w * 0.45));
  const barH = 18;
  const x = Math.floor((w - barW) * 0.5);
  const y = Math.floor(h * 0.58);

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
  ctx.fillText("Loading...", Math.floor(w * 0.5), y - 20);
  ctx.fillText(`${Math.floor(p * 100)}%`, Math.floor(w * 0.5), y + 44);
  ctx.restore();
}
