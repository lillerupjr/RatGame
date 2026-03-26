import type { ShadowSunV1Model } from "../../shadowSunV1";

export type SweepShadowMap = {
    originTx: number;
    originTy: number;
    width: number;
    height: number;
    data: Float32Array;
};

export type TileHeightGrid = {
    originTx: number;
    originTy: number;
    width: number;
    height: number;
    version: string;
    heights: Float32Array;
};

const SOFTNESS_FACTOR = 2.0;

let _cachedShadowMap: SweepShadowMap | null = null;
let _cacheKey = "";

export function getSweepShadowMap(): SweepShadowMap | null {
    return _cachedShadowMap;
}

export function clearSweepShadowMap(): void {
    _cachedShadowMap = null;
    _cacheKey = "";
}

export function shadowIntensityAtTile(tx: number, ty: number): number {
    if (!_cachedShadowMap) return 0;
    const { originTx, originTy, width, height, data } = _cachedShadowMap;
    const lx = tx - originTx;
    const ly = ty - originTy;
    if (lx < 0 || ly < 0 || lx >= width || ly >= height) return 0;
    return data[ly * width + lx];
}

export function computeSweepShadowMap(
    heightGrid: TileHeightGrid,
    sunModel: ShadowSunV1Model,
    mapId: string,
): SweepShadowMap | null {
    const key = `${mapId}:${sunModel.stepKey}:hv${heightGrid.version}`;
    if (key === _cacheKey && _cachedShadowMap) return _cachedShadowMap;
    _cachedShadowMap = sweepShadow(heightGrid, sunModel);
    _cacheKey = key;
    return _cachedShadowMap;
}

export function buildUnifiedWorldShadowMap(
    heightGrid: TileHeightGrid,
    castShadowMap: SweepShadowMap | null,
    ambientDarkness01: number,
): SweepShadowMap | null {
    const ambient = Math.max(0, Math.min(1, Number.isFinite(ambientDarkness01) ? ambientDarkness01 : 0));
    if (!castShadowMap && ambient <= 0) return null;

    const width = heightGrid.width;
    const height = heightGrid.height;
    const data = new Float32Array(width * height);
    if (ambient > 0) data.fill(ambient);

    if (castShadowMap) {
        const { originTx, originTy, width: castWidth, height: castHeight, data: castData } = castShadowMap;
        for (let ty = 0; ty < castHeight; ty++) {
            for (let tx = 0; tx < castWidth; tx++) {
                const castIntensity = castData[ty * castWidth + tx] ?? 0;
                const index = ty * castWidth + tx;
                if (castIntensity > data[index]) data[index] = castIntensity;
            }
        }
        return {
            originTx,
            originTy,
            width: castWidth,
            height: castHeight,
            data,
        };
    }

    return {
        originTx: heightGrid.originTx,
        originTy: heightGrid.originTy,
        width,
        height,
        data,
    };
}

function sweepShadow(
    grid: TileHeightGrid,
    sunModel: ShadowSunV1Model,
): SweepShadowMap {
    const { width, height, heights, originTx, originTy } = grid;
    const data = new Float32Array(width * height);
    if (!sunModel.castsShadows) return { originTx, originTy, width, height, data };
    const dirX = sunModel.forward.x;
    const dirY = sunModel.forward.y;
    const elevRad = sunModel.elevationDeg * (Math.PI / 180);
    const decay = Math.tan(elevRad);

    if (decay > 100) return { originTx, originTy, width, height, data };

    const absDirX = Math.abs(dirX);
    const absDirY = Math.abs(dirY);
    if (absDirX < 1e-6 && absDirY < 1e-6) {
        return { originTx, originTy, width, height, data };
    }

    const useYDominant = absDirY > absDirX;
    const majorLen = useYDominant ? height : width;
    const minorLen = useYDominant ? width : height;
    const majorDir = useYDominant ? dirY : dirX;
    const minorDir = useYDominant ? dirX : dirY;
    const slope = minorDir / majorDir;
    const majorSign = majorDir > 0 ? 1 : -1;
    const stepDist = Math.sqrt(1 + slope * slope);

    for (let startMinor = 0; startMinor < minorLen; startMinor++) {
        let shadowHeight = 0;
        let minorAccum = startMinor + 0.5;
        const majorStart = majorSign > 0 ? 0 : majorLen - 1;

        for (let step = 0; step < majorLen; step++) {
            const major = majorStart + step * majorSign;
            const minor = Math.floor(minorAccum);
            if (minor < 0 || minor >= minorLen) break;

            const tx = useYDominant ? minor : major;
            const ty = useYDominant ? major : minor;
            const idx = ty * width + tx;
            const tileH = heights[idx];

            shadowHeight -= decay * stepDist;
            if (shadowHeight < 0) shadowHeight = 0;

            if (tileH >= shadowHeight) {
                shadowHeight = tileH;
            } else {
                const depth = shadowHeight - tileH;
                const intensity = Math.min(depth / SOFTNESS_FACTOR, 1);
                if (intensity > data[idx]) data[idx] = intensity;
            }

            minorAccum += slope * majorSign;
        }
    }

    return { originTx, originTy, width, height, data };
}
