import type { RenderCommand } from "../../../game/systems/presentation/contracts/renderCommands";
import { createStaticWorldQuadRenderPiece, type StaticWorldQuadRenderPiece } from "./renderPieceTypes";

export function createGroundPiece(command: RenderCommand): StaticWorldQuadRenderPiece | null {
  if (command.semanticFamily !== "groundSurface" && command.semanticFamily !== "groundDecal") return null;
  if (command.finalForm !== "quad") return null;
  return createStaticWorldQuadRenderPiece({
    key: command.key,
    semanticFamily: command.semanticFamily,
    staticFamily: command.semanticFamily,
    worldGeometry: "iso",
    kind: "iso",
    payload: command.payload,
  });
}
