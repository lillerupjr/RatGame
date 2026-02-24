import { applyCardToWorld } from "./cardApply";

export function grantCardToPlayer(world: any, cardId: string): void {
  applyCardToWorld(world, cardId);
}
