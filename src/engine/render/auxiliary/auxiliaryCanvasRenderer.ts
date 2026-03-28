import { Canvas2DRenderer } from "../../../game/systems/presentation/backend/Canvas2DRenderer";
import type { RenderCommand } from "../../../game/systems/presentation/contracts/renderCommands";

export class AuxiliaryCanvasRenderer {
  constructor(private readonly renderer: Canvas2DRenderer) {}

  renderWorld(commands: readonly RenderCommand[]): void {
    if (commands.length <= 0) return;
    this.renderer.renderWorldCommands(commands);
  }

  renderScreen(commands: readonly RenderCommand[]): void {
    if (commands.length <= 0) return;
    this.renderer.renderScreenCommands(commands);
  }
}
