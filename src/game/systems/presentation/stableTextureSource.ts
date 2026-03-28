export const STABLE_TEXTURE_SOURCE_FLAG = "__ratStableTextureSource";
export const GROUND_CHUNK_TEXTURE_SOURCE_FLAG = "__ratGroundChunkTextureSource";

export function markStableTextureSource<T extends object>(value: T): T {
  (value as Record<string, unknown>)[STABLE_TEXTURE_SOURCE_FLAG] = true;
  return value;
}

export function markGroundChunkTextureSource<T extends object>(value: T): T {
  (value as Record<string, unknown>)[GROUND_CHUNK_TEXTURE_SOURCE_FLAG] = true;
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
