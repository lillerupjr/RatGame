// src/game/systems/progression/triggerSystem.ts

import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getActiveMap } from "../../map/compile/kenneyMap";
import { getPlayerWorld } from "../../coords/worldViews";
import type { InputState } from "../sim/input";
import { instantiateTriggers, type TriggerInstance } from "../../triggers/triggerTypes";
import type { TriggerSignal } from "../../triggers/triggerSignals";
import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";
import { ENEMY_TYPE } from "../../content/enemies";

const PLAYER_ENTITY_ID = 0;
const DEFAULT_RADIUS_TILES = 0.5;

function emitTriggerSignal(world: World, signal: TriggerSignal) {
    world.triggerSignals.push(signal);
}

function ensureTriggerRegistry(world: World) {
    const map = getActiveMap();
    if (!map) {
        world.triggerRegistry = [];
        world.triggerMapId = null;
        world.triggerRegistryVersion = world.overlayTriggerVersion;
        return;
    }

    if (world.triggerMapId === map.id && world.triggerRegistryVersion === world.overlayTriggerVersion) return;

    const overlayDefs = world.overlayTriggerDefs ?? [];
    world.triggerRegistry = instantiateTriggers([...(map.triggerDefs ?? []), ...overlayDefs]);
    world.triggerMapId = map.id;
    world.triggerRegistryVersion = world.overlayTriggerVersion;
}

function isInsideRadius(
    trigger: TriggerInstance,
    entityX: number,
    entityY: number,
    tileWorld: number
): boolean {
    const radiusTiles = trigger.radius ?? DEFAULT_RADIUS_TILES;
    const radiusWorld = radiusTiles * tileWorld;
    const cx = (trigger.tx + 0.5) * tileWorld;
    const cy = (trigger.ty + 0.5) * tileWorld;
    const dx = entityX - cx;
    const dy = entityY - cy;
    return (dx * dx + dy * dy) <= (radiusWorld * radiusWorld);
}

function hasEntityId(trigger: TriggerInstance, entityId: number): boolean {
    return trigger.bookkeeping.insideEntityIds.includes(entityId);
}

function addEntityId(trigger: TriggerInstance, entityId: number) {
    trigger.bookkeeping.insideEntityIds.push(entityId);
}

function removeEntityId(trigger: TriggerInstance, entityId: number) {
    const idx = trigger.bookkeeping.insideEntityIds.indexOf(entityId);
    if (idx >= 0) {
        trigger.bookkeeping.insideEntityIds.splice(idx, 1);
    }
}

function updateEnterExit(
    world: World,
    trigger: TriggerInstance,
    entityId: number,
    entityX: number,
    entityY: number
) {
    const inside = isInsideRadius(trigger, entityX, entityY, KENNEY_TILE_WORLD);
    const wasInside = hasEntityId(trigger, entityId);

    if (inside && !wasInside) {
        addEntityId(trigger, entityId);
        emitTriggerSignal(world, { type: "ENTER", entityId, triggerId: trigger.id });
    } else if (!inside && wasInside) {
        removeEntityId(trigger, entityId);
        emitTriggerSignal(world, { type: "EXIT", entityId, triggerId: trigger.id });
    }
}

function updateInteractSignals(
    world: World,
    trigger: TriggerInstance,
    entityId: number,
    entityX: number,
    entityY: number,
    interactPressed: boolean
) {
    if (!interactPressed) return;
    if (trigger.type !== "radius") return;
    if (!isInsideRadius(trigger, entityX, entityY, KENNEY_TILE_WORLD)) return;
    emitTriggerSignal(world, { type: "INTERACT", entityId, triggerId: trigger.id });
}

function updateKillSignals(world: World, trigger: TriggerInstance) {
    if (trigger.type !== "kill") return;
    const requireBoss = trigger.id.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix);

    for (let i = 0; i < world.events.length; i++) {
        const ev = world.events[i];
        if (ev.type !== "ENEMY_KILLED") continue;
        if (requireBoss && world.eType[ev.enemyIndex] !== ENEMY_TYPE.BOSS) continue;
        if (!isInsideRadius(trigger, ev.x, ev.y, KENNEY_TILE_WORLD)) continue;
        emitTriggerSignal(world, { type: "KILL", entityId: ev.enemyIndex, triggerId: trigger.id });
    }
}

function updateTimerSignals(world: World, trigger: TriggerInstance, dt: number) {
    if (trigger.type !== "timer") return;
    emitTriggerSignal(world, { type: "TICK", dt, triggerId: trigger.id });
}

/** Update triggers and emit trigger signals for this frame. */
export function triggerSystem(world: World, dt: number, input: InputState): void {
    ensureTriggerRegistry(world);

    world.triggerSignals.length = 0;

    if (world.triggerRegistry.length === 0) return;

    const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);

    for (let i = 0; i < world.triggerRegistry.length; i++) {
        const trigger = world.triggerRegistry[i];
        if (trigger.type === "radius") {
            updateEnterExit(world, trigger, PLAYER_ENTITY_ID, playerWorld.wx, playerWorld.wy);
        }

        updateInteractSignals(world, trigger, PLAYER_ENTITY_ID, playerWorld.wx, playerWorld.wy, input.interactPressed);
        updateKillSignals(world, trigger);
        updateTimerSignals(world, trigger, dt);
    }
}
