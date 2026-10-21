import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_TARGET_CONFIG,
  SUPPORTED_COMPONENT_EXTRACTORS,
  SUPPORTED_PLUGINS,
  SUPPORTED_RENDERERS,
  configFingerprint,
  loadCompilerOptions,
  resolveDocsConfig,
} from "../../src/cli/config";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  REPO_ROOT,
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
      experimentalDecorators: true,
    },
    include: ["src/**/*.ts"],
  },
  null,
  2
);

function project(
  prefix: string,
  manifest: { name?: string; version?: string } | null = {
    name: "fixture-package",
    version: "2.3.4",
  }
): string {
  const root = makeTempDir(prefix);
  writeFile(root, "tsconfig.json", TSCONFIG);
  if (manifest) {
    writeFile(root, "package.json", JSON.stringify(manifest));
  }
  return root;
}

function codesOf(error: unknown): string[] {
  return (
    (error as { diagnostics?: { code: string }[] }).diagnostics ?? []
  ).map((entry) => entry.code);
}

function failureOf(action: () => unknown): {
  name?: string;
  message?: string;
  codes: string[];
} {
  try {
    action();
    throw new Error("expected resolveDocsConfig to fail");
  } catch (error) {
    return {
      name: (error as Error).name,
      message: (error as Error).message,
      codes: codesOf(error),
    };
  }
}

afterAll(() => cleanupTempDirs());

describe("config constants", () => {
  it("exposes the documented default target and supported variants", () => {
    expect(DEFAULT_TARGET_CONFIG).toEqual({
      renderer: "angular",
      output: "./dist/docs-angular",
      routing: "hash",
      baseHref: "./",
      configuration: "production",
    });
    expect(SUPPORTED_RENDERERS).toEqual(["angular"]);
    expect(SUPPORTED_COMPONENT_EXTRACTORS).toEqual(["angular"]);
    expect(SUPPORTED_PLUGINS).toEqual([
      "typescript",
      "category",
      "component",
      "import-types",
      "load",
    ]);
  });
});

