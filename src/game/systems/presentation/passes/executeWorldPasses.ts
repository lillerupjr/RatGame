import type { WorldPassContext, WorldPassResult } from "../contracts/worldPassContext";

export function executeWorldPasses(input: WorldPassContext): WorldPassResult {
  const {
    sliceDrawables,
    countRenderSliceKeySort,
    isWorldKindForRenderPass,
    deriveFeetSortYFromKey,
    T,
    toScreenAtZ,
    resolveRenderZBand,
    rampRoadTiles,
    countRenderDrawableSort,
    compareRenderKeys,
    structureShadowFrame,
    structureV6VerticalShadowDebugDataList,
    setRenderZBandCount,
    KindOrder,
    isGroundKindForRenderPass,
    setRenderPerfDrawTag,
    ctx,
    executeDebugPass,
    drawSweepShadowBand,
  } = input as any;

  const sliceKeys = Array.from(sliceDrawables.keys()) as number[];
  countRenderSliceKeySort();
  sliceKeys.sort((a, b) => a - b);

  const kindToDrawTag = (kind: any): "floors" | "decals" | "entities" | "structures" | "lighting" => {
    if (kind === KindOrder.FLOOR || kind === KindOrder.SHADOW) return "floors";
    if (kind === KindOrder.DECAL) return "decals";
    if (kind === KindOrder.LIGHT) return "lighting";
    if (
      kind === KindOrder.ENTITY
      || kind === KindOrder.VFX
      || kind === KindOrder.ZONE_OBJECTIVE
    ) return "entities";
    return "structures";
  };

  const zBands = new Set<number>();
  for (let i = 0; i < sliceKeys.length; i++) {
    const drawables = sliceDrawables.get(sliceKeys[i])!;
    for (let j = 0; j < drawables.length; j++) {
      const key = drawables[j].key;
      if (isWorldKindForRenderPass(key.kindOrder) && key.feetSortY == null) {
        key.feetSortY = deriveFeetSortYFromKey(key, T, toScreenAtZ);
      }
      zBands.add(resolveRenderZBand(key, rampRoadTiles));
    }
    countRenderDrawableSort();
    drawables.sort((a: any, b: any) => compareRenderKeys(a.key, b.key));
  }

  if (structureShadowFrame.routing.usesV6Debug) {
    for (let i = 0; i < structureV6VerticalShadowDebugDataList.length; i++) {
      zBands.add(structureV6VerticalShadowDebugDataList[i].zBand);
    }
  }

  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);
  setRenderZBandCount(zBandKeys.length);

  for (let zi = 0; zi < zBandKeys.length; zi++) {
    const zb = zBandKeys[zi];

    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isGroundKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }

    if (drawSweepShadowBand) {
      drawSweepShadowBand(zb, zBandKeys[0]);
    }

    if (structureShadowFrame.routing.usesV6Debug && structureV6VerticalShadowDebugDataList.length > 0) {
      setRenderPerfDrawTag("floors");
      for (let i = 0; i < structureV6VerticalShadowDebugDataList.length; i++) {
        const structureShadowDebugData = structureV6VerticalShadowDebugDataList[i];
        if (structureShadowDebugData.zBand !== zb) continue;
        executeDebugPass({
          phase: "structureV6MergedMask",
          input: {
            ctx,
            debugData: structureShadowDebugData,
          },
        });
      }
    }

    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isWorldKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
  }

  setRenderPerfDrawTag(null);
  return {};
}
