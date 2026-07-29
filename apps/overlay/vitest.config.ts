import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Targets are pure logic (parsers, caches, slot routing) — no DOM needed.
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
