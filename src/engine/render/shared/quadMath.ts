import type { RenderPoint, RenderQuadPointsPayload } from "../../../game/systems/presentation/contracts/renderCommands";

function point(x: number, y: number): RenderPoint {
  return { x, y };
}

export function buildRectDestinationQuad(
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): RenderQuadPointsPayload {
  return {
    nw: point(dx, dy),
    ne: point(dx + dw, dy),
    se: point(dx + dw, dy + dh),
    sw: point(dx, dy + dh),
  };
}

export function buildRotatedRectDestinationQuad(
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  rotationRad: number,
  flipX: boolean,
): RenderQuadPointsPayload {
  if (!rotationRad) return buildRectDestinationQuad(dx, dy, dw, dh);

  const cx = dx + dw * 0.5;
  const cy = dy + dh * 0.5;
  const localLeft = flipX ? dw * 0.5 : -dw * 0.5;
  const localRight = flipX ? -dw * 0.5 : dw * 0.5;
  const localTop = -dh * 0.5;
  const localBottom = dh * 0.5;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const rotate = (lx: number, ly: number): RenderPoint => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  });
  return {
    nw: rotate(localLeft, localTop),
    ne: rotate(localRight, localTop),
    se: rotate(localRight, localBottom),
    sw: rotate(localLeft, localBottom),
  };
}

export function hasExplicitQuadGeometry(payload: Record<string, unknown>): boolean {
  return Number.isFinite(Number(payload.x0))
    && Number.isFinite(Number(payload.y0))
    && Number.isFinite(Number(payload.x1))
    && Number.isFinite(Number(payload.y1))
    && Number.isFinite(Number(payload.x2))
    && Number.isFinite(Number(payload.y2))
    && Number.isFinite(Number(payload.x3))
    && Number.isFinite(Number(payload.y3));
}

