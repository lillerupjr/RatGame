export type GameEvent =
    | {
    type: "ENEMY_HIT";
    enemyIndex: number;
    damage: number;
    x: number;
    y: number;
    source: "KNIFE" | "PISTOL" | "SWORD" | "OTHER";
}
    | {
    type: "ENEMY_KILLED";
    enemyIndex: number;
    x: number;
    y: number;
    xpValue: number;
    source: "KNIFE" | "PISTOL" | "SWORD" | "OTHER";
}
    | {
    type: "PLAYER_HIT";
    damage: number;
    x: number;
    y: number;
};
