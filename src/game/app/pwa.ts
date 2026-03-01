export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosStandalone = nav.standalone === true;
  const displayModeStandalone = typeof window.matchMedia === "function"
    ? window.matchMedia("(display-mode: standalone)").matches
    : false;

  return iosStandalone || displayModeStandalone;
}
