export const STABLE_TEXTURE_SOURCE_FLAG = "__ratStableTextureSource";
export const GROUND_CHUNK_TEXTURE_SOURCE_FLAG = "__ratGroundChunkTextureSource";
export const TEXTURE_DEBUG_LABEL_FLAG = "__ratTextureDebugLabel";

export function markStableTextureSource<T extends object>(value: T): T {
  (value as Record<string, unknown>)[STABLE_TEXTURE_SOURCE_FLAG] = true;
  return value;
}

export function markGroundChunkTextureSource<T extends object>(value: T): T {
  (value as Record<string, unknown>)[GROUND_CHUNK_TEXTURE_SOURCE_FLAG] = true;
  return value;
}

export function setTextureDebugLabel<T extends object>(value: T, label: string): T {
  (value as Record<string, unknown>)[TEXTURE_DEBUG_LABEL_FLAG] = label;
  return value;
}

export function isStableTextureSource(value: unknown): boolean {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return false;
  return (value as Record<string, unknown>)[STABLE_TEXTURE_SOURCE_FLAG] === true;
}

export function isGroundChunkTextureSource(value: unknown): boolean {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return false;
  return (value as Record<string, unknown>)[GROUND_CHUNK_TEXTURE_SOURCE_FLAG] === true;
}

export function getTextureDebugLabel(value: unknown): string | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return null;
  const label = (value as Record<string, unknown>)[TEXTURE_DEBUG_LABEL_FLAG];
  return typeof label === "string" && label.trim() ? label : null;
}
