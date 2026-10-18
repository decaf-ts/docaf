import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  cleanupTempDirs,
  makeTempDir,
  writeFile,
} from "../support/harness";

const requireCjs = createRequire(__filename);
const { resolveDocsInputs, globToRegExp } = requireCjs(
  "../../lib/cjs/cli/inputs.cjs"
) as typeof import("../../src/cli/inputs");

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
    },
  },
  null,
  2
);

const DEFAULT_EXCLUDES = ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"];

function configFor(
  root: string,
  include: string[],
  exclude: string[] = DEFAULT_EXCLUDES
): ResolvedDocsConfig {
  return {
    root,
    packageRoot: root,
    project: { name: "inputs-fixture", version: "0.0.0" },
    source: {
      tsconfigPath: path.join(root, "tsconfig.json"),
      include,
      exclude,
    },
    publisher: { includePrivate: false },
    storage: {
      snapshotDirectory: path.join(root, ".decaf-docs"),
      snapshotPath: path.join(root, ".decaf-docs", "snapshot.json"),
      manifestPath: path.join(root, ".decaf-docs", "build-cache.json"),
    },
    targets: [],
    warnings: [],
    config: {},
  };
}

function fixtureProject(prefix: string): string {
  const root = makeTempDir(prefix);
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(root, "src/a.ts", "export const a = 1;\n");
  writeFile(root, "src/b.ts", "export const b = 2;\n");
  writeFile(root, "src/c.spec.ts", "export const spec = true;\n");
  writeFile(root, "src/nested/deep/d.ts", "export const d = 4;\n");
  writeFile(root, "src/nested/e.ts", "export const e = 5;\n");
  writeFile(root, "src/question/a1.ts", "export const a1 = 1;\n");
  writeFile(root, "src/question/a2.ts", "export const a2 = 2;\n");
  writeFile(root, "src/question/ab.ts", "export const ab = 3;\n");
  writeFile(root, "node_modules/pkg/index.ts", "export const pkg = 1;\n");
  writeFile(root, "dist/bundle.ts", "export const dist = 1;\n");
  writeFile(root, "lib/bundle.ts", "export const lib = 1;\n");
  writeFile(root, ".decaf-docs/old.ts", "export const old = 1;\n");
  writeFile(root, "tmp/scratch.ts", "export const scratch = 1;\n");
  writeFile(root, "root.ts", "export const root = 1;\n");
  return root;
}

function filesFor(config: ResolvedDocsConfig): string[] {
  return resolveDocsInputs(config).files.map((file) => file.relative);
}

afterAll(() => cleanupTempDirs());

describe("globToRegExp", () => {
  it("matches ** across zero or more path segments", () => {
    const matcher = globToRegExp("src/**/*.ts");
    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/nested/deep/d.ts")).toBe(true);
    expect(matcher.test("other/a.ts")).toBe(false);
  });

  it("matches * within a single path segment", () => {
    const matcher = globToRegExp("src/*.ts");
    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/nested/e.ts")).toBe(false);
  });

  it("matches ? as exactly one non-separator character", () => {
    const matcher = globToRegExp("src/a?.ts");
    expect(matcher.test("src/a1.ts")).toBe(true);
    expect(matcher.test("src/ab.ts")).toBe(true);
    expect(matcher.test("src/a12.ts")).toBe(false);
  });

  it("expands {a,b} alternatives", () => {
    const matcher = globToRegExp("src/{one,two}.ts");
    expect(matcher.test("src/one.ts")).toBe(true);
    expect(matcher.test("src/two.ts")).toBe(true);
    expect(matcher.test("src/three.ts")).toBe(false);
  });
});

describe("resolveDocsInputs", () => {
  it("includes every .ts file under src for the ** pattern", () => {
    const root = fixtureProject("docaf-inputs-doublestar-");
    const files = filesFor(configFor(root, ["src/**/*.ts"]));

    expect(files).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/nested/deep/d.ts",
      "src/nested/e.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
  });

  it("restricts * to one directory level", () => {
    const root = fixtureProject("docaf-inputs-star-");
    const files = filesFor(configFor(root, ["src/*.ts"]));

    expect(files).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("honours ? and {a,b} patterns", () => {
    const root = fixtureProject("docaf-inputs-patterns-");

    expect(filesFor(configFor(root, ["src/question/a?.ts"]))).toEqual([
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
    expect(filesFor(configFor(root, ["src/question/{a1,ab}.ts"]))).toEqual([
      "src/question/a1.ts",
      "src/question/ab.ts",
    ]);
  });

  it("applies exclude patterns", () => {
    const root = fixtureProject("docaf-inputs-exclude-");
    const files = filesFor(configFor(root, ["src/**/*.ts"]));

    expect(files).not.toContain("src/c.spec.ts");

    const nestedExcluded = filesFor(
      configFor(root, ["src/**/*.ts"], [...DEFAULT_EXCLUDES, "src/nested/**"])
    );
    expect(nestedExcluded).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
  });

  it("skips build, dependency and cache directories", () => {
    const root = fixtureProject("docaf-inputs-skip-");
    const files = filesFor(configFor(root, ["**/*.ts"], []));

    expect(files).toEqual([
      "root.ts",
      "src/a.ts",
      "src/b.ts",
      "src/c.spec.ts",
      "src/nested/deep/d.ts",
      "src/nested/e.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
    for (const skipped of [
      "node_modules/",
      "dist/",
      "lib/",
      ".decaf-docs/",
      "tmp/",
    ]) {
      expect(files.some((file) => file.startsWith(skipped))).toBe(false);
    }
  });

  it("keeps the fingerprint stable when nothing changes", () => {
    const root = fixtureProject("docaf-inputs-stable-");
    const config = configFor(root, ["src/**/*.ts"]);

    const first = resolveDocsInputs(config);
    const second = resolveDocsInputs(config);

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.files).toEqual(first.files);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(first.compilerOptions.noEmit).toBe(true);
  });

  it("changes the fingerprint when a source file changes", () => {
    const root = fixtureProject("docaf-inputs-content-");
    const config = configFor(root, ["src/**/*.ts"]);
    const before = resolveDocsInputs(config).fingerprint;

    fs.writeFileSync(path.join(root, "src/a.ts"), "export const a = 99;\n");
    const after = resolveDocsInputs(config).fingerprint;

    expect(after).not.toBe(before);
  });

  it("changes the fingerprint when compiler options change", () => {
    const root = fixtureProject("docaf-inputs-options-");
    const config = configFor(root, ["src/**/*.ts"]);
    const before = resolveDocsInputs(config).fingerprint;

    writeFile(
      root,
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: false,
          skipLibCheck: true,
        },
      })
    );
    const after = resolveDocsInputs(config).fingerprint;

    expect(after).not.toBe(before);
  });

  it("reports DOCAF_NO_SOURCES when nothing matches", () => {
    const root = fixtureProject("docaf-inputs-empty-");

    expect(() =>
      resolveDocsInputs(configFor(root, ["missing/**/*.ts"]))
    ).toThrow(/DOCAF_NO_SOURCES/);
  });
});
