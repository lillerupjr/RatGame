import type {
  RenderDebugScreenPassInput,
  RenderDebugWorldPassInput,
  StructureV6VerticalShadowMaskDebugData,
} from "./debugRenderTypes";
import type { World } from "../../../../engine/world/world";
import { drawEntityAnchorOverlay, renderDebugEntityOverlays } from "./renderDebugEntities";
import { renderDebugLightingOverlay } from "./renderDebugLighting";
import {
  drawStructureV65MergedShadowMaskInWorld,
  renderDebugStructureOverlays,
} from "./renderDebugStructures";
import { renderDebugWorldOverlays, renderTileGridCompass } from "./renderDebugWorld";

export type RenderDebugPassInvocation =
  | {
      phase: "world";
      input: RenderDebugWorldPassInput;
    }
  | {
      phase: "screen";
      input: RenderDebugScreenPassInput;
    }
  | {
      phase: "entityAnchor";
      input: {
        ctx: CanvasRenderingContext2D;
        show: boolean;
        feetX: number;
        feetY: number;
        drawX: number;
        drawY: number;
        drawW: number;
        drawH: number;
      };
    }
  | {
      phase: "structureV6MergedMask";
      input: {
        ctx: CanvasRenderingContext2D;
        debugData: StructureV6VerticalShadowMaskDebugData;
      };
    }
  | {
      phase: "gridCompass";
      input: {
        w: World;
        ctx: CanvasRenderingContext2D;
        ww: number;
        hh: number;
      };
    };

export function executeDebugPass(invocation: RenderDebugPassInvocation): void {
  if (invocation.phase === "world") {
    renderDebugWorldOverlays(invocation.input);
    renderDebugEntityOverlays(invocation.input.debugContext, invocation.input.flags);
    renderDebugStructureOverlays(invocation.input);
    return;
  }

  if (invocation.phase === "screen") {
    renderDebugLightingOverlay(invocation.input);
    return;
  }

  if (invocation.phase === "entityAnchor") {
    drawEntityAnchorOverlay(
      invocation.input.ctx,
      invocation.input.show,
      invocation.input.feetX,
      invocation.input.feetY,
      invocation.input.drawX,
      invocation.input.drawY,
      invocation.input.drawW,
      invocation.input.drawH,
    );
    return;
  }

  if (invocation.phase === "gridCompass") {
    renderTileGridCompass(invocation.input.w, invocation.input.ctx, invocation.input.ww, invocation.input.hh);
    return;
  }

  drawStructureV65MergedShadowMaskInWorld(invocation.input.ctx, invocation.input.debugData);
}
