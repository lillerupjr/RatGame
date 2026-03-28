import { blockedTilesInView } from "../../../map/compile/kenneyMap";
import type { RenderDebugWorldPassInput } from "./debugRenderTypes";

export function renderDebugStructureOverlays(input: RenderDebugWorldPassInput): void {
  const {
    ctx,
    viewRect,
    toScreen,
    tileWorld,
    flags,
    deferredStructureSliceDebugDraws,
  } = input;

  if (flags.showStructureCollision) {
    const blocked = blockedTilesInView(viewRect);
    if (blocked.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
      ctx.fillStyle = "rgba(255, 80, 80, 0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < blocked.length; i++) {
        const t = blocked[i];
        const p0 = toScreen(t.tx * tileWorld, t.ty * tileWorld);
        const p1 = toScreen((t.tx + 1) * tileWorld, t.ty * tileWorld);
        const p2 = toScreen((t.tx + 1) * tileWorld, (t.ty + 1) * tileWorld);
        const p3 = toScreen(t.tx * tileWorld, (t.ty + 1) * tileWorld);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  for (let i = 0; i < deferredStructureSliceDebugDraws.length; i++) {
    deferredStructureSliceDebugDraws[i]();
  }
}
