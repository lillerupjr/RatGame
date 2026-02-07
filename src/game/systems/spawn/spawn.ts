import { type World } from "../../../engine/world/world";
import { spawnEnemyGrid, ENEMY_TYPE } from "../../factories/enemyFactory";
import type { EnemyType } from "../../factories/enemyFactory";
import { floorForIndex, pickFloorEnemyType } from "../../content/floors";
import { walkInfo } from "../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { worldToGrid } from "../../coords/grid";
import { getPlayerWorld } from "../../coords/worldViews";
import { OBJECTIVE_TRIGGER_IDS } from "../progression/objectiveSpec";

/**
 * Spawning system:
 * - Executes one-time timeline spawns from the stage definition.
 * - Handles a floor-configurable trickle spawn (cadence, counts, weighted mix).
 *
 * Milestone B:
 * - Spawns must respect tile walk logic (no void, no outside top-face diamond).
 * - Spawns must respect active floor height (avoid unreachable mobs on other platforms).
 */
/** Handle stage timeline spawns and floor trickle spawns. */
export function spawnSystem(w: World, dt: number) {
  // Floors only (no spawns during boss/transition)
  if (w.runState !== "FLOOR") return;
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;

  const isObjectiveCompleted = (id: string) => {
    for (let i = 0; i < w.objectiveStates.length; i++) {
      if (w.objectiveStates[i]?.id !== id) continue;
      return w.objectiveStates[i].status === "COMPLETED";
    }
    return false;
  };

  const overlayZones = (prefix: string) => {
    const defs = w.overlayTriggerDefs ?? [];
    const zones: Array<{ x: number; y: number }> = [];
    for (const def of defs) {
      if (!def.id.startsWith(prefix)) continue;
      if (def.type !== "radius" && def.type !== "kill") continue;
      zones.push({
        x: (def.tx + 0.5) * KENNEY_TILE_WORLD,
        y: (def.ty + 0.5) * KENNEY_TILE_WORLD,
      });
    }
    return zones;
  };

  let spawnBases: Array<{ x: number; y: number }> = [{ x: px, y: py }];
  if (w.floorArchetype === "VENDOR" || w.floorArchetype === "HEAL") {
    return;
  }
  if (w.floorArchetype === "TIME_TRIAL") {
    spawnBases = overlayZones(OBJECTIVE_TRIGGER_IDS.zonePrefix);
  } else if (w.floorArchetype === "BOSS_TRIPLE") {
    if (isObjectiveCompleted("OBJ_BOSS_RARES")) return;
    spawnBases = overlayZones(OBJECTIVE_TRIGGER_IDS.bossZonePrefix);
  }
  if (spawnBases.length === 0) return;

  const pickBase = () => spawnBases[w.rng.int(0, spawnBases.length - 1)];

  const isTimeTrial = w.floorArchetype === "TIME_TRIAL";
  const isBossTriple = w.floorArchetype === "BOSS_TRIPLE";

  if (w.floorArchetype === "SURVIVE") {
    const remain = w.floorDuration - w.phaseTime;
    if (remain <= 30 && !(w as any)._surviveBossSpawned) {
      const angle = w.rng.range(0, Math.PI * 2);
      const radius = w.rng.range(320, 520);
      const baseX = px + Math.cos(angle) * radius;
      const baseY = py + Math.sin(angle) * radius;
      const p = findSpawnPoint(baseX, baseY, 18);
      const spawn = p ?? { x: px, y: py };
      const gp = worldToGrid(spawn.x, spawn.y, KENNEY_TILE_WORLD);
      spawnEnemyGrid(w, ENEMY_TYPE.BOSS, gp.gx, gp.gy, KENNEY_TILE_WORLD);
      (w as any)._surviveBossSpawned = true;
    }
  }

  // Spawn zone: tiles reachable from player within N steps (guarantees a path).
  const findSpawnPoint = (baseX: number, baseY: number, maxTries: number) => {
    const T = KENNEY_TILE_WORLD;

    const isConnectorish = (info: any) =>
        !!(info as any).isRamp || info.kind === "STAIRS";

    const keyOf = (tx: number, ty: number) => (tx & 0xffff) | ((ty & 0xffff) << 16);

    const tileCenter = (tx: number, ty: number) => ({
      x: (tx + 0.5) * T,
      y: (ty + 0.5) * T,
    });

    // --- 1) Walk tiles from player (bounded BFS depth = 10) ---
    const p0 = walkInfo(px, py, T);
    const startTx = p0.tx | 0;
    const startTy = p0.ty | 0;

    const MAX_STEPS = 10;          // <-- your requested radius in tiles
    const MAX_STEP_Z = 1.05;       // keep consistent with movement transitions

    const visited = new Set<number>();
    const tiles: Array<{ tx: number; ty: number; d: number }> = [];

    const q: Array<{ tx: number; ty: number; d: number; info: any }> = [];
    q.push({ tx: startTx, ty: startTy, d: 0, info: p0 });

    const dirs: Array<[number, number]> = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];

    while (q.length > 0) {
      const cur = q.shift()!;
      const k = keyOf(cur.tx, cur.ty);
      if (visited.has(k)) continue;
      visited.add(k);

      // Only include walkable tiles (tile center)
      const c = tileCenter(cur.tx, cur.ty);
      const cInfo = cur.info ?? walkInfo(c.x, c.y, T);
      if (!cInfo.walkable) continue;

      tiles.push({ tx: cur.tx, ty: cur.ty, d: cur.d });

      if (cur.d >= MAX_STEPS) continue;

      for (const [ox, oy] of dirs) {
        const nx = cur.tx + ox;
        const ny = cur.ty + oy;

        const nk = keyOf(nx, ny);
        if (visited.has(nk)) continue;

        const nc = tileCenter(nx, ny);
        const nInfo = walkInfo(nc.x, nc.y, T);
        if (!nInfo.walkable) continue;

        // Height/connector rules:
        // - same floor ok
        // - different floor only if connectorish involved and dz not too big
        if ((nInfo.floorH | 0) !== (cInfo.floorH | 0)) {
          if (!isConnectorish(cInfo) && !isConnectorish(nInfo)) continue;
          const dz = Math.abs((nInfo.z ?? nInfo.floorH) - (cInfo.z ?? cInfo.floorH));
          if (dz > MAX_STEP_Z) continue;
        }

        q.push({ tx: nx, ty: ny, d: cur.d + 1, info: nInfo });
      }
    }

    if (tiles.length === 0) return null;

    // --- 2) From reachable tiles, pick one near the ring base point ---
    // Convert base world point -> base tile (using walkInfo, which gives tx/ty)
    const baseInfo = walkInfo(baseX, baseY, T);
    const baseTx = baseInfo.tx | 0;
    const baseTy = baseInfo.ty | 0;

    // Optional: keep spawns from appearing too close to player
    const MIN_D = 4;

    // Optional: avoid spawning directly on STAIRS (as before)
    const AVOID_STAIRS = true;

    // Find best reachable tile "closest to ring base tile"
    let best: { tx: number; ty: number; score: number } | null = null;

    for (let t = 0; t < tiles.length; t++) {
      const it = tiles[t];
      if (it.d < MIN_D) continue;

      const c = tileCenter(it.tx, it.ty);
      const info = walkInfo(c.x, c.y, T);
      if (!info.walkable) continue;

      if (AVOID_STAIRS && info.kind === "STAIRS") continue;

      const dx = it.tx - baseTx;
      const dy = it.ty - baseTy;
      const score = dx * dx + dy * dy; // squared tile distance

      if (!best || score < best.score) best = { tx: it.tx, ty: it.ty, score };
    }

    if (!best) return null;

    // --- 3) Jitter around chosen tile center (your existing behavior) ---
    const center = tileCenter(best.tx, best.ty);

    for (let t = 0; t < maxTries; t++) {
      const j = 18 + t * 6;
      const x = center.x + w.rng.range(-j, j);
      const y = center.y + w.rng.range(-j, j);

      const info = walkInfo(x, y, T);
      if (!info.walkable) continue;
      if (AVOID_STAIRS && info.kind === "STAIRS") continue;

      return { x, y };
    }

    // Fall back to exact center if jitter couldn’t find a clean spot
    return { x: center.x, y: center.y };
  };


  const stage = w.stage;
  if (!stage) return; // no stage loaded yet (MENU/INIT/etc.)

