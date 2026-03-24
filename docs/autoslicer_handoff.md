1. What changed
   Lighting/shadow refactor

src/game/systems/presentation/render.ts: render pipeline now builds worldLightRegistry, drives static relight/dynamic relight, and keeps additive light draw + ambient darkness overlay in the world/screen passes.
src/game/systems/presentation/collection/collectStructureDrawables.ts: structure collection now feeds shadow orchestration and V6 debug/cache population from monolithic triangle caches.
src/game/systems/presentation/structures/buildStructureSlices.ts: structure slices now use monolithic triangle geometry, queue V1/V2/V3/V4/V5 shadow casters, and expose new ownership/sort debug overlay.
src/game/structures/monolithicBuildingSemanticPrepass.ts: new semantic prepass computes per-sprite footprint/slice metadata, parent slice offsets, and culled semantic triangles.
src/game/structures/monolithicStructureGeometry.ts: replaces old runtime triangle pipeline; builds/caches monolithic triangles and parent-tile groups from semantic slice entries.
Monolithic work

src/game/systems/presentation/structures/buildStructureSlices.ts: switched from per-band runtime slicing to cached monolithic geometry; added ownership-sort debug labels.
src/game/structures/monolithicStructureGeometry.ts: defines slice ownership explicitly via semantic slice parent offsets and groups triangles by parent tile.
src/game/systems/presentation/render.ts: adds showStructureTriangleOwnershipSort wiring into debug flags.
src/settings/debugToolsSettings.ts, src/ui/devTools/DebugToolsSection.ts, src/userSettings.ts: preserve new debug/settings toggle for ownership/sort visualization.
Sort fix commit (c149...): keeps slice ordering stable while allowing lower-slice triangles to inherit an earlier parent tile.
2. Critical APIs / contracts
   Lighting hooks into render at src/game/systems/presentation/render.ts:
   buildFrameWorldLightRegistry(...) -> world-pass additive light draw via drawProjectedLightAdditive(...) -> screen overlay darkness via renderAmbientDarknessOverlay(...).
   Structure shadow routing hooks through collectStructureDrawables(...) -> buildStructureSlices(...) -> buildOrchestratedStructureShadowFrameResult(...).
   Slice ownership is defined in src/game/structures/monolithicBuildingSemanticPrepass.ts:
   MonolithicBuildingSemanticSliceEntry.parentFootprintOffsetTx/Ty.
   Triangle ownership is materialized in src/game/structures/monolithicStructureGeometry.ts:
   buildRuntimeTrianglesFromMonolithicGeometry(...) sets parentTx/parentTy and ownerTx/ownerTy.
   Shared data both sides modify:
   RuntimeStructureTrianglePiece, RuntimeStructureParentTileGroup, RuntimeStructureTriangleCache, StructureShadowFrameResult, and buildStructureSlices(...) inputs.
3. Merge hotspots
   src/game/systems/presentation/render.ts — both branches touch render pipeline wiring, debug flags, and structure/light integration.
   src/game/systems/presentation/collection/collectStructureDrawables.ts — both branches route structure drawables into shadows/caches.
   src/game/systems/presentation/structures/buildStructureSlices.ts — main behavioral conflict: shadow caster flow vs ownership/sort/debug logic.
   src/game/structures/monolithicStructureGeometry.ts — ownership, grouping, cache shape, and render-order fields all live here.
   src/game/structures/monolithicBuildingSemanticPrepass.ts — semantic slice parent mapping drives ownership invariants.
   src/settings/debugToolsSettings.ts, src/ui/devTools/DebugToolsSection.ts, src/userSettings.ts — easy to drop new toggles during conflict resolution.
4. Merge rules
   Preserve lighting behavior: additive/world lights, static relight, and building shadow occlusion must stay intact.
   Preserve monolithic invariant: each slice has exactly ONE parent tile; all triangles in that slice inherit it.
   Do not recompute parent from triangleTx/triangleTy; those are observational/debug fields only.
   Keep ownerTx/ownerTy == parentTx/parentTy; keep triangleTx/triangleTy as the triangle’s actual tile.
   Preserve render ordering based on parent/group sort (parentTileGroups, feetSortY, slice/band order); do not sort lower-slice triangles by their own tile.
5. What must not break
   Lights still render and are occluded correctly by buildings.
   Shadows still align with monolithic structures and semantic faces.
   Ownership debug still shows correct P(x,y) vs T(x,y) for lower-slice triangles.
   showStructureTriangleOwnershipSort, structure slice/anchor debug, and shadow debug/settings toggles all remain wired.
6. Quick verification
   npm run typecheck
   In-game: confirm additive lights visible and blocked by buildings.
   In-game: confirm structure shadows still line up with buildings.
   Enable ownership debug: verify lower-slice triangles can show P != T while sort remains stable.