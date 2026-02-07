export const DIR8_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Dir8 = (typeof DIR8_ORDER)[number];

const ANGLE_TO_DIR8: Dir8[] = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
const DIR8_INDEX: Record<Dir8, number> = {
    N: 0,
    NE: 1,
    E: 2,
    SE: 3,
    S: 4,
    SW: 5,
    W: 6,
    NW: 7,
};

export function dir8FromVector(dx: number, dy: number): Dir8 {
    if (Math.hypot(dx, dy) <= 1e-6) return "S";
    const ang = Math.atan2(dy, dx);
    const idx = (Math.round(ang / (Math.PI / 4)) + 8) % 8;
    return ANGLE_TO_DIR8[idx];
}

export function dir8Index(dir: Dir8): number {
    return DIR8_INDEX[dir];
}

export function dir8IndexFromVector(dx: number, dy: number): number {
    return dir8Index(dir8FromVector(dx, dy));
}
