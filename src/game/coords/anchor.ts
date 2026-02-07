import { worldToGrid, type GridAnchor } from "./grid";

export type AnchorArrays = {
    gxi: number[];
    gyi: number[];
    gox: number[];
    goy: number[];
};

export function anchorFromWorld(
    wx: number,
    wy: number,
    tileWorld: number
): GridAnchor {
    const gp = worldToGrid(wx, wy, tileWorld);
    const gxi = Math.floor(gp.gx);
    const gyi = Math.floor(gp.gy);
    return { gxi, gyi, gox: gp.gx - gxi, goy: gp.gy - gyi };
}

export function writeAnchor(arrays: AnchorArrays, i: number, anchor: GridAnchor): void {
    arrays.gxi[i] = anchor.gxi;
    arrays.gyi[i] = anchor.gyi;
    arrays.gox[i] = anchor.gox;
    arrays.goy[i] = anchor.goy;
}
