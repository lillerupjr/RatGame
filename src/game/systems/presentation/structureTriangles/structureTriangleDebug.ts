import { buildRuntimeStructureTriangleDebugPieces } from "./structureTriangleBuilder";
import { groupRuntimeStructureTrianglePiecesByParentTile } from "./structureTriangleGrouping";
import {
  type StructureSliceDebugRect,
  type StructureSliceDebugTriangleStats,
} from "./structureTriangleTypes";

function ownerTileColor(tx: number, ty: number, alpha: number): string {
  const hash = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  const hue = hash % 360;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `hsla(${hue}, 92%, 54%, ${clampedAlpha})`;
}

export function drawStructureSliceTriangleDebugOverlay(
  ctx: CanvasRenderingContext2D,
  rect: StructureSliceDebugRect,
  progressionIndex: number,
  tileWorld: number,
  structureInstanceId: string,
  bandIndex: number,
  sourceImg?: CanvasImageSource,
  srcRect?: StructureSliceDebugRect,
): StructureSliceDebugTriangleStats {
  const { pieces, stats } = buildRuntimeStructureTriangleDebugPieces(
    rect,
    progressionIndex,
    tileWorld,
    structureInstanceId,
    bandIndex,
    sourceImg,
    srcRect,
  );
  if (pieces.length <= 0) return stats;

  const groups = groupRuntimeStructureTrianglePiecesByParentTile(pieces);
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.w;
  const y1 = rect.y + rect.h;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, Math.max(0, rect.w), Math.max(0, rect.h));
  ctx.clip();

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const fill = ownerTileColor(group.parentTx, group.parentTy, 0.13);
    const stroke = ownerTileColor(group.parentTx, group.parentTy, 0.52);
    for (let ti = 0; ti < group.triangles.length; ti++) {
      const tri = group.triangles[ti];
      const [a, b, c] = tri.points;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const gx0 = group.bounds.x;
    const gy0 = group.bounds.y;
    const gx1 = gx0 + group.bounds.w;
    const gy1 = gy0 + group.bounds.h;
    const labelX = Math.max(x0 + 2, Math.min(x1 - 2, (gx0 + gx1) * 0.5));
    const labelY = Math.max(y0 + 2, Math.min(y1 - 2, (gy0 + gy1) * 0.5));
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillText(`t:${group.parentTx},${group.parentTy}`, labelX + 1, labelY + 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(`t:${group.parentTx},${group.parentTy}`, labelX, labelY);
  }

  ctx.restore();
  return stats;
}
