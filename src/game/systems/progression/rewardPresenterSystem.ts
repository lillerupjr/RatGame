import type { World } from "../../../engine/world/world";
import { beginRelicReward, ensureRelicRewardState } from "../../combat_mods/rewards/relicRewardFlow";
import {
  activateRewardTicket,
  findOldestPendingRewardTicket,
  findRewardTicketById,
  resolveRewardTicket,
} from "../../rewards/rewardTickets";

function closeRewardStates(world: World): void {
  const relicReward = ensureRelicRewardState(world);
  relicReward.active = false;
  relicReward.options = [];
}

function anyRewardUiActive(world: World): boolean {
  const relicReward = ensureRelicRewardState(world);
  return relicReward.active;
}

function openTicketReward(world: World, ticket: { kind: "RELIC_PICK"; source: "OBJECTIVE_COMPLETION"; optionCount: number }): boolean {
  beginRelicReward(world, "OBJECTIVE_COMPLETION", ticket.optionCount);
  const relicReward = ensureRelicRewardState(world);
  if (!relicReward.active || relicReward.options.length <= 0) {
    relicReward.active = false;
    relicReward.options = [];
    return false;
  }
  return true;
}

export function rewardPresenterSystem(world: World): boolean {
  if (world.state !== "RUN") return false;

  if (anyRewardUiActive(world)) return false;

  const activeTicket = findRewardTicketById(world, world.activeRewardTicketId);
  if (activeTicket && activeTicket.status === "ACTIVE") {
    return false;
  }
  if (!activeTicket) {
    world.activeRewardTicketId = null;
  }

  closeRewardStates(world);

  for (;;) {
    const pending = findOldestPendingRewardTicket(world);
    if (!pending) return false;

    activateRewardTicket(world, pending);
    const opened = openTicketReward(world, pending);
    if (opened) {
      world.state = "REWARD";
      return true;
    }

    resolveRewardTicket(world, pending);
  }
}
