import { emitEvent, type World } from "../../../engine/world/world";

export function handleChestPickup(w: World, pickupIndex: number): void {
    w.xAlive[pickupIndex] = false;

    // Unblock boss progression once chest is taken
    w.bossRewardPending = false;
    // Boss beat reward: heal to full
    w.playerHp = w.playerHpMax;

    // SFX: chest pickup
    emitEvent(w, { type: "SFX", id: "CHEST_PICKUP", vol: 1.0, rate: 1 });

    // Signal game.ts to pause + roll/apply reward + show popup
    w.chestOpenRequested = true;
}
