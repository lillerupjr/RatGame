// @system   core-simulation/combat-runtime
// @owns     apply chest pickup side effects and request reward opening
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no reward rolling or pickup collision scanning; see rewardPresenterSystem.ts and pickups.ts

import { emitEvent, type World } from "../../../engine/world/world";

export function handleChestPickup(w: World, pickupIndex: number): void {
    w.xAlive[pickupIndex] = false;

    // SFX: chest pickup
    emitEvent(w, { type: "SFX", id: "CHEST_PICKUP", vol: 1.0, rate: 1 });

    // Signal game.ts to pause + roll/apply reward + show popup
    w.chestOpenRequested = true;
}
