export type RewardTicketKind = "RELIC_PICK";
export type RewardTicketSource = "OBJECTIVE_COMPLETION";
export type RewardTicketStatus = "PENDING" | "ACTIVE" | "RESOLVED";

export type RewardTicket = {
  id: string;
  claimKey: string;
  kind: RewardTicketKind;
  source: RewardTicketSource;
  optionCount: number;
  status: RewardTicketStatus;
  createdSeq: number;
};

export function ensureRewardTicketQueue(world: any): RewardTicket[] {
  if (!Array.isArray(world.rewardTickets)) world.rewardTickets = [];
  return world.rewardTickets as RewardTicket[];
}

export function ensureRewardTicketState(world: any): void {
  ensureRewardTicketQueue(world);
  if (typeof world.activeRewardTicketId !== "string") world.activeRewardTicketId = null;
  if (!Number.isFinite(world.rewardTicketSeq)) world.rewardTicketSeq = 0;
}

function nextRewardTicketSeq(world: any): number {
  ensureRewardTicketState(world);
  world.rewardTicketSeq = (world.rewardTicketSeq | 0) + 1;
  return world.rewardTicketSeq;
}

export function enqueueRewardTicket(
  world: any,
  input: {
    claimKey: string;
    kind: RewardTicketKind;
    source: RewardTicketSource;
    optionCount: number;
  },
): RewardTicket {
  ensureRewardTicketState(world);
  const createdSeq = nextRewardTicketSeq(world);
  const ticket: RewardTicket = {
    id: `reward-ticket-${createdSeq}`,
    claimKey: input.claimKey,
    kind: input.kind,
    source: input.source,
    optionCount: input.optionCount,
    status: "PENDING",
    createdSeq,
  };
  world.rewardTickets.push(ticket);
  return ticket;
}

export function findRewardTicketById(world: any, ticketId: string | null | undefined): RewardTicket | null {
  if (!ticketId) return null;
  const tickets = ensureRewardTicketQueue(world);
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i].id === ticketId) return tickets[i];
  }
  return null;
}

export function findOldestPendingRewardTicket(world: any): RewardTicket | null {
  const tickets = ensureRewardTicketQueue(world);
  let best: RewardTicket | null = null;
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status !== "PENDING") continue;
    if (!best || ticket.createdSeq < best.createdSeq) best = ticket;
  }
  return best;
}

export function activateRewardTicket(world: any, ticket: RewardTicket): void {
  ensureRewardTicketState(world);
  ticket.status = "ACTIVE";
  world.activeRewardTicketId = ticket.id;
}

export function resolveRewardTicket(world: any, ticket: RewardTicket): void {
  ensureRewardTicketState(world);
  ticket.status = "RESOLVED";
  if (world.activeRewardTicketId === ticket.id) world.activeRewardTicketId = null;
}

export function resolveActiveRewardTicket(world: any): void {
  ensureRewardTicketState(world);
  const active = findRewardTicketById(world, world.activeRewardTicketId);
  if (!active) {
    world.activeRewardTicketId = null;
    return;
  }
  resolveRewardTicket(world, active);
}

export function ensureRewardClaimKeys(world: any): string[] {
  if (!Array.isArray(world.rewardClaimKeys)) world.rewardClaimKeys = [];
  return world.rewardClaimKeys as string[];
}

export function hasRewardClaimKey(world: any, claimKey: string): boolean {
  const keys = ensureRewardClaimKeys(world);
  return keys.includes(claimKey);
}

export function addRewardClaimKey(world: any, claimKey: string): void {
  const keys = ensureRewardClaimKeys(world);
  if (!keys.includes(claimKey)) keys.push(claimKey);
}
