import { drawShadowTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import type { StructureShadowProjectedTriangle } from "../structureShadowV1";
import type {
  StructureHybridShadowRenderPiece,
  StructureV4ShadowRenderPiece,
} from "./structureShadowTypes";

export function drawStructureHybridShadowProjectedTriangles(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureHybridShadowRenderPiece[],
  maxDarkness: number,
): void {
  if (pieces.length <= 0) return;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  if (shadowAlpha <= 0) return;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const projectedMappings = piece.projectedMappings;
    for (let ti = 0; ti < projectedMappings.length; ti++) {
      const mapping = projectedMappings[ti];
      const [s0, s1, s2] = mapping.srcTriangle;
      const [d0, d1, d2] = mapping.projectedTriangle;
      drawShadowTexturedTriangle(
        ctx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        d0,
        d1,
        d2,
        shadowAlpha,
      );
    }
  }
}

export function countStructureHybridProjectedTriangles(
  pieces: readonly StructureHybridShadowRenderPiece[],
): number {
  let count = 0;
  for (let i = 0; i < pieces.length; i++) count += pieces[i].projectedMappings.length;
  return count;
}

export function drawStructureHybridProjectedTrianglesSolid(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureHybridShadowRenderPiece[],
  fillStyle: string,
): number {
  if (pieces.length <= 0) return 0;
  let triangleCount = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < pieces.length; i++) {
    const mappings = pieces[i].projectedMappings;
    for (let ti = 0; ti < mappings.length; ti++) {
      const [a, b, c] = mappings[ti].projectedTriangle;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      triangleCount++;
    }
  }
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
  return triangleCount;
}

export function drawStructureV4ShadowWarpedTriangles(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV4ShadowRenderPiece[],
  maxDarkness: number,
): number {
  if (pieces.length <= 0) return 0;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  if (shadowAlpha <= 0) return 0;
  let triangleCount = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const correspondences = piece.triangleCorrespondence;
    for (let ci = 0; ci < correspondences.length; ci++) {
      const correspondence = correspondences[ci];
      const srcTriangle = correspondence.sourceSrcPoints ?? correspondence.sourceTrianglePoints;
      const [s0, s1, s2] = srcTriangle;
      const [d0, d1, d2] = correspondence.destinationTrianglePoints;
      drawShadowTexturedTriangle(
        ctx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        d0,
        d1,
        d2,
        shadowAlpha,
      );
      triangleCount++;
    }
  }
  return triangleCount;
}

export function drawStructureV4ShadowTrianglesSolid(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV4ShadowRenderPiece[],
  fillStyle: string,
): number {
  if (pieces.length <= 0) return 0;
  let triangleCount = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < pieces.length; i++) {
    const correspondences = pieces[i].triangleCorrespondence;
    for (let ci = 0; ci < correspondences.length; ci++) {
      const [a, b, c] = correspondences[ci].destinationTrianglePoints;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      triangleCount++;
    }
  }
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
  return triangleCount;
}

export function drawStructureShadowProjectedTriangles(
  ctx: CanvasRenderingContext2D,
  triangles: readonly StructureShadowProjectedTriangle[],
  maxDarkness: number,
): void {
  if (triangles.length <= 0) return;
  const alpha = Math.max(0, Math.min(1, maxDarkness));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const [a, b, c] = tri;
    const signedArea2 =
      (b.x - a.x) * (c.y - a.y)
      - (b.y - a.y) * (c.x - a.x);
    if (signedArea2 >= 0) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
    } else {
      // Normalize winding so overlapping triangles do not cancel under non-zero fill.
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fill();
  ctx.restore();
}
