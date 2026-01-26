import { World, spawnEnemy } from "../world";

export function spawnSystem(w: World, dt: number) {
  // Eventless, simple timeline + repeating cadence for v0
  w.stage;

  // Run timeline spawns once
  for (const s of w.stage.spawns) {
    // Mark spawned by setting t to Infinity after spawning (cheap v0.1 trick)
    if (s.t === Infinity) continue;
    if (w.time >= s.t) {
      for (let k = 0; k < s.count; k++) {
        const a = w.rng.range(0, Math.PI * 2);
        const r = w.rng.range(s.radius * 0.8, s.radius);
        const x = w.px + Math.cos(a) * r;
        const y = w.py + Math.sin(a) * r;
        spawnEnemy(w, s.type, x, y);
      }
      (s as any).t = Infinity;
    }
  }

  // Simple repeating trickle spawn (keeps pressure)
  // Every ~0.6s: spawn a chaser near edge; later add runners/bruisers
  const cadence = 0.6;
  (w as any)._spawnAcc = ((w as any)._spawnAcc ?? 0) + dt;
  while ((w as any)._spawnAcc >= cadence) {
    (w as any)._spawnAcc -= cadence;

    const roll = w.rng.next();
    let type = 1;
    if (w.time > 60 && roll < 0.35) type = 2;
    if (w.time > 120 && roll < 0.08) type = 3;

    const a = w.rng.range(0, Math.PI * 2);
    const r = w.rng.range(520, 650);
    spawnEnemy(w, type, w.px + Math.cos(a) * r, w.py + Math.sin(a) * r);
  }
}
