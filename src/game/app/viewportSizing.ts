import { isStandalonePwa } from "./pwa";

type Cleanup = () => void;

function isIosDevice(): boolean {
  if (typeof window === "undefined" || typeof window.navigator === "undefined") return false;
  const nav = window.navigator;
  const ua = nav.userAgent ?? "";
  const platform = nav.platform ?? "";
  const maxTouchPoints = Number.isFinite(nav.maxTouchPoints) ? nav.maxTouchPoints : 0;

  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (/iPad|iPhone|iPod/i.test(platform)) return true;

  // iPadOS can report itself as Mac while still exposing touch points.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function measureViewportPx(): { width: number; height: number } {
  const viewport = window.visualViewport;
  if (viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)) {
    return {
      width: Math.max(1, Math.round(viewport.width)),
      height: Math.max(1, Math.round(viewport.height)),
    };
  }
  return {
    width: Math.max(1, Math.round(window.innerWidth || 1)),
    height: Math.max(1, Math.round(window.innerHeight || 1)),
  };
}

export function installStandaloneViewportFix(): Cleanup {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  if (!isStandalonePwa() || !isIosDevice()) return () => {};

  const root = document.documentElement;
  const visualViewport = window.visualViewport;
  let disposed = false;
  let rafId = 0;
  let updateQueued = false;

  const writeViewportVars = () => {
    if (disposed) return;
    const { width, height } = measureViewportPx();
    root.style.setProperty("--app-vw", `${width}px`);
    root.style.setProperty("--app-vh", `${height}px`);
  };

  const flush = () => {
    rafId = 0;
    updateQueued = false;
    writeViewportVars();
  };

  const scheduleUpdate = () => {
    if (disposed || updateQueued) return;
    updateQueued = true;
    rafId = window.requestAnimationFrame(flush);
  };

  const onWindowResize = () => scheduleUpdate();
  const onOrientationChange = () => scheduleUpdate();
  const onViewportResize = () => scheduleUpdate();
  const onViewportScroll = () => scheduleUpdate();
  const onPageShow = () => scheduleUpdate();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      scheduleUpdate();
    }
  };

  root.classList.add("ios-standalone-fix");
  writeViewportVars();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("orientationchange", onOrientationChange);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibilityChange);
  visualViewport?.addEventListener("resize", onViewportResize);
  visualViewport?.addEventListener("scroll", onViewportScroll);

  return () => {
    disposed = true;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    updateQueued = false;

    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onOrientationChange);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    visualViewport?.removeEventListener("resize", onViewportResize);
    visualViewport?.removeEventListener("scroll", onViewportScroll);

    root.classList.remove("ios-standalone-fix");
    root.style.removeProperty("--app-vw");
    root.style.removeProperty("--app-vh");
  };
}
