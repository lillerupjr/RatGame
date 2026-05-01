import type { RenderCommand } from "../../../game/systems/presentation/contracts/renderCommands";
import { createStaticWorldQuadRenderPiece, type StaticWorldQuadRenderPiece } from "./renderPieceTypes";

export function createStructurePiece(command: RenderCommand): StaticWorldQuadRenderPiece | null {
  if (command.semanticFamily !== "worldSprite" || command.finalForm !== "quad") return null;
  if (command.payload.auditFamily !== "structures") return null;
  return createStaticWorldQuadRenderPiece({
    key: command.key,
    semanticFamily: "worldSprite",
    staticFamily: "structures",
    worldGeometry: "projected",
    kind: command.payload.kind === "iso" ? "iso" : "rect",
    payload: command.payload,
  });
}
