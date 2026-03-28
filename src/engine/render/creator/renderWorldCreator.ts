import type { RenderExecutionPlan } from "../../../game/systems/presentation/backend/renderExecutionPlan";
import type { RenderCommand } from "../../../game/systems/presentation/contracts/renderCommands";
import { createDynamicPiece } from "./dynamicCreator";
import { createGroundPiece } from "./groundCreator";
import {
  type CreatedRenderWorld,
  toAuditRenderCommand,
} from "./renderPieceTypes";
import { createStructurePiece } from "./structureCreator";

function isWorldAuxiliaryCommand(command: RenderCommand): boolean {
  return command.pass === "WORLD";
}

export function createRenderWorld(executionPlan: RenderExecutionPlan): CreatedRenderWorld {
  const orderedPieces = [];
  const auxiliaryWorldCommands: RenderCommand[] = [];

  for (let i = 0; i < executionPlan.world.length; i++) {
    const command = executionPlan.world[i];
    const groundPiece = createGroundPiece(command);
    if (groundPiece) {
      orderedPieces.push(groundPiece);
      continue;
    }
    const structurePiece = createStructurePiece(command);
    if (structurePiece) {
      orderedPieces.push(structurePiece);
      continue;
    }
    const dynamicPiece = createDynamicPiece(command);
    if (dynamicPiece) {
      orderedPieces.push(dynamicPiece);
      continue;
    }
    if (isWorldAuxiliaryCommand(command)) auxiliaryWorldCommands.push(command);
  }

  return {
    orderedPieces,
    auxiliaryWorldCommands,
    screenCommands: [...executionPlan.screen],
    auditWorldCommands: orderedPieces.map((piece) => toAuditRenderCommand(piece)),
  };
}
