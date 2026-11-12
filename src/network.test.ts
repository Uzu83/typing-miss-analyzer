import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL(".", import.meta.url);

describe("keystroke modules", () => {
  it("do not send keystrokes over the network", () => {
    const files = readdirSync(root).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));
    const producers = files.filter((name) => name !== "analytics.tsx" && name !== "network.test.ts");
    for (const name of producers) {
      const source = readFileSync(new URL(name, root), "utf8");
      expect(source, name).not.toMatch(/\bfetch\s*\(/);
      expect(source, name).not.toMatch(/XMLHttpRequest|sendBeacon|navigator\.sendBeacon/);
    }
  });
});
