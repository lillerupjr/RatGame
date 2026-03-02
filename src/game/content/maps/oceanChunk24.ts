export const OCEAN_CHUNK_SIZE = 24;

export type OceanChunk = {
  w: number;
  h: number;
  tiles: string[]; // row-major, length w*h
};

export function makeOceanChunk24(): OceanChunk {
  const w = OCEAN_CHUNK_SIZE;
  const h = OCEAN_CHUNK_SIZE;
  const tiles = new Array<string>(w * h);
  for (let i = 0; i < tiles.length; i++) tiles[i] = "OCEAN";
  return { w, h, tiles };
}
