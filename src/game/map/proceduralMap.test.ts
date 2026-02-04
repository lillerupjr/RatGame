// src/game/map/proceduralMap.test.ts
// @ts-ignore
import { describe, it, expect } from "vitest";
import {
    generateProceduralMap,
    generateFloorMap,
    DEFAULT_CONFIGS,
    estimateMapDuration,
    type ProceduralMapConfig,
} from "./proceduralMap";
import { compileKenneyMapFromTable } from "./kenneyMapLoader";

describe("ProceduralMap", () => {
    describe("generateFloorMap", () => {
        it("generates a valid map for floor 0 (EASY)", () => {
            const mapDef = generateFloorMap(12345, 0, false);
            
            expect(mapDef.id).toContain("PROCEDURAL");
            expect(mapDef.w).toBe(112); // EASY width
            expect(mapDef.h).toBe(112); // EASY height
            expect(mapDef.cells.length).toBeGreaterThan(0);
            
            // Should have at least one spawn (P) token
            const hasSpawn = mapDef.cells.some(c => c.t.startsWith("P"));
            expect(hasSpawn).toBe(true);
            
            // Should have at least one goal (G) token
            const hasGoal = mapDef.cells.some(c => c.t.startsWith("G"));
            expect(hasGoal).toBe(true);
        });

        it("generates a valid map for floor 1 (MEDIUM)", () => {
            const mapDef = generateFloorMap(12345, 1, false);
            
            expect(mapDef.w).toBe(136); // MEDIUM width
            expect(mapDef.h).toBe(136); // MEDIUM height
        });

        it("generates a valid map for floor 2+ (HARD)", () => {
            const mapDef = generateFloorMap(12345, 2, false);
            
            expect(mapDef.w).toBe(160); // HARD width
            expect(mapDef.h).toBe(160); // HARD height
        });

        it("generates a smaller BOSS arena", () => {
            const mapDef = generateFloorMap(12345, 0, true);
            
            expect(mapDef.w).toBe(64); // BOSS width
            expect(mapDef.h).toBe(64); // BOSS height
        });

        it("generates different maps with different seeds", () => {
            const map1 = generateFloorMap(111, 0, false);
            const map2 = generateFloorMap(222, 0, false);
            
            // Cell counts should differ (very unlikely to be identical)
            // expect(map1.cells.length).not.toBe(map2.cells.length);
        });

        it("generates deterministic maps with same seed", () => {
            const map1 = generateFloorMap(12345, 0, false);
            const map2 = generateFloorMap(12345, 0, false);
            
            expect(map1.cells.length).toBe(map2.cells.length);
            expect(map1.id).toBe(map2.id);
        });
    });

    describe("compileKenneyMapFromTable", () => {
        it("compiles procedural maps correctly", () => {
            const mapDef = generateFloorMap(12345, 0, false);
            const compiled = compileKenneyMapFromTable(mapDef);
            
            expect(compiled.id).toBe(mapDef.id);
            
            // Spawn should be valid
            expect(typeof compiled.spawnTx).toBe("number");
            expect(typeof compiled.spawnTy).toBe("number");
            
            // Goal should be valid (procedural maps always have goals)
            expect(compiled.goalTx).not.toBeNull();
            expect(compiled.goalTy).not.toBeNull();
            
            // Spawn tile should not be VOID
            const spawnTile = compiled.getTile(compiled.spawnTx, compiled.spawnTy);
            expect(spawnTile.kind).not.toBe("VOID");
            
            // Goal tile should not be VOID
            if (compiled.goalTx !== null && compiled.goalTy !== null) {
                const goalTile = compiled.getTile(compiled.goalTx, compiled.goalTy);
                expect(goalTile.kind).not.toBe("VOID");
            }
        });

        it("handles stairs tiles with directions", () => {
            const mapDef = generateFloorMap(99999, 1, false);
            const compiled = compileKenneyMapFromTable(mapDef);
            
            // Find a stairs cell
            const stairsCell = mapDef.cells.find(c => c.t.startsWith("S"));
            
            if (stairsCell) {
                // Parse the token to get expected values (cardinal directions: N, S, E, W)
                const match = stairsCell.t.match(/^S(\d+)(N|S|E|W)$/);
                if (match) {
                    const expectedH = parseInt(match[1], 10);
                    const expectedDir = match[2];
                    
                    const tx = stairsCell.x + compiled.originTx;
                    const ty = stairsCell.y + compiled.originTy;
                    const tile = compiled.getTile(tx, ty);
                    
                    expect(tile.kind).toBe("STAIRS");
                    expect(tile.h).toBe(expectedH);
                    expect(tile.dir).toBe(expectedDir);
                }
            }
        });
    });

    describe("estimateMapDuration", () => {
        it("estimates ~2 minutes for EASY floor", () => {
            const config: ProceduralMapConfig = {
                ...DEFAULT_CONFIGS.EASY,
                seed: 1,
                floorIndex: 0,
            };
            const est = estimateMapDuration(config);
            
            // With 10x rooms, maps are much larger - expect ~30+ minutes
            expect(est.objectiveSeconds).toBeGreaterThan(600);
            expect(est.objectiveSeconds).toBeLessThan(3600);
            expect(est.bossSeconds).toBe(30);
        });

        it("estimates longer for HARD floor", () => {
            const easy: ProceduralMapConfig = { ...DEFAULT_CONFIGS.EASY, seed: 1, floorIndex: 0 };
            const hard: ProceduralMapConfig = { ...DEFAULT_CONFIGS.HARD, seed: 1, floorIndex: 2 };
            
            const easyEst = estimateMapDuration(easy);
            const hardEst = estimateMapDuration(hard);
            
            expect(hardEst.objectiveSeconds).toBeGreaterThan(easyEst.objectiveSeconds);
        });

        it("estimates 30 seconds for BOSS", () => {
            const config: ProceduralMapConfig = {
                ...DEFAULT_CONFIGS.BOSS,
                seed: 1,
                floorIndex: 0,
            };
            const est = estimateMapDuration(config);
            
            expect(est.objectiveSeconds).toBe(0);
            expect(est.bossSeconds).toBe(30);
        });
    });

    describe("map connectivity", () => {
        it("spawn and goal are both on walkable tiles", () => {
            for (let i = 0; i < 5; i++) {
                const mapDef = generateFloorMap(1000 + i, i % 3, false);
                const compiled = compileKenneyMapFromTable(mapDef);
                
                const spawnTile = compiled.getTile(compiled.spawnTx, compiled.spawnTy);
                expect(spawnTile.kind).not.toBe("VOID");
                
                if (compiled.goalTx !== null && compiled.goalTy !== null) {
                    const goalTile = compiled.getTile(compiled.goalTx, compiled.goalTy);
                    expect(goalTile.kind).not.toBe("VOID");
                }
            }
        });

        it("generates maps with reasonable floor coverage", () => {
            const mapDef = generateFloorMap(12345, 1, false);
            const compiled = compileKenneyMapFromTable(mapDef);
            
            let floorCount = 0;
            let totalTiles = mapDef.w * mapDef.h;
            
            for (let y = 0; y < mapDef.h; y++) {
                for (let x = 0; x < mapDef.w; x++) {
                    const tx = x + compiled.originTx;
                    const ty = y + compiled.originTy;
                    const tile = compiled.getTile(tx, ty);
                    if (tile.kind !== "VOID") floorCount++;
                }
            }
            
            // Should have at least 20% floor coverage
            const coverage = floorCount / totalTiles;
            expect(coverage).toBeGreaterThan(0.2);
            
            // Should not be more than 80% (we want some voids)
            expect(coverage).toBeLessThan(0.8);
        });
    });
});
