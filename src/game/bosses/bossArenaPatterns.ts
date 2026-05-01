import type { ArenaCell, BossArena } from "./bossArena";
import { collectPlayableArenaCells, isBossArenaCellPlayable } from "./bossArena";
import {
  ArenaPatternKind,
  type ArenaPatternKind as ArenaPatternKindId,
  type CheckerboardPatternParams,
  type InwardCollapsePatternParams,
  type SnakePatternParams,
} from "./bossArenaTypes";

export type ArenaPatternParams =
  | CheckerboardPatternParams
  | SnakePatternParams
  | InwardCollapsePatternParams;

function uniqueArenaCells(cells: ArenaCell[]): ArenaCell[] {
  const seen = new Set<string>();
  const next: ArenaCell[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(cell);
  }
  return next;
}

export function generateCheckerboardPattern(
  arena: BossArena,
  params: CheckerboardPatternParams,
): ArenaCell[] {
  return collectPlayableArenaCells(arena).filter((cell) => ((cell.x + cell.y) & 1) === params.parity);
}

export function generateSnakePattern(
  arena: BossArena,
  params: SnakePatternParams,
): ArenaCell[] {
  const bandHeight = Math.max(1, Math.floor(params.bandHeightCells));
  const segmentWidth = Math.max(1, Math.min(arena.width, Math.floor(params.segmentWidthCells)));
  const step = Math.max(1, Math.floor(params.horizontalStepCells));
  const maxStartX = Math.max(0, arena.width - segmentWidth);
  let currentStartX = Math.max(0, Math.min(maxStartX, Math.floor(params.startX)));
  let direction = params.initialDirection === "left" ? -1 : 1;
  const cells: ArenaCell[] = [];

  for (let bandStartY = 0; bandStartY < arena.height; bandStartY += bandHeight) {
    const segmentEndX = Math.min(arena.width - 1, currentStartX + segmentWidth - 1);
    const bandEndY = Math.min(arena.height - 1, bandStartY + bandHeight - 1);
    for (let y = bandStartY; y <= bandEndY; y++) {
      for (let x = currentStartX; x <= segmentEndX; x++) {
        const cell = { x, y };
        if (!isBossArenaCellPlayable(arena, cell)) continue;
        cells.push(cell);
      }
    }

    let nextStartX = currentStartX + direction * step;
    if (nextStartX < 0 || nextStartX > maxStartX) {
      direction *= -1;
      nextStartX = currentStartX + direction * step;
    }
    currentStartX = Math.max(0, Math.min(maxStartX, nextStartX));
  }

  return uniqueArenaCells(cells);
}

export function generateInwardCollapsePattern(
  arena: BossArena,
  params: InwardCollapsePatternParams,
): ArenaCell[] {
  const ringStart = Math.max(0, Math.floor(params.ringIndex) * Math.max(1, Math.floor(params.ringWidthCells)));
  const ringEnd = ringStart + Math.max(1, Math.floor(params.ringWidthCells)) - 1;
  return collectPlayableArenaCells(arena).filter((cell) => {
    const minEdgeDistance = Math.min(
      cell.x,
      cell.y,
      arena.width - 1 - cell.x,
      arena.height - 1 - cell.y,
    );
    return minEdgeDistance >= ringStart && minEdgeDistance <= ringEnd;
  });
}

export function generateArenaPattern(
  arena: BossArena,
  patternKind: ArenaPatternKindId,
  params: ArenaPatternParams,
): ArenaCell[] {
  switch (patternKind) {
    case ArenaPatternKind.CHECKERBOARD:
      return generateCheckerboardPattern(arena, params as CheckerboardPatternParams);
    case ArenaPatternKind.SNAKE:
      return generateSnakePattern(arena, params as SnakePatternParams);
    case ArenaPatternKind.INWARD_COLLAPSE:
      return generateInwardCollapsePattern(arena, params as InwardCollapsePatternParams);
  }
}
