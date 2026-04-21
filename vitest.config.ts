import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "threads",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    setupFiles: ["./src/tests/setup/testEnvironment.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/game/**/*.ts"],
      exclude: [
        "src/game/visual/**",
        "src/game/audio/**",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
      ],
    },
  },
});
