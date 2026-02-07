export function worldToTile(
    wx: number,
    wy: number,
    tileWorld: number
): { tx: number; ty: number } {
    return {
        tx: Math.floor(wx / tileWorld),
        ty: Math.floor(wy / tileWorld),
    };
}

export function tileToWorldCenter(
    tx: number,
    ty: number,
    tileWorld: number
): { wx: number; wy: number } {
    return {
        wx: (tx + 0.5) * tileWorld,
        wy: (ty + 0.5) * tileWorld,
    };
}
