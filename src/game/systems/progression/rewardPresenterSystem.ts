import type { World } from "../../../engine/world/world";
import {
  beginProgressionReward,
  ensureProgressionRewardState,
} from "../../progression/rewards/progressionRewardFlow";
import {
  defaultRewardFamilyForDepth,
  type ProgressionRewardFamily,
} from "../../progression/rewards/rewardFamilies";
import {
  activateRewardTicket,
  findOldestPendingRewardTicket,
  findRewardTicketById,
  resolveRewardTicket,
} from "../../rewards/rewardTickets";

function closeRewardStates(world: World): void {
  const progressionReward = ensureProgressionRewardState(world);
  progressionReward.active = false;
  progressionReward.options = [];
}

function anyRewardUiActive(world: World): boolean {
  const progressionReward = ensureProgressionRewardState(world);
  return progressionReward.active;
}

type PresentableRewardTicket = {
  source: "FLOOR_COMPLETION" | "BOSS_CHEST" | "SIDE_OBJECTIVE" | "LEVEL_UP";
  optionCount: number;
  family: ProgressionRewardFamily;
};

function openTicketReward(world: World, ticket: PresentableRewardTicket): boolean {
  const family = ticket.family ?? defaultRewardFamilyForDepth(world.currentFloorIntent?.depth ?? world.mapDepth ?? 1);
  beginProgressionReward(world, family, ticket.source, ticket.optionCount);
  const progressionReward = ensureProgressionRewardState(world);
  if (!progressionReward.active || progressionReward.options.length <= 0) {
    progressionReward.active = false;
    progressionReward.options = [];
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
