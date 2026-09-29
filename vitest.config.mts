import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest needs the same `@/` alias as tsconfig.json. Without this the
// first test that imports a module using the alias fails to resolve —
// which is why the existing tests all use relative paths.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
