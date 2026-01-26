export function formatTimeMMSS(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}
