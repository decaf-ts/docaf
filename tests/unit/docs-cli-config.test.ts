import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  REPO_ROOT,
  builtEsm,
  cleanupTempDirs,
  makeTempDir,
  runBuiltModule,
  writeFile,
} from "../support/harness";

const requireCjs = createRequire(__filename);
const { defineDocsConfig } = requireCjs(
  "../../lib/cjs/cli/config.cjs"
) as typeof import("../../src/cli/config");

type LoadedConfig = ResolvedDocsConfig;

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

function loadConfig(options: { cwd: string; configPath?: string }) {
  return runBuiltModule<LoadedConfig>({
    module: builtEsm("cli/config.js"),
    exportName: "loadDocsConfig",
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

function diagnosticCodes(result: { error?: { diagnostics?: { code: string }[] } }) {
  return (result.error?.diagnostics ?? []).map((entry) => entry.code);
}

afterAll(() => cleanupTempDirs());

describe("loadDocsConfig", () => {
  it("uses the documented defaults when no config file exists", () => {
    const root = project("docaf-config-defaults-");
    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(true);
    const config = result.value as LoadedConfig;
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
  });

  it("rejects unknown top-level config keys", () => {
    const root = project("docaf-config-unknown-");
    writeFile(
      root,
      "decafdocs.config.mjs",
      'export default { project: { name: "unknown" }, unrelatedOption: true };\n'
    );

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain("DOCAF_CONFIG_UNKNOWN_OPTION");
    expect(result.error?.message).toContain("unrelatedOption");
  });

  it("reports a missing explicit --config file", () => {
    const root = project("docaf-config-missing-");

    const result = loadConfig({ cwd: root, configPath: "./missing.config.ts" });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain("DOCAF_CONFIG_MISSING");
  });

  it("reports a missing source tsconfig", () => {
    const root = makeTempDir("docaf-config-tsconfig-");
    writeFile(
      root,
      "decafdocs.config.mjs",
      'export default { source: { tsconfig: "./configs/missing.json" } };\n'
    );

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
  });

  it.each([
    [
      "an unsupported routing mode",
      'export default { targets: [{ renderer: "angular", output: "./dist/docs", routing: "browser" }] };\n',
    ],
    [
      "a target without an output directory",
      'export default { targets: [{ renderer: "angular" }] };\n',
    ],
    ["an empty targets array", "export default { targets: [] };\n"],
  ])("rejects %s", (_label, configSource) => {
    const root = project("docaf-config-target-");
    writeFile(root, "decafdocs.config.mjs", configSource);

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(false);
    expect(result.error?.name).toBe("DocsBuildError");
    expect(diagnosticCodes(result)).toContain("DOCAF_CONFIG_TARGET_INVALID");
  });

  it("loads a TypeScript config discovered in the project root", () => {
    const root = project("docaf-config-ts-");
    writeFile(
      root,
      "decafdocs.config.ts",
      'export default {\n  project: { name: "ts-config", version: "3.2.1" },\n};\n'
    );

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(true);
    const config = result.value as LoadedConfig;
    expect(config.configPath).toBe(path.join(root, "decafdocs.config.ts"));
    expect(config.project).toEqual({ name: "ts-config", version: "3.2.1" });
    expect(
      fs
        .readdirSync(root)
        .filter((entry) => entry.startsWith(".decafdocs.config."))
    ).toEqual([]);
  });

  it("loads a CommonJS JavaScript config", () => {
    const root = project("docaf-config-js-");
    writeFile(
      root,
      "decafdocs.config.js",
      'module.exports = { project: { name: "js-config", version: "4.5.6" } };\n'
    );

    const result = loadConfig({ cwd: root });

    expect(result.ok).toBe(true);
    const config = result.value as LoadedConfig;
    expect(config.configPath).toBe(path.join(root, "decafdocs.config.js"));
    expect(config.project).toEqual({ name: "js-config", version: "4.5.6" });
  });

  it("defineDocsConfig is an identity helper", () => {
    const input = {
      project: { name: "identity", version: "1.0.0" },
      source: { include: ["src/**/*.ts"] },
    };

    expect(defineDocsConfig(input)).toBe(input);
  });
});
