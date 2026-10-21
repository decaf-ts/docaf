import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type {
  DocsCliOptions,
  ResolvedDocsConfig,
} from "../../src/cli/types";
import {
  REPO_ROOT,
  builtEsm,
  cleanupTempDirs,
  makeTempDir,
  runBuiltModule,
  writeFile,
} from "../support/harness";

const requireCjs = createRequire(__filename);
const cjsConfig = requireCjs("../../lib/cjs/cli/config.cjs") as Record<
  string,
  unknown
>;

type ResolvedConfig = ResolvedDocsConfig;

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      experimentalDecorators: true,
    },
    include: ["src/**/*.ts"],
  },
  null,
  2
);

function loadConfig(options: DocsCliOptions) {
  return runBuiltModule<ResolvedConfig>({
    module: builtEsm("cli/config.js"),
    exportName: "resolveDocsConfig",
    args: [options],
  });
}

function project(
  prefix: string,
  manifest: { name?: string; version?: string } = {
    name: "fixture-package",
    version: "2.3.4",
  }
): string {
  const root = makeTempDir(prefix);
  writeFile(root, "tsconfig.json", TSCONFIG);
  if (manifest.name !== undefined || manifest.version !== undefined) {
    writeFile(root, "package.json", JSON.stringify(manifest));
  }
  return root;
}

function diagnosticCodes(result: {
  error?: { diagnostics?: { code: string }[] };
}) {
  return (result.error?.diagnostics ?? []).map((entry) => entry.code);
}

afterAll(() => cleanupTempDirs());

describe("built CLI config API", () => {
  it("no longer exports the config-file loaders", () => {
    for (const removed of [
      "loadDocsConfig",
      "findConfigFile",
      "writeDefaultConfig",
      "defineDocsConfig",
      "DEFAULT_CONFIG_FILES",
    ]) {
      expect(cjsConfig[removed]).toBeUndefined();
    }
    expect(typeof cjsConfig.resolveDocsConfig).toBe("function");
  });
});

describe("resolveDocsConfig", () => {
  it("uses the documented defaults when no config file exists", () => {
    const root = project("docaf-config-defaults-");
    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(true);
    const config = result.value as ResolvedConfig;
    expect(config.root).toBe(root);
    expect("configPath" in config).toBe(false);
    expect("config" in config).toBe(false);
    expect(config.project).toEqual({ name: "fixture-package", version: "2.3.4" });
    expect(config.source.tsconfigPath).toBe(path.join(root, "tsconfig.json"));
    expect(config.source.include).toEqual(["src/**/*.ts"]);
    expect(config.source.exclude).toEqual([
      "**/*.spec.ts",
      "**/*.test.ts",
      "**/*.d.ts",
    ]);
    expect(config.publisher).toEqual({ includePrivate: false });
    expect(config.storage.snapshotDirectory).toBe(
      path.join(root, ".decaf-docs")
    );
    expect(config.storage.snapshotPath).toBe(
      path.join(root, ".decaf-docs", "snapshot.json")
    );
    expect(config.storage.manifestPath).toBe(
      path.join(root, ".decaf-docs", "build-cache.json")
    );
    expect(config.targets).toEqual([
      {
        renderer: "angular",
        output: path.join(root, "dist", "docs-angular"),
        routing: "hash",
        baseHref: "./",
        configuration: "production",
      },
    ]);
    expect(config.warnings).toEqual([]);
    expect(config.packageRoot).toBe(REPO_ROOT);
  });

  it("maps CLI arguments through the built module", () => {
    const root = project("docaf-config-mapped-");
    writeFile(root, "tsconfig.docs.json", TSCONFIG);

    const result = loadConfig({
      cwd: root,
      tsconfig: "./tsconfig.docs.json",
      include: ["src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: ["**/*.spec.ts"],
      projectName: "mapped-project",
      projectVersion: "9.8.7",
      includePrivate: true,
      snapshotDirectory: "./snapshots",
      snapshotFile: "docs-snapshot.json",
      renderer: "angular",
      output: "./site",
      baseHref: "/documentation/",
      configuration: "development",
      routing: "hash",
    });

    expect(result.ok).toBe(true);
    const config = result.value as ResolvedConfig;
    expect(config.project).toEqual({
      name: "mapped-project",
      version: "9.8.7",
    });
    expect(config.source.tsconfigPath).toBe(
      path.join(root, "tsconfig.docs.json")
    );
    expect(config.source.include).toEqual([
      "src/**/*.ts",
      "packages/*/src/**/*.ts",
    ]);
    expect(config.publisher).toEqual({ includePrivate: true });
    expect(config.storage.snapshotPath).toBe(
      path.join(root, "snapshots", "docs-snapshot.json")
    );
    expect(config.targets[0]).toEqual({
      renderer: "angular",
      output: path.join(root, "site"),
      routing: "hash",
      baseHref: "/documentation/",
      configuration: "development",
    });
  });

  it("ignores a planted decafdocs.config.ts without importing it", () => {
    const root = project("docaf-config-ignored-ts-");
    const marker = path.join(root, "poisoned-config-ran");
    writeFile(
      root,
      "decafdocs.config.mjs",
      `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(
        marker
      )}, "ran");\nthrow new Error("poisoned config was imported");\n`
    );
    writeFile(
      root,
      "decafdocs.config.ts",
      'throw new Error("poisoned config was imported");\n'
    );

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
    const config = result.value as ResolvedConfig;
    expect(config.project).toEqual({ name: "fixture-package", version: "2.3.4" });
    expect(config.targets[0].baseHref).toBe("./");
  });

  it("reports a missing source tsconfig", () => {
    const root = makeTempDir("docaf-config-tsconfig-");

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
  });

  it.each([
    ["an unsupported renderer", { renderer: "svelte" }, "DOCAF_RENDERER_UNSUPPORTED"],
    ["an unsupported routing mode", { routing: "browser" }, "DOCAF_CONFIG_TARGET_INVALID"],
    ["an empty output directory", { output: " " }, "DOCAF_CONFIG_TARGET_INVALID"],
    ["an unsupported plugin", { plugins: ["unknown"] }, "DOCAF_PLUGIN_UNSUPPORTED"],
    [
      "an unsupported extractor",
      { extractors: ["react"] },
      "DOCAF_COMPONENT_EXTRACTOR_UNSUPPORTED",
    ],
  ])("rejects %s", (_label, options, code) => {
    const root = project("docaf-config-invalid-");

    const result = loadConfig({ cwd: root, ...(options as DocsCliOptions) });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain(code);
  });
});
