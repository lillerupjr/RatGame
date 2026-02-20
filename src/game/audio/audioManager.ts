import type { SfxId } from "../events";
import { preloadSfx } from "../../engine/audio/sfx";

const primedAudio = new Set<SfxId>();

export async function preloadAudio(id: SfxId): Promise<void> {
  if (primedAudio.has(id)) return;
  primedAudio.add(id);
  await preloadSfx();
}

export function primeAudio(audioIds: string[]): Promise<void> {
  return Promise.all(audioIds.map((id) => preloadAudio(id as SfxId))).then(() => {});
}
