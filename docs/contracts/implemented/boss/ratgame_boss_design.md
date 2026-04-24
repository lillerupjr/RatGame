# RatGame Boss Ability System (WIP Design)

*Last updated: 2026-04-05T19:00:00.684616*

------------------------------------------------------------------------

## 🧠 Core Philosophy

Boss abilities are **spatial-temporal patterns**, not just actions.

> The boss does not kill the player --- the **arena does**.

Abilities are built around: - Space control - Movement pressure - Clear
telegraphing - Rhythm (pressure vs release)

------------------------------------------------------------------------

## 🎯 Design Goals

-   Clean separation from enemy systems
-   Reusable ability framework
-   Tile-driven mechanics (primary system)
-   Auto-aim compatible gameplay
-   Highly readable combat

------------------------------------------------------------------------

## 🧱 Ability Categories

### 1. Boss Cast

-   Origin: boss position
-   Examples: flamethrower, radial burst

### 2. World Cast (Tile-driven)

-   Origin: tile grid
-   Examples: checkerboard, rings, poison zones

### 3. Target Cast

-   Origin: player or dynamic position
-   Examples: drop poison at player

### 4. Hybrid Cast

-   Boss triggers → world pattern executes

------------------------------------------------------------------------

## 🔄 Ability Lifecycle

Each ability follows:

1.  Telegraph
2.  Active
3.  Resolve
4.  Cooldown

------------------------------------------------------------------------

## 🟩 Tile System

### Tile Effect Model

    type TileEffect = {
      type: "poison" | "warning" | "safe" | "damage";
      duration: number;
      intensity?: number;
    };

### Visual Language

-   Green → poison
-   Red → danger imminent
-   Yellow → safe

------------------------------------------------------------------------

## 🔥 Pattern Library

### Concentric Rings

-   Expanding danger zones
-   Forces movement

### Checkerboard

-   Alternating safe/unsafe tiles
-   Can flip states

### Line Sweeps

-   Rows activate sequentially

### Safe Zones

-   Limited safe areas

### Persistent Zones

-   Long-lived hazards

### Target Drops

-   Delayed player-targeted hazards

------------------------------------------------------------------------

## 🎬 Animation Hooks

### Boss Animation

    animation: {
      castStart?: string;
      loop?: string;
      resolve?: string;
    }

### Tile Animation

    tileVisual: {
      telegraphColor: string;
      activeColor: string;
      pulse?: boolean;
    }

------------------------------------------------------------------------

## 🧪 First Boss (Hazmat Rat)

### Identity

Area control + poison

### Core Abilities

1.  Flamethrower (boss_cast)
2.  Expanding Gas Ring (world_cast)
3.  Poison Drop (target_cast)
4.  Checkerboard Pulse (world_cast)

------------------------------------------------------------------------

## ⚠️ Constraints

-   Always telegraph
-   Avoid pattern overload
-   Maintain readability
-   Keep move set small (3--5 abilities)

------------------------------------------------------------------------

## 🧠 Key Insight

> The fight is about **where the player can stand**

------------------------------------------------------------------------

## 🚀 Next Steps

-   Implement BossAbilityDefinition
-   Build tile effect system
-   Add animation hooks
-   Create first boss encounter
