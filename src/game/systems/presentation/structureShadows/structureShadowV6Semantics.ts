import type {
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleSemanticClass,
} from "../../../structures/monolithicStructureGeometry";
import type { StructureV6SemanticBucket } from "../structureShadowV6FaceSlices";
import type { StructureV6SemanticTriangle } from "./structureShadowTypes";

type ShadowV6SemanticBucket = StructureV6SemanticBucket;

function resolveSemanticBucketsForTriangleSemantic(
  semantic: RuntimeStructureTriangleSemanticClass,
): readonly ShadowV6SemanticBucket[] {
  if (semantic === "TOP") return ["TOP"];
  if (semantic === "RIGHT_EAST") return ["EAST_WEST"];
  if (semantic === "LEFT_SOUTH") return ["SOUTH_NORTH"];
  return ["EAST_WEST", "SOUTH_NORTH"];
}

export function buildStructureV6SemanticTriangles(
  triangles: readonly RuntimeStructureTrianglePiece[],
  semanticByStableId: ReadonlyMap<number, RuntimeStructureTriangleSemanticClass>,
): StructureV6SemanticTriangle[] {
  if (triangles.length <= 0) return [];

  const out: StructureV6SemanticTriangle[] = [];
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const semantic = semanticByStableId.get(tri.stableId) ?? "UNCLASSIFIED";
    const buckets = resolveSemanticBucketsForTriangleSemantic(semantic);
    for (let bi = 0; bi < buckets.length; bi++) {
      out.push({
        stableId: tri.stableId,
        semanticBucket: buckets[bi],
        srcTriangle: [tri.srcPoints[0], tri.srcPoints[1], tri.srcPoints[2]],
        dstTriangle: [tri.points[0], tri.points[1], tri.points[2]],
      });
    }
  }
  return out;
}
