# Renderer Command Inventory

Current renderer sources map into the command model as follows:

| Source | Pass | Kind | Variant |
| --- | --- | --- | --- |
| Surface tops | `GROUND` | `decal` | `runtimeSidewalkTop`, `imageTop`, `runtimeDecalTop` |
| Zone objectives | `WORLD` | `overlay` | `zoneObjective` |
| Entity shadows | `GROUND` | `primitive` | `entityShadow` |
| Zone auras and fire zones | `WORLD` | `primitive` | `zoneEffect` |
| VFX clips | `WORLD` | `sprite` | `vfxClip` |
| Pickups | `WORLD` | `sprite` | `pickup` |
| Enemies, NPCs, neutral mobs, player | `WORLD` | `sprite` | `enemy`, `npc`, `neutralMob`, `player` |
| Projectiles and beam | `WORLD` | `sprite` / `primitive` | `projectileSpark`, `projectile`, `playerBeam` |
| World lights | `WORLD` | `light` | `projectedLight` |
| Face and wall pieces | `GROUND` / `WORLD` | `sprite` | `renderPieceSprite` |
| Structure overlays and triangle groups | `WORLD` | `overlay` / `triangle` | `structureOverlay`, `structureTriangleGroup` |
| Main-canvas debug and screen overlays | `WORLD` / `SCREEN` | `debug` / `overlay` / `primitive` | `debugPass`, `screenTint`, `ambientDarkness`, `floatingText`, `playerWedge` |
