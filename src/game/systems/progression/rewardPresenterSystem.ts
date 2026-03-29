import type { World } from "../../../engine/world/world";
import { beginCardReward, ensureCardRewardState } from "../../combat_mods/rewards/cardRewardFlow";
import { beginRelicReward, ensureRelicRewardState } from "../../combat_mods/rewards/relicRewardFlow";
import {
  activateRewardTicket,
  findOldestPendingRewardTicket,
  findRewardTicketById,
  resolveRewardTicket,
} from "../../rewards/rewardTickets";

function closeRewardStates(world: World): void {
  const cardReward = ensureCardRewardState(world);
  cardReward.active = false;
  cardReward.options = [];

  const relicReward = ensureRelicRewardState(world);
  relicReward.active = false;
  relicReward.options = [];
}

function anyRewardUiActive(world: World): boolean {
  const cardReward = ensureCardRewardState(world);
  if (cardReward.active) return true;
  const relicReward = ensureRelicRewardState(world);
  return relicReward.active;
}

function openTicketReward(world: World, ticket: { kind: "CARD_PICK" | "RELIC_PICK"; source: "ZONE_TRIAL" | "BOSS_CHEST" | "OBJECTIVE_COMPLETION" | "LEVEL_UP"; optionCount: number }): boolean {
  if (ticket.kind === "CARD_PICK") {
    const source = ticket.source === "BOSS_CHEST"
      ? "BOSS_CHEST"
      : ticket.source === "LEVEL_UP"
        ? "LEVEL_UP"
        : "ZONE_TRIAL";
    beginCardReward(world, source, ticket.optionCount);
    const cardReward = ensureCardRewardState(world);
    if (!cardReward.active || cardReward.options.length <= 0) {
      cardReward.active = false;
      cardReward.options = [];
      return false;
    }
    return true;
  }

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
