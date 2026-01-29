# Changelog

All notable changes to **Rat Noir Survivors** are documented here.  
This project is under active development; versions are **slice-based**, not strict semantic releases.

## [v0.5.0] — Full Run Loop, Bosses & Content Expansion

> **v0.5 goal achieved:** Rat Noir Survivors now supports a *complete run* with floors, bosses, win/lose states, expanded weapons, and finalized visuals.

### Added
- **Full run structure with floors**
  - Multi-floor progression system
  - Floor transitions integrated into the core game loop
- **Boss encounters**
  - Dedicated boss entities per floor
  - Boss logic integrated into run progression
- **Run map (`runMap`, formerly `actGraph`)**
  - Slay-the-Spire–style run map abstraction
  - Stabilized and integrated into run flow
- **Proper run end states**
  - **Run Complete** screen
  - **Game Over** screen
- **Bazooka weapon**
  - Heavy projectile weapon
  - **Bazooka evolution** featuring wave-based / chained explosions
- **Bouncer weapon**
  - Bouncing projectile mechanics
  - Bank-shot–style behavior
- **Weapons & items HUD**
  - On-screen display of active weapons and items
- **Player sprite implementation**
- **Enemy sprite implementation**
  - Multi-scale enemy rendering
- **Projectile sprites**
  - Dedicated visual assets for projectiles
- **Seamless scrolling backgrounds**

### Changed
- Knife evolution balance pass
- Pistol evolution balance pass
- Syringe balance adjustments
- Sword melee cone restored and corrected
- **Run map refactor**
  - `actGraph` renamed to `runMap`
  - Internal logic corrected and cleaned up
- General visual and gameplay polish
  - Sprite alignment tweaks
  - Minor system-level refinements

### Fixed
- Broken run map behavior during early WIP phase
- Refactor regressions introduced during `actGraph` → `runMap` transition
- Assorted weapon behavior edge cases discovered during v0.5 testing

### Notes
- v0.5 marks the transition from a **technical slice** to a **fully playable roguelike loop**
- All core pillars are now present:
  - Floors
  - Bosses
  - Weapon evolutions
  - Clear win / loss states
- Future slices can now focus on **depth, variation, and meta-progression**, not structural foundations





---

## [v0.4.0] — Current Slice (Architecture & Combat Consolidation)

### Added
- Starter weapon selection screen (including evolved weapons for testing)
- Syringe evolution: **Chain Syringe** (poison explosions that can chain)
- Molotov ground damage zones
- Aura-based weapons and damage-over-time systems
- Garlic-style persistent area damage
- Zone system decoupled from projectiles
- Explicit weapon ordering on the start screen

### Changed
- Centralized hit detection logic (WIP, partial unification)
- Zones now reuse shared hit detection helpers
- Explosion logic refactored to support chaining via poison state
- Sword melee cone behavior stabilized by locking direction at spawn
- XP and stats systems decentralized into dedicated entities
- Registry integration completed for weapons and projectiles
- Weapon/projectile logic cleaned up and made more data-driven
- Balance pass on fire / poison / explosion interactions

### Fixed
- Sword double-cone animation bug
- Melee collision inconsistencies
- Weapon order mismatch in starter UI
- Restored hit damage after projectile refactor regressions

---

## [v0.3.2] — Modular Content Expansion

### Added
- Weapons and items fully modularized
- Knife evolution (ring / cyclone behavior)
- Pistol evolution (spiral firing pattern)
- Factories for enemies, projectiles, and pickups
- Event-driven XP drops and enemy death handling

### Changed
- Major projectile logic overhaul
- Stats system split into a separate entity
- Registry system finalized for content lookup
- Refactored combat system to rely on events

### Fixed
- Removed unused / legacy stat handling
- Cleaned up duplicate registry logic

---

## [v0.3.1] — Foundations Cleanup

### Added
- Initial registry implementation
- Weapon picker (early version)
- Basic evolutions framework

### Changed
- Ignored IDE workspace files
- Cleaned up gitignore rules
- Removed unused functions and dead code

---

## [v0.3.0] — Initial Modular Slice

### Added
- Data-driven weapons and items
- ECS-lite system structure
- Event queue for decoupled system communication
- Canvas-based rendering pipeline
- Basic enemy spawning and combat
- XP pickups and leveling

### Changed
- Project structure stabilized
- Early balance tuning

---

## Notes

- Versions prior to **v0.3** are considered pre-slice experiments.
- The project intentionally prioritizes **architectural clarity over content volume**.
- Future slices will focus on:
    - Bosses & multi-phase enemies
    - Floors, zones, and faction control
    - Further hit detection unification
    - Performance scaling for large enemy counts
