import type { RenderCommand } from "../../../game/systems/presentation/contracts/renderCommands";
import { createDynamicRectRenderPiece, type DynamicRectFamily, type DynamicRectRenderPiece } from "./renderPieceTypes";

function resolveDynamicFamily(command: RenderCommand): DynamicRectFamily {
  const payload = command.payload as Record<string, unknown>;
  if (payload.pickupIndex !== undefined) return "drops";
  if (payload.projectileIndex !== undefined) return "projectiles";
  if (payload.vfxIndex !== undefined) return "vfx";
  if (
    payload.enemyIndex !== undefined
    || payload.npcIndex !== undefined
    || payload.neutralMobIndex !== undefined
    || payload.feet !== undefined
  ) {
    return "entities";
  }
  return "props";
}

export function createDynamicPiece(command: RenderCommand): DynamicRectRenderPiece | null {
  if (command.semanticFamily !== "worldSprite" || command.finalForm !== "quad") return null;
  if (command.payload.auditFamily === "structures") return null;
  return createDynamicRectRenderPiece({
    key: command.key,
    dynamicFamily: resolveDynamicFamily(command),
    payload: command.payload,
  });
}

