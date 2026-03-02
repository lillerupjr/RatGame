import type { World } from "../../../engine/world/world";
import { applyVendorPurchase, type VendorOffer } from "../../events/vendor";
import { applyRelic } from "./relics";

function applyOfferEffect(world: World, offer: VendorOffer): void {
  switch (offer.kind) {
    case "RELIC":
      applyRelic(world, offer.id, { source: "shop" });
      return;
    case "HEAL":
      world.playerHp = Math.min(world.playerHpMax, world.playerHp + 25);
      return;
    case "UPGRADE":
    case "REROLL":
    default:
      return;
  }
}

/** Apply vendor purchases from events; UI emits purchase events only. */
export function vendorSystem(world: World): void {
  if (world.events.length === 0) return;

  for (let i = 0; i < world.events.length; i++) {
    const ev = world.events[i];
    if (ev.type !== "VENDOR_PURCHASE") continue;
    const ok = applyVendorPurchase(world, ev.offer);
    if (ok) applyOfferEffect(world, ev.offer);
  }
}