describe("resolveDocsConfig defaults", () => {
  it("resolves the documented defaults with no config data at all", () => {
    const root = project("docaf-config-src-defaults-");

    const config = resolveDocsConfig({ cwd: root });

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

  it("infers the project name from the directory when no manifest exists", () => {
    const root = project("docaf-config-no-manifest-", null);
    expect(fs.existsSync(path.join(root, "package.json"))).toBe(false);

    const config = resolveDocsConfig({ cwd: root });

    expect(config.project.name).toBe(path.basename(root));
    expect(config.project.version).toBe("0.0.0");
  });

  it("tolerates a malformed package manifest", () => {
    const root = project("docaf-config-bad-manifest-", null);
    writeFile(root, "package.json", "{ not json");

    const config = resolveDocsConfig({ cwd: root });

    expect(config.project.name).toBe(path.basename(root));
    expect(config.project.version).toBe("0.0.0");
  });

  it("resolves a relative cwd against the process directory", () => {
    const root = project("docaf-config-relative-cwd-");

    const config = resolveDocsConfig({
      cwd: path.relative(process.cwd(), root),
    });

    expect(config.root).toBe(root);
  });

  it('resolves the manifest version when --project-version is "auto"', () => {
    const root = project("docaf-config-auto-version-");

    const config = resolveDocsConfig({ cwd: root, projectVersion: "auto" });

    expect(config.project.version).toBe("2.3.4");
  });
});

describe("resolveDocsConfig argument mapping", () => {
  it("maps every documented CLI argument into the resolved config", () => {
    const root = project("docaf-config-src-map-");
    writeFile(root, "tsconfig.docs.json", TSCONFIG);

    const config = resolveDocsConfig({
      cwd: root,
      tsconfig: "./tsconfig.docs.json",
      include: ["src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.tmp.ts"],
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
    expect(config.source.exclude).toEqual(["**/*.spec.ts", "**/*.tmp.ts"]);
    expect(config.publisher).toEqual({ includePrivate: true });
    expect(config.storage.snapshotDirectory).toBe(
      path.join(root, "snapshots")
    );
    expect(config.storage.snapshotPath).toBe(
      path.join(root, "snapshots", "docs-snapshot.json")
    );
    expect(config.storage.manifestPath).toBe(
      path.join(root, "snapshots", "build-cache.json")
    );
    expect(config.targets).toEqual([
      {
        renderer: "angular",
        output: path.join(root, "site"),
        routing: "hash",
        baseHref: "/documentation/",
        configuration: "development",
      },
    ]);
    expect(config.warnings).toEqual([]);
  });

  it("splits comma and space separated glob and plugin arguments", () => {
    const root = project("docaf-config-src-split-");

    const config = resolveDocsConfig({
      cwd: root,
      include: "src/**/*.ts, packages/*/src/**/*.ts",
      exclude: "**/*.spec.ts **/*.test.ts",
      plugins: "typescript,category",
      extractors: "angular",
    });

    expect(config.source.include).toEqual([
      "src/**/*.ts",
      "packages/*/src/**/*.ts",
    ]);
    expect(config.source.exclude).toEqual([
      "**/*.spec.ts",
      "**/*.test.ts",
    ]);
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toContain("--plugins");
  });

  it("accepts compatibility-only theme and layout arguments with warnings", () => {
    const root = project("docaf-config-src-compat-");

    const config = resolveDocsConfig({
      cwd: root,
      theme: "docs",
      layouts: ["page:DocPageLayout"],
    });

    expect(config.warnings).toEqual([
      expect.stringContaining("--layout"),
      expect.stringContaining("--theme"),
    ]);
  });
});

describe("resolveDocsConfig config-file independence", () => {
  it("ignores a planted decafdocs.config.ts and never imports it", () => {
    const root = project("docaf-config-src-ignored-ts-");
    writeFile(
      root,
      "decafdocs.config.ts",
      'throw new Error("poisoned config was imported");\n'
    );

    const config = resolveDocsConfig({ cwd: root });

    expect(config.project).toEqual({ name: "fixture-package", version: "2.3.4" });
    expect(config.targets[0]).toEqual({
      renderer: "angular",
      output: path.join(root, "dist", "docs-angular"),
      routing: "hash",
      baseHref: "./",
      configuration: "production",
    });
  });

  it("ignores a planted decafdocs.config.mjs with import side effects", () => {
    const root = project("docaf-config-src-ignored-mjs-");
    const marker = path.join(root, "poisoned-config-ran");
    writeFile(
      root,
      "decafdocs.config.mjs",
      `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(
        marker
      )}, "ran");\nthrow new Error("poisoned config was imported");\n`
    );

    const config = resolveDocsConfig({ cwd: root });

    expect(fs.existsSync(marker)).toBe(false);
    expect(config.project.name).toBe("fixture-package");
  });

  it("gives identical results with and without a poisoned config file", () => {
    const plain = project("docaf-config-src-plain-");
    const poisoned = project("docaf-config-src-poisoned-");
    writeFile(
      poisoned,
      "decafdocs.config.mjs",
      'export default { project: { name: "poisoned" } };\n'
    );

    const defaults = resolveDocsConfig({ cwd: plain });
    const withPoison = resolveDocsConfig({ cwd: poisoned });

    expect(withPoison.project).toEqual(defaults.project);
    expect(withPoison.source.include).toEqual(defaults.source.include);
    expect(withPoison.source.exclude).toEqual(defaults.source.exclude);
    expect(withPoison.publisher).toEqual(defaults.publisher);
    expect(withPoison.storage.snapshotPath.endsWith(path.join(".decaf-docs", "snapshot.json"))).toBe(true);
    expect(withPoison.targets.map((target) => ({ ...target, output: path.basename(target.output) }))).toEqual(
      defaults.targets.map((target) => ({ ...target, output: path.basename(target.output) }))
    );
  });
});

describe("resolveDocsConfig validation failures", () => {
  it("rejects a missing source tsconfig", () => {
    const root = makeTempDir("docaf-config-src-missing-tsconfig-");

    const failure = failureOf(() => resolveDocsConfig({ cwd: root }));

    expect(failure.name).toBe("DocsBuildError");
    expect(failure.codes).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
    expect(failure.message).toContain("--tsconfig");
  });

  it("rejects an explicit --tsconfig that does not exist", () => {
    const root = project("docaf-config-src-missing-explicit-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, tsconfig: "./configs/missing.json" })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
  });

  it("rejects an empty --include list", () => {
    const root = project("docaf-config-src-empty-include-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, include: " , " })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_SOURCE");
  });

  it("rejects an unsupported renderer", () => {
    const root = project("docaf-config-src-renderer-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, renderer: "svelte" })
    );

    expect(failure.codes).toContain("DOCAF_RENDERER_UNSUPPORTED");
    expect(failure.message).toContain("Supported renderers: angular");
  });

  it("rejects an unsupported routing mode", () => {
    const root = project("docaf-config-src-routing-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, routing: "browser" as never })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_TARGET_INVALID");
  });

  it("rejects an unsupported configuration mode", () => {
    const root = project("docaf-config-src-configuration-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, configuration: "staging" as never })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_TARGET_INVALID");
  });

  it.each([
    ["--output", { output: " " }],
    ["--base-href", { baseHref: " " }],
  ])("rejects an empty %s value", (_label, options) => {
    const root = project("docaf-config-src-empty-target-");

    const failure = failureOf(() => resolveDocsConfig({ cwd: root, ...options }));

    expect(failure.codes).toContain("DOCAF_CONFIG_TARGET_INVALID");
  });

  it("rejects an empty --snapshot-file value", () => {
    const root = project("docaf-config-src-empty-snapshot-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, snapshotFile: " " })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_SNAPSHOT_UNSUPPORTED");
  });

  it("rejects unsupported plugins", () => {
    const root = project("docaf-config-src-plugins-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, plugins: ["typescript", "unknown-plugin"] })
    );

    expect(failure.codes).toContain("DOCAF_PLUGIN_UNSUPPORTED");
    expect(failure.message).toContain("unknown-plugin");
  });

  it("rejects unsupported component extractors", () => {
    const root = project("docaf-config-src-extractors-");

    const failure = failureOf(() =>
      resolveDocsConfig({ cwd: root, extractors: ["angular", "react"] })
    );

    expect(failure.codes).toContain("DOCAF_COMPONENT_EXTRACTOR_UNSUPPORTED");
    expect(failure.message).toContain("react");
  });
});

describe("loadCompilerOptions", () => {
  it("reads compiler options and forces noEmit", () => {
    const root = project("docaf-config-src-compiler-");
    const options = loadCompilerOptions(path.join(root, "tsconfig.json"));

    expect(options.noEmit).toBe(true);
    expect(options.strict).toBe(true);
  });

  it("reports an unreadable tsconfig", () => {
    const root = project("docaf-config-src-compiler-missing-");
    expect(() =>
      loadCompilerOptions(path.join(root, "missing.json"))
    ).toThrow(/Cannot read/);
  });

  it("reports invalid compiler options as diagnostics", () => {
    const root = project("docaf-config-src-compiler-invalid-", null);
    writeFile(
      root,
      "bad.json",
      JSON.stringify({ compilerOptions: { target: "not-a-target" } })
    );

    try {
      loadCompilerOptions(path.join(root, "bad.json"));
      throw new Error("expected loadCompilerOptions to fail");
    } catch (error) {
      expect((error as Error).name).toBe("DocsBuildError");
      expect(
        codesOf(error).some((code) =>
          code.startsWith("DOCAF_CONFIG_TSCONFIG_")
        )
      ).toBe(true);
    }
  });
});

describe("configFingerprint", () => {
  function defaultConfig(): ResolvedDocsConfig {
    const root = project("docaf-config-src-fingerprint-");
    return resolveDocsConfig({ cwd: root });
  }

  it("is stable for the same resolved config", () => {
    const config = defaultConfig();

    expect(configFingerprint(config)).toBe(configFingerprint(config));
    expect(configFingerprint(config)).toMatch(/^[0-9a-f]+$/);
  });

  it("changes when the publisher or target settings change", () => {
    const config = defaultConfig();
    const publisher = configFingerprint(config);
    const withPrivate = configFingerprint({
      ...config,
      publisher: { includePrivate: true },
    });
    const withTarget = configFingerprint({
      ...config,
      targets: config.targets.map((target) => ({
        ...target,
        configuration: "development" as const,
      })),
    });
    const withBaseHref = configFingerprint({
      ...config,
      targets: config.targets.map((target) => ({
        ...target,
        baseHref: "/docs/",
      })),
    });

    expect(withPrivate).not.toBe(publisher);
    expect(withTarget).not.toBe(publisher);
    expect(withBaseHref).not.toBe(publisher);
  });

  it("changes when the project metadata or source globs change", () => {
    const config = defaultConfig();
    const base = configFingerprint(config);

    expect(
      configFingerprint({ ...config, project: { ...config.project, name: "x" } })
    ).not.toBe(base);
    expect(
      configFingerprint({
        ...config,
        source: { ...config.source, include: ["lib/**/*.ts"] },
      })
    ).not.toBe(base);
  });
});
