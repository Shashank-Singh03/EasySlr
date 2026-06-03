import { readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Load .env into process.env so the Prisma client and env validation work in integration tests.
 * Done with a tiny hand parser to avoid a hard dependency on `vite`'s loadEnv at config-load time.
 */
function loadDotEnv() {
  try {
    const content = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      let value = rawValue!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key! in process.env)) process.env[key!] = value;
    }
  } catch {
    // No .env (e.g. CI with real env vars) — that's fine.
  }
}

loadDotEnv();

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "~/*" → "src/*" alias so tests can import server modules.
    alias: { "~": path.resolve(process.cwd(), "src") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
