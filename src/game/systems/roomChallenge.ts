// src/game/systems/roomChallenge.ts
//
// Room Challenge System
// Tracks player position relative to rooms and manages kill-count challenges
// that lock room exits until a certain number of enemies are defeated.

import { World, emitEvent } from "../world";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { getPlayerWorld } from "../coords/worldViews";

/**
 * Convert world coordinates to tile coordinates.
 */
function worldToTile(wx: number, wy: number, tileSize: number): { tx: number; ty: number } {
    return {
        tx: Math.floor(wx / tileSize),
        ty: Math.floor(wy / tileSize),
    };
}

/**
 * Check if a tile position is inside a room's bounds.
 */
function isInsideRoom(
    tx: number,
    ty: number,
    room: { cx: number; cy: number; width: number; height: number }
): boolean {
    const halfW = Math.floor(room.width / 2);
    const halfH = Math.floor(room.height / 2);
    
    return (
        tx >= room.cx - halfW &&
        tx <= room.cx + halfW &&
        ty >= room.cy - halfH &&
        ty <= room.cy + halfH
    );
}

/**
 * Find which room the player is currently in.
 * Returns -1 if player is not in any room (e.g., in a corridor).
 */
function findCurrentRoom(w: World): number {
    if (!w.roomData || w.roomData.length === 0) return -1;
    
    const tileSize = KENNEY_TILE_WORLD;
    const pw = getPlayerWorld(w, tileSize);
    const { tx, ty } = worldToTile(pw.wx, pw.wy, tileSize);
    
    for (const room of w.roomData) {
        if (isInsideRoom(tx, ty, room)) {
            return room.id;
        }
    }
    
    return -1;
}

/**
 * Room Challenge System
 * 
 * Called each frame to:
 * 1. Track which room the player is in
 * 2. Activate challenges when entering a new room
 * 3. Update challenge progress (kills are tracked elsewhere)
 * 4. Unlock room when challenge is complete
 */
/** Track room entry/exit and update challenge state. */
export function roomChallengeSystem(w: World, dt: number): void {
    // Skip if no room data is loaded
    if (!w.roomData || w.roomData.length === 0) return;
    
    const newRoomId = findCurrentRoom(w);
    
    // Player entered a new room (only trigger on actual room changes, not corridors)
    // We only update currentRoomId when entering an actual room, not when in corridors
    if (newRoomId !== -1 && newRoomId !== w.currentRoomId) {
        const room = w.roomData.find(r => r.id === newRoomId);
        
        if (room && room.challengeType === "KILL_COUNT" && room.killsRequired > 0) {
            // Activate the challenge
            w.roomChallengeActive = true;
            w.roomChallengeKillsNeeded = room.killsRequired;
            w.roomChallengeKillsCount = 0;
            w.roomChallengeLocked = true;
            
            // Emit event for UI/audio feedback
            emitEvent(w, {
                type: "SFX",
                id: "FLOOR_START", // Reuse existing sound for now
                vol: 0.5,
            });
        } else {
            // Room has no challenge - clear any active challenge state
            w.roomChallengeActive = false;
            w.roomChallengeKillsNeeded = 0;
            w.roomChallengeKillsCount = 0;
            w.roomChallengeLocked = false;
        }
        
        // Only update current room tracking when entering an actual room
        w.currentRoomId = newRoomId;
    }
    // Note: We intentionally do NOT update currentRoomId when in corridors (-1)
    // This prevents challenge state from being lost when briefly passing through corridors
    
    // Check if challenge is complete
    if (w.roomChallengeActive && w.roomChallengeKillsCount >= w.roomChallengeKillsNeeded) {
        w.roomChallengeActive = false;
        w.roomChallengeLocked = false;
        
        // Emit completion event for UI/audio feedback
        emitEvent(w, {
            type: "SFX",
            id: "LEVEL_UP", // Reuse level up sound for challenge completion
            vol: 0.6,
        });
    }
}

/**
 * Called when an enemy is killed to update challenge progress.
 * Should be called from places where w.kills++ happens.
 */
/** Increment challenge kill counts when active. */
export function onEnemyKilledForChallenge(w: World): void {
    if (w.roomChallengeActive && w.roomChallengeLocked) {
        w.roomChallengeKillsCount++;
    }
}

/**
 * Check if the player can exit the current room.
 * Used by movement system to block exits during active challenges.
 */
/** Return true if exiting the current room is allowed. */
export function canExitRoom(w: World, newTx: number, newTy: number): boolean {
    // If no challenge is active or room isn't locked, allow movement
    if (!w.roomChallengeActive || !w.roomChallengeLocked) return true;
    
    // If no room data, allow movement
    if (!w.roomData || w.roomData.length === 0) return true;
    
    // Find the current room
    const currentRoom = w.roomData.find(r => r.id === w.currentRoomId);
    if (!currentRoom) return true;
    
    // Check if the new position is still inside the current room
    // If so, allow the movement
    if (isInsideRoom(newTx, newTy, currentRoom)) {
        return true;
    }
    
    // Player is trying to leave a locked room - block the movement
    return false;
}

/**
 * Initialize room data from procedural map generation result.
 * Call this when loading a new procedural map.
 */
/** Initialize room challenge metadata from map rooms. */
export function initializeRoomChallenges(
    w: World,
    rooms: { 
        id: number; 
        cx: number; 
        cy: number; 
        width: number; 
        height: number;
        level: number;
        challenge: { type: string; killsRequired: number };
    }[]
): void {
    w.roomData = rooms.map(r => ({
        id: r.id,
        cx: r.cx,
        cy: r.cy,
        width: r.width,
        height: r.height,
        level: r.level,
        challengeType: r.challenge.type,
        killsRequired: r.challenge.killsRequired,
    }));
    
    // Reset challenge state
    // Set currentRoomId to spawn room (id 0) so we don't trigger on first frame
    // The spawn room should have no challenge (challengeType: "NONE")
    w.currentRoomId = rooms.length > 0 ? rooms[0].id : -1;
    w.roomChallengeActive = false;
    w.roomChallengeKillsNeeded = 0;
    w.roomChallengeKillsCount = 0;
    w.roomChallengeLocked = false;
}

/**
 * Get the current challenge progress for UI display.
 */
/** Return current challenge progress for UI. */
export function getChallengeProgress(w: World): { 
    active: boolean; 
    kills: number; 
    needed: number;
    locked: boolean;
} {
    return {
        active: w.roomChallengeActive,
        kills: w.roomChallengeKillsCount,
        needed: w.roomChallengeKillsNeeded,
        locked: w.roomChallengeLocked,
    };
}