// Run stage timeline spawns once (validated)
  for (const s of stage.spawns) {

    if ((s as any).t === Infinity) continue;

    if (w.phaseTime >= s.t) {
      const count = isTimeTrial ? Math.max(1, Math.ceil(s.count * 0.5)) : s.count;
      for (let k = 0; k < count; k++) {
        const origin = pickBase();
        const angle = w.rng.range(0, Math.PI * 2);
        const radius = w.rng.range(s.radius * 0.8, s.radius);
        const baseX = origin.x + Math.cos(angle) * radius;
        const baseY = origin.y + Math.sin(angle) * radius;

        const p = findSpawnPoint(baseX, baseY, 18);
        if (!p) continue;

        const gp = worldToGrid(p.x, p.y, KENNEY_TILE_WORLD);
        spawnEnemyGrid(w, s.type as EnemyType, gp.gx, gp.gy, KENNEY_TILE_WORLD);
      }
      (s as any).t = Infinity;
    }
  }

  // Floor-specific trickle spawn
  const floor = floorForIndex(w.floorIndex ?? 0);

  // Apply delve spawn rate scaling
  const spawnRateMult = w.delveScaling?.spawnRateMult ?? 1;
  const cadenceBase = floor.spawns.cadence / spawnRateMult;
  const cadence = Math.max(0.02, isBossTriple ? cadenceBase * 2 : cadenceBase);
  (w as any)._spawnAcc = ((w as any)._spawnAcc ?? 0) + dt;

  while ((w as any)._spawnAcc >= cadence) {
    (w as any)._spawnAcc -= cadence;

    const perTickMax = isTimeTrial
      ? Math.max(floor.spawns.perTickMin, Math.floor(floor.spawns.perTickMax * 0.5))
      : floor.spawns.perTickMax;
    const n = w.rng.int(floor.spawns.perTickMin, perTickMax);

    for (let i = 0; i < n; i++) {
      const type = pickFloorEnemyType(w);

      const origin = pickBase();
      const angle = w.rng.range(0, Math.PI * 2);
      const radius = w.rng.range(floor.spawns.ringMin, floor.spawns.ringMax);
      const baseX = origin.x + Math.cos(angle) * radius;
      const baseY = origin.y + Math.sin(angle) * radius;

      const p = findSpawnPoint(baseX, baseY, 18);
      if (!p) continue;

      const gp = worldToGrid(p.x, p.y, KENNEY_TILE_WORLD);
      spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
    }
  }
}
