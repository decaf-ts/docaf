import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_CONFIG_FILES,
  DEFAULT_TARGET_CONFIG,
  SUPPORTED_COMPONENT_EXTRACTORS,
  SUPPORTED_PLUGINS,
  SUPPORTED_RENDERERS,
  configFingerprint,
  defineDocsConfig,
  findConfigFile,
  loadCompilerOptions,
  loadDocsConfig,
  writeDefaultConfig,
} from "../../src/cli/config";
import type {
  DecafDocsConfig,
  ResolvedDocsConfig,
} from "../../src/cli/types";
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

async function failureOf(action: () => Promise<unknown>): Promise<{
  name?: string;
  message?: string;
  codes: string[];
}> {
  try {
    await action();
    throw new Error("expected loadDocsConfig to fail");
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
    expect(DEFAULT_CONFIG_FILES[0]).toBe("decafdocs.config.ts");
    expect(DEFAULT_CONFIG_FILES.at(-1)).toBe("decafdocs.config.js");
  });

  it("defineDocsConfig is an identity helper", () => {
    const config: DecafDocsConfig = { project: { name: "identity" } };
    expect(defineDocsConfig(config)).toBe(config);
  });
});

describe("findConfigFile", () => {
  it("returns undefined when no config file exists", () => {
    expect(findConfigFile(makeTempDir("docaf-config-none-"))).toBeUndefined();
  });

  it("returns the first candidate in documented order", () => {
    const root = makeTempDir("docaf-config-order-");
    writeFile(root, "decafdocs.config.js", "module.exports = {};\n");
    writeFile(root, "decafdocs.config.mjs", "export default {};\n");

    expect(findConfigFile(root)).toBe(
      path.join(root, "decafdocs.config.mjs")
    );
  });
});

describe("loadDocsConfig defaults", () => {
  it("resolves the documented defaults without a config file", async () => {
    const root = project("docaf-config-src-defaults-");

    const config = await loadDocsConfig({ cwd: root });

    expect(config.root).toBe(root);
    expect(config.configPath).toBeUndefined();
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
        baseHref: "/",
        configuration: "production",
      },
    ]);
    expect(config.warnings).toEqual([]);
    expect(config.packageRoot).toBe(REPO_ROOT);
    expect(config.config).toEqual({});
  });

  it("infers the project name from the directory when no manifest exists", async () => {
    const root = project("docaf-config-no-manifest-", null);
    expect(fs.existsSync(path.join(root, "package.json"))).toBe(false);

    const config = await loadDocsConfig({ cwd: root });

    expect(config.project.name).toBe(path.basename(root));
    expect(config.project.version).toBe("0.0.0");
  });

  it("tolerates a malformed package manifest", async () => {
    const root = project("docaf-config-bad-manifest-", null);
    writeFile(root, "package.json", "{ not json");

    const config = await loadDocsConfig({ cwd: root });

    expect(config.project.name).toBe(path.basename(root));
    expect(config.project.version).toBe("0.0.0");
  });

  it("resolves a relative cwd against the process directory", async () => {
    const root = project("docaf-config-relative-cwd-");

    const config = await loadDocsConfig({ cwd: path.relative(process.cwd(), root) });

    expect(config.root).toBe(root);
  });
});

describe("loadDocsConfig pre-import failures", () => {
  it("rejects a missing explicit --config file", async () => {
    const root = project("docaf-config-src-missing-");

    const failure = await failureOf(() =>
      loadDocsConfig({ cwd: root, configPath: "./missing.config.ts" })
    );

    expect(failure.name).toBe("DocsBuildError");
    expect(failure.codes).toContain("DOCAF_CONFIG_MISSING");
    expect(failure.message).toContain("decaf docs init");
  });

  it("rejects an unsupported config extension", async () => {
    const root = project("docaf-config-src-ext-");
    writeFile(root, "decafdocs.config.json", "{}");

    const failure = await failureOf(() =>
      loadDocsConfig({ cwd: root, configPath: "./decafdocs.config.json" })
    );

    expect(failure.codes).toContain("DOCAF_CONFIG_UNSUPPORTED");
    expect(failure.message).toContain(".json");
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
  async function defaultConfig(): Promise<ResolvedDocsConfig> {
    const root = project("docaf-config-src-fingerprint-");
    return loadDocsConfig({ cwd: root });
  }

  it("is stable for the same resolved config", async () => {
    const config = await defaultConfig();

    expect(configFingerprint(config)).toBe(configFingerprint(config));
    expect(configFingerprint(config)).toMatch(/^[0-9a-f]+$/);
  });

  it("changes when the publisher or target settings change", async () => {
    const config = await defaultConfig();
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

    expect(withPrivate).not.toBe(publisher);
    expect(withTarget).not.toBe(publisher);
  });

  it("changes when the raw config or source globs change", async () => {
    const config = await defaultConfig();
    const base = configFingerprint(config);

    expect(
      configFingerprint({ ...config, config: { project: { name: "x" } } })
    ).not.toBe(base);
    expect(
      configFingerprint({
        ...config,
        source: { ...config.source, include: ["lib/**/*.ts"] },
      })
    ).not.toBe(base);
  });
});

describe("writeDefaultConfig", () => {
  it("writes a starter config and creates parent directories", () => {
    const root = makeTempDir("docaf-config-src-init-");
    const target = path.join(root, "config", "decafdocs.config.ts");

    const written = writeDefaultConfig({ path: target, projectName: "starter" });

    expect(written).toBe(target);
    const content = fs.readFileSync(target, "utf8");
    expect(content).toContain('name: "starter"');
    expect(content).toContain('renderer: "angular"');
    expect(content).toContain('schemaVersion: 1');
  });

  it("infers the project name from the package manifest", () => {
    const root = project("docaf-config-src-init-manifest-");
    const target = path.join(root, "decafdocs.config.ts");

    writeDefaultConfig({ path: target });

    expect(fs.readFileSync(target, "utf8")).toContain(
      'name: "fixture-package"'
    );
  });

  it("falls back to the directory name without a manifest", () => {
    const root = project("docaf-config-src-init-no-manifest-", null);
    const target = path.join(root, "decafdocs.config.ts");

    writeDefaultConfig({ path: target });

    expect(fs.readFileSync(target, "utf8")).toContain(
      `name: ${JSON.stringify(path.basename(root))}`
    );
  });

  it("refuses to overwrite an existing config", () => {
    const root = project("docaf-config-src-init-exists-");
    const target = path.join(root, "decafdocs.config.ts");
    writeFile(root, "decafdocs.config.ts", "export default {};\n");

    try {
      writeDefaultConfig({ path: target });
      throw new Error("expected writeDefaultConfig to fail");
    } catch (error) {
      expect((error as Error).name).toBe("DocsBuildError");
      expect(codesOf(error)).toContain("DOCAF_CONFIG_EXISTS");
    }
  });
});
