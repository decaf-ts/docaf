import fs from "node:fs";
import path from "node:path";
import {
  globToRegExp,
  resolveDocsInputs,
  resolveSourceFiles,
} from "../../src/cli/inputs";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  cleanupTempDirs,
  makeTempDir,
  writeFile,
} from "../support/harness";

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
    project: { name: "inputs-src-fixture", version: "0.0.0" },
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
  writeFile(root, ".hidden/secret.ts", "export const secret = 1;\n");
  writeFile(root, "tmp/scratch.ts", "export const scratch = 1;\n");
  writeFile(root, "root.ts", "export const root = 1;\n");
  return root;
}

function filesFor(config: ResolvedDocsConfig): string[] {
  return resolveSourceFiles(config).map((file) => file.relative);
}

afterAll(() => cleanupTempDirs());

describe("globToRegExp", () => {
  it("matches any depth for a leading **/ segment", () => {
    const matcher = globToRegExp("src/**/*.ts");

    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/nested/deep/a.ts")).toBe(true);
    expect(matcher.test("lib/a.ts")).toBe(false);
  });

  it("matches a single segment for *", () => {
    const matcher = globToRegExp("src/*.ts");

    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/nested/a.ts")).toBe(false);
  });

  it("matches a single non-slash character for ?", () => {
    const matcher = globToRegExp("src/question/a?.ts");

    expect(matcher.test("src/question/a1.ts")).toBe(true);
    expect(matcher.test("src/question/ab.ts")).toBe(true);
    expect(matcher.test("src/question/abc.ts")).toBe(false);
  });

  it("expands brace alternatives", () => {
    const matcher = globToRegExp("src/{a,b}.ts");

    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/b.ts")).toBe(true);
    expect(matcher.test("src/c.ts")).toBe(false);
  });

  it("normalises backslashes and a leading ./", () => {
    const matcher = globToRegExp(".\\src\\**\\*.ts");

    expect(matcher.test("src/a.ts")).toBe(true);
    expect(matcher.test("src/nested/a.ts")).toBe(true);
  });

  it("escapes regex metacharacters literally", () => {
    const matcher = globToRegExp("src/a+b(1).ts");

    expect(matcher.test("src/a+b(1).ts")).toBe(true);
    expect(matcher.test("src/aab(1).ts")).toBe(false);
  });

  it("treats an unmatched brace literally", () => {
    const matcher = globToRegExp("src/a{b.ts");

    expect(matcher.test("src/a{b.ts")).toBe(true);
  });
});

describe("resolveSourceFiles", () => {
  it("matches globs recursively while skipping generated and hidden directories", () => {
    const root = fixtureProject("docaf-inputs-src-glob-");

    expect(filesFor(configFor(root, ["src/**/*.ts"]))).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/nested/deep/d.ts",
      "src/nested/e.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
  });

  it("keeps literal include paths without walking the tree", () => {
    const root = fixtureProject("docaf-inputs-src-literal-");

    expect(
      filesFor(configFor(root, ["src/nested/e.ts", "./root.ts"]))
    ).toEqual(["root.ts", "src/nested/e.ts"]);
  });

  it("ignores a literal include path that does not exist", () => {
    const root = fixtureProject("docaf-inputs-src-missing-literal-");

    expect(
      filesFor(configFor(root, ["root.ts", "src/missing.ts"]))
    ).toEqual(["root.ts"]);
  });

  it("applies exclude globs and de-duplicates overlapping includes", () => {
    const root = fixtureProject("docaf-inputs-src-exclude-");

    expect(
      filesFor(
        configFor(root, ["src/**/*.ts", "src/a.ts"], ["**/*.spec.ts"])
      )
    ).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/nested/deep/d.ts",
      "src/nested/e.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
  });

  it("supports question and brace globs", () => {
    const root = fixtureProject("docaf-inputs-src-question-");

    expect(
      filesFor(configFor(root, ["src/question/a?.ts", "src/{a,b}.ts"]))
    ).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/question/a1.ts",
      "src/question/a2.ts",
      "src/question/ab.ts",
    ]);
  });

  it("resolves absolute paths for the selected files", () => {
    const root = fixtureProject("docaf-inputs-src-absolute-");
    const files = resolveSourceFiles(configFor(root, ["src/a.ts"]));

    expect(files).toEqual([
      { relative: "src/a.ts", absolute: path.join(root, "src", "a.ts") },
    ]);
  });

  it("throws a DocsBuildError when nothing matches", () => {
    const root = fixtureProject("docaf-inputs-src-none-");

    try {
      resolveSourceFiles(configFor(root, ["missing/**/*.ts"]));
      throw new Error("expected resolveSourceFiles to fail");
    } catch (error) {
      expect((error as Error).name).toBe("DocsBuildError");
      expect(
        (
          error as { diagnostics?: { code: string }[] }
        ).diagnostics?.map((entry) => entry.code)
      ).toContain("DOCAF_NO_SOURCES");
    }
  });
});

describe("resolveDocsInputs", () => {
  it("returns files, noEmit compiler options and a stable fingerprint", () => {
    const root = fixtureProject("docaf-inputs-src-docs-");
    const config = configFor(root, ["src/**/*.ts"]);

    const first = resolveDocsInputs(config);
    const second = resolveDocsInputs(config);

    expect(first.files.map((file) => file.relative)).toContain("src/a.ts");
    expect(first.compilerOptions.noEmit).toBe(true);
    expect(first.compilerOptions.strict).toBe(true);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^[0-9a-f]+$/);
  });

  it("changes the fingerprint when a source file changes", () => {
    const root = fixtureProject("docaf-inputs-src-change-");
    const config = configFor(root, ["src/a.ts"]);

    const before = resolveDocsInputs(config).fingerprint;
    writeFile(root, "src/a.ts", "export const a = 100;\n");
    const after = resolveDocsInputs(config).fingerprint;

    expect(after).not.toBe(before);
  });

  it("changes the fingerprint when project metadata changes", () => {
    const root = fixtureProject("docaf-inputs-src-project-");
    const config = configFor(root, ["src/a.ts"]);

    const before = resolveDocsInputs(config).fingerprint;
    const after = resolveDocsInputs({
      ...config,
      project: { name: "other-project", version: "9.9.9" },
    }).fingerprint;

    expect(after).not.toBe(before);
  });

  it("reports an unreadable tsconfig", () => {
    const root = fixtureProject("docaf-inputs-src-bad-tsconfig-");
    const config = configFor(root, ["src/a.ts"]);
    fs.rmSync(config.source.tsconfigPath);

    try {
      resolveDocsInputs(config);
      throw new Error("expected resolveDocsInputs to fail");
    } catch (error) {
      expect(
        (
          error as { diagnostics?: { code: string }[] }
        ).diagnostics?.map((entry) => entry.code)
      ).toContain("DOCAF_CONFIG_TSCONFIG_INVALID");
    }
  });

  it("reports invalid compiler options from the tsconfig", () => {
    const root = fixtureProject("docaf-inputs-src-invalid-tsconfig-");
    writeFile(
      root,
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { target: "nope" } })
    );
    const config = configFor(root, ["src/a.ts"]);

    try {
      resolveDocsInputs(config);
      throw new Error("expected resolveDocsInputs to fail");
    } catch (error) {
      expect(
        (
          error as { diagnostics?: { code: string }[] }
        ).diagnostics?.some((entry) =>
          entry.code.startsWith("DOCAF_CONFIG_TSCONFIG_")
        )
      ).toBe(true);
    }
  });
});
