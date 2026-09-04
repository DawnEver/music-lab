import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve("src");

function sourceFiles(dir = ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|vue)$/.test(entry) ? [path] : [];
  });
}

const IMPORT_RE = /(?:import|export)[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Every local module a file imports, as a src-relative path without extension. */
function localImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier && specifier.startsWith(".")) specifiers.push(specifier);
  }
  return specifiers.map((specifier) =>
    relative(ROOT, resolve(dirname(file), specifier)).replace(/\.(js|ts|vue)$/, "").replaceAll("\\", "/")
  );
}

/** Which feature a src-relative path belongs to, if any. */
function featureOf(path: string): string | null {
  const match = /^features\/([^/]+)/.exec(path.replaceAll("\\", "/"));
  return match ? match[1] : null;
}

const files = sourceFiles().map((file) => ({
  path: relative(ROOT, file).replaceAll("\\", "/"),
  imports: localImports(file)
}));

describe("feature boundaries", () => {
  it("finds the source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("features never import each other", () => {
    const crossings = files.flatMap((file) => {
      const from = featureOf(file.path);
      if (!from) return [];
      return file.imports
        .filter((target) => {
          const to = featureOf(target);
          return to !== null && to !== from;
        })
        .map((target) => `${file.path} -> ${target}`);
    });
    expect(crossings).toEqual([]);
  });

  it("shared layers never import a feature", () => {
    // The router is the composition root — it is the one place allowed to
    // name a feature, and only to lazy-import its view.
    const shared = ["lib/", "shared/", "instruments/", "audio/", "composables/", "plugins/"];
    const leaks = files
      .filter((file) => shared.some((prefix) => file.path.startsWith(prefix)))
      .flatMap((file) =>
        file.imports.filter((target) => featureOf(target)).map((target) => `${file.path} -> ${target}`)
      );
    expect(leaks).toEqual([]);
  });

  it("the app entry and shell only know features through the router", () => {
    const leaks = files
      .filter((file) => ["main.ts", "App.vue"].includes(file.path) || file.path.startsWith("shared/"))
      .flatMap((file) =>
        file.imports.filter((target) => featureOf(target)).map((target) => `${file.path} -> ${target}`)
      );
    expect(leaks).toEqual([]);
  });

  it("only the router names a feature, and only its view", () => {
    const router = files.find((file) => file.path === "router/index.ts")!;
    const featureImports = router.imports.filter((target) => featureOf(target));
    expect(featureImports.sort()).toEqual([
      "features/metronome/MetronomeView",
      "features/tuning/TuningView"
    ]);
  });

  it("every import resolves to a file that exists", () => {
    const missing = files.flatMap((file) =>
      file.imports
        .filter((target) => {
          const base = join(ROOT, target);
          return ![".ts", ".vue", ".css", "/index.ts", ""].some((suffix) => {
            try {
              return statSync(base + suffix).isFile();
            } catch (_) {
              return false;
            }
          });
        })
        .map((target) => `${file.path} -> ${target}`)
    );
    expect(missing).toEqual([]);
  });
});
