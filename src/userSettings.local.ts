import type { UserSettingsPatch } from "./userSettings";

const localSettings: UserSettingsPatch = {
  debug: {
    grid: false,
    slices: false,
  },
  render: {
    entityShadowsDisable: false,
    entityAnchorsEnabled: false,
    renderPerfCountersEnabled: false,
    performanceMode: false,
  },
};

export default localSettings;
