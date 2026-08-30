import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("project identity and public routes", () => {
  it("uses the Music Lab package and repository metadata", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("music-lab");
    expect(pkg.homepage).toBe("https://music.mingyangbao.site");
    expect(pkg.repository.url).toBe("git+https://github.com/DawnEver/music-lab.git");
  });

  it("publishes clean tool routes with SPA fallback", () => {
    const router = read("src/router/index.ts");
    expect(router).toContain('path: "/tuning"');
    expect(router).toContain('path: "/metronome"');
    expect(router).toContain("createWebHistory");
    expect(router).not.toContain("createWebHashHistory");

    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.rewrites).toContainEqual({ source: "/(.*)", destination: "/index.html" });
  });
});
