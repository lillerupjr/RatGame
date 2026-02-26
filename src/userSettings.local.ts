import type { UserSettingsPatch } from "./userSettings";

const localSettings: UserSettingsPatch = {
  debug: {
    grid: false,
    slices: false,
  },
  render: {
    entityShadowsDisable: true,
    entityAnchorsEnabled: false,
    renderPerfCountersEnabled: false,
  },
};

export default localSettings;
