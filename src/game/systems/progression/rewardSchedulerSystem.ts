import type { World } from "../../../engine/world/world";
import { addGold } from "../../economy/gold";
import { OBJECTIVE_COMPLETION_GOLD, type RewardOutcome, handleRewardEvent } from "../../rewards/rewardDirector";
import { type RunEvent, shiftRunEvent } from "../../rewards/runEvents";
import {
  addRewardClaimKey,
  enqueueRewardTicket,
  hasRewardClaimKey,
  type RewardTicketKind,
  type RewardTicketSource,
} from "../../rewards/rewardTickets";

const DEFAULT_OPTION_COUNT = 3;

function floorMapDepthForRewards(world: World): number {
  if (Number.isFinite(world.mapDepth) && world.mapDepth > 0) return world.mapDepth;
  if (Number.isFinite(world.delveDepth) && world.delveDepth > 0) return world.delveDepth;
  return (world.floorIndex ?? 0) + 1;
}

function claimKeyForRunEvent(world: World, ev: RunEvent): string {
  const floorIndex = Number.isFinite(ev.floorIndex) ? ev.floorIndex : (world.floorIndex ?? 0);
  switch (ev.type) {
    case "ZONE_CLEARED":
      return `${floorIndex}:ZONE_CLEAR:${ev.zoneIndex}`;
    case "RARE_MILESTONE_CLEARED":
      return `${floorIndex}:RARE_CLEAR:${ev.rareIndex}`;
    case "OBJECTIVE_COMPLETED":
      if (world.floorRewardBudget.mode === "ZONE_TRIAL") return `${floorIndex}:TRIAL_COMPLETE`;
      return `${floorIndex}:OBJ_COMPLETE:${ev.objectiveId}`;
    case "LEVEL_UP":
      return `${floorIndex}:LEVEL_UP:${ev.level}`;
    case "CHEST_OPEN_REQUESTED":
      return ev.chestKind === "BOSS"
        ? `${floorIndex}:BOSS_CHEST`
        : `${floorIndex}:CHEST_OTHER`;
    case "SURVIVE_MILESTONE":
      return `${floorIndex}:SURVIVE_T:${ev.seconds}`;
    default:
      return `${floorIndex}:UNKNOWN_EVENT`;
  }
}

function applyRareMilestoneReward(world: World, rareIndex: 1 | 2): RewardOutcome {
  return {
    type: "NO_REWARD",
    reason: `Rare milestone ${rareIndex} reward disabled`,
  };
}

function rewardPlanForRunEvent(
  world: World,
  ev: RunEvent,
): {
  outcome: RewardOutcome;
  ticketKind: RewardTicketKind;
  ticketSource: RewardTicketSource;
  bonusGoldAmount: number;
} {
  const depth = floorMapDepthForRewards(world);

  switch (ev.type) {
    case "ZONE_CLEARED":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "ZONE_COMPLETED", zoneIndex: ev.zoneIndex },
          { depth },
        ),
        ticketKind: "CARD_PICK",
        ticketSource: "ZONE_TRIAL",
        bonusGoldAmount: 0,
      };

    case "RARE_MILESTONE_CLEARED":
      return {
        outcome: applyRareMilestoneReward(world, ev.rareIndex),
        ticketKind: "CARD_PICK",
        ticketSource: "ZONE_TRIAL",
        bonusGoldAmount: 0,
      };

    case "SURVIVE_MILESTONE":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "SURVIVE_1MIN_REWARD" },
          { depth },
        ),
        ticketKind: "CARD_PICK",
        ticketSource: "ZONE_TRIAL",
        bonusGoldAmount: 0,
      };

    case "OBJECTIVE_COMPLETED":
      return {
        outcome: handleRewardEvent(world.floorRewardBudget, { type: "OBJECTIVE_COMPLETED" }, { depth }),
        ticketKind: "RELIC_PICK",
        ticketSource: "OBJECTIVE_COMPLETION",
        bonusGoldAmount: OBJECTIVE_COMPLETION_GOLD,
      };

    case "LEVEL_UP":
      return {
        outcome: { type: "GRANT_CARD", reason: `Level ${ev.level} reward` },
        ticketKind: "CARD_PICK",
        ticketSource: "LEVEL_UP",
        bonusGoldAmount: 0,
      };

    case "CHEST_OPEN_REQUESTED":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "CHEST_OPENED", chestKind: ev.chestKind },
          { depth },
        ),
        ticketKind: "CARD_PICK",
        ticketSource: ev.chestKind === "BOSS" ? "BOSS_CHEST" : "ZONE_TRIAL",
        bonusGoldAmount: 0,
      };

    default:
      return {
        outcome: { type: "NO_REWARD", reason: "Unhandled run event" },
        ticketKind: "CARD_PICK",
        ticketSource: "ZONE_TRIAL",
        bonusGoldAmount: 0,
      };
  }
}

function appendZoneRewardClaim(world: World, claimKey: string): void {
  world.zoneRewardClaimedKey = claimKey;
  if (!Array.isArray(world.zoneRewardClaimedKeys)) world.zoneRewardClaimedKeys = [];
  if (!world.zoneRewardClaimedKeys.includes(claimKey)) world.zoneRewardClaimedKeys.push(claimKey);
}

export function rewardSchedulerSystem(world: World): void {
  for (;;) {
    const ev = shiftRunEvent(world);
    if (!ev) return;

    const claimKey = claimKeyForRunEvent(world, ev);
    if (hasRewardClaimKey(world, claimKey)) continue;

    const plan = rewardPlanForRunEvent(world, ev);

    if (import.meta.env.DEV && !!(world as any)?.debug?.rewardPipelineLogs) {
      console.debug("[rewardScheduler]", {
        event: ev.type,
        claimKey,
        outcome: plan.outcome.type,
        ticketKind: plan.outcome.type === "GRANT_CARD" || plan.outcome.type === "GRANT_RELIC"
          ? plan.ticketKind
          : null,
      });
    }

    // Claim once scheduler has decided the outcome. This prevents event replay loss.
    addRewardClaimKey(world, claimKey);
    world.lastCardRewardClaimKey = claimKey;

    if (ev.type === "OBJECTIVE_COMPLETED") {
      world.objectiveRewardClaimedKey = claimKey;
    }
    if (ev.type === "ZONE_CLEARED" || ev.type === "RARE_MILESTONE_CLEARED") {
      appendZoneRewardClaim(world, claimKey);
    }

    if (plan.bonusGoldAmount > 0) {
      addGold(world, plan.bonusGoldAmount);
    }

    if (plan.outcome.type === "GRANT_GOLD") {
      addGold(world, plan.outcome.amount);
      continue;
    }

    if (plan.outcome.type !== "GRANT_CARD" && plan.outcome.type !== "GRANT_RELIC") {
      continue;
    }

    enqueueRewardTicket(world, {
      claimKey,
      kind: plan.ticketKind,
      source: plan.ticketSource,
      optionCount: DEFAULT_OPTION_COUNT,
    });
  }
}
