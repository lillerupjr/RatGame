export type PreparedRenderFrame = Record<string, any>;

export function prepareRenderFrame<T extends PreparedRenderFrame>(frame: T): T {
  return frame;
}
