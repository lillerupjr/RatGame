export interface DamageEvent {
  t: number;
  amount: number;
}

export interface DpsMetricsState {
  windowSeconds: number;
  events: DamageEvent[];
  dpsInstant: number;
  dpsSmoothed: number;
  smoothingSeconds: number;
}

export function createDpsMetrics(windowSeconds = 5, smoothingSeconds = 2): DpsMetricsState {
  return {
    windowSeconds,
    smoothingSeconds,
    events: [],
    dpsInstant: 0,
    dpsSmoothed: 0,
  };
}

export function recordDamage(metrics: DpsMetricsState, nowSec: number, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  metrics.events.push({ t: nowSec, amount });
}

export function tickDpsMetrics(metrics: DpsMetricsState, nowSec: number, dtSec: number): void {
  const cutoff = nowSec - metrics.windowSeconds;
  while (metrics.events.length && metrics.events[0].t < cutoff) metrics.events.shift();

  let sum = 0;
  for (let i = 0; i < metrics.events.length; i++) sum += metrics.events[i].amount;
  metrics.dpsInstant = sum / metrics.windowSeconds;

  const alpha = metrics.smoothingSeconds <= 0 ? 1 : Math.min(1, dtSec / metrics.smoothingSeconds);
  metrics.dpsSmoothed = metrics.dpsSmoothed + (metrics.dpsInstant - metrics.dpsSmoothed) * alpha;
}

