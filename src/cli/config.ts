import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { DocsBuildError } from "../generator/diagnostics";
import { resolveDocafPackageRoot } from "../package-root";
import { stableHash, stableStringify } from "../snapshot/canonical";
import type {
  DocsCliOptions,
  ResolvedDocsConfig,
  ResolvedDocsTarget,
} from "./types";

/**
 * @description Renderer flavours the docs pipeline can build targets for.
 * @summary Used to validate renderer selections and target configurations; this release ships
 * only the "angular" renderer.
 * @constant {readonly string[]} SUPPORTED_RENDERERS
 * @readonly
 * @memberOf module:docaf.cli
 */
export const SUPPORTED_RENDERERS: readonly string[] = ["angular"];

/**
 * @description Component extractor frameworks supported by the docs generator.
 * @summary Used to validate `--extractors`; this release ships only the "angular" extractor.
 * @constant {readonly string[]} SUPPORTED_COMPONENT_EXTRACTORS
 * @readonly
 * @memberOf module:docaf.cli
 */
export const SUPPORTED_COMPONENT_EXTRACTORS: readonly string[] = ["angular"];

/**
 * @description Docs plugin names accepted by `--plugins`.
 * @summary Validated for TDS compatibility. The current release always runs the built-in
 * BetterDocs plugin set in a fixed order, so a configured list only triggers a compatibility
 * warning.
 * @constant {readonly string[]} SUPPORTED_PLUGINS
 * @readonly
 * @memberOf module:docaf.cli
 */
export const SUPPORTED_PLUGINS: readonly string[] = [
  "typescript",
  "category",
  "component",
  "import-types",
  "load",
];

/**
 * @description Default renderer target applied when no target flags are given.
 * @summary Builds the angular renderer into ./dist/docs-angular using hash routing and a
 * relative base href, so `decaf docs build` works with no arguments or config file.
 * @constant DEFAULT_TARGET_CONFIG
 * @readonly
 * @property {string} renderer Renderer flavour of the default target ("angular").
 * @property {string} output Output directory of the default target ("./dist/docs-angular").
 * @property {"hash"} routing Routing strategy of the default target ("hash").
 * @property {string} baseHref Base href of the default target ("./", file-protocol safe).
 * @property {"production" | "development"} configuration Angular build configuration ("production").
 * @memberOf module:docaf.cli
 */
export const DEFAULT_TARGET_CONFIG = {
  renderer: "angular",
  output: "./dist/docs-angular",
  routing: "hash",
  baseHref: "./",
  configuration: "production",
} as const;

function configError(code: string, message: string): DocsBuildError {
  return new DocsBuildError([
    { severity: "error" as const, code, message },
  ]);
}

function asList(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .flatMap((entry) => entry.split(/[,\s]+/))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertNonEmpty(
  value: string | undefined,
  code: string,
  message: string
): string | undefined {
  if (value === undefined) return undefined;
  if (!value.trim()) throw configError(code, message);
  return value;
}

function readPackageManifest(
  directory: string
): { name?: string; version?: string } {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8")
    ) as { name?: string; version?: string };
    return manifest;
  } catch {
    return {};
  }
}

function inferProject(
  root: string,
  name: string | undefined,
  version: string | undefined
): { name: string; version: string } {
  const manifest = readPackageManifest(root);
  return {
    name: name ?? manifest.name ?? path.basename(root) ?? "Documentation",
    version:
      !version || version === "auto"
        ? manifest.version ?? "0.0.0"
        : version,
  };
}

function resolveTarget(
  options: DocsCliOptions,
  root: string
): ResolvedDocsTarget {
  const renderer = assertNonEmpty(
    options.renderer,
    "DOCAF_CONFIG_TARGET_INVALID",
    "--renderer must be a non-empty string."
  ) ?? DEFAULT_TARGET_CONFIG.renderer;
  if (!SUPPORTED_RENDERERS.includes(renderer)) {
    throw configError(
      "DOCAF_RENDERER_UNSUPPORTED",
      `Unsupported docs renderer "${renderer}". Supported renderers: ${SUPPORTED_RENDERERS.join(
        ", "
      )}.`
    );
  }
  const output = assertNonEmpty(
    options.output,
    "DOCAF_CONFIG_TARGET_INVALID",
    "--output must be a non-empty directory path."
  ) ?? DEFAULT_TARGET_CONFIG.output;
  if (options.routing !== undefined && options.routing !== "hash") {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      '--routing only supports "hash" in this release.'
    );
  }
  if (
    options.configuration !== undefined &&
    options.configuration !== "production" &&
    options.configuration !== "development"
  ) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      '--configuration must be "production" or "development".'
    );
  }
  const baseHref = assertNonEmpty(
    options.baseHref,
    "DOCAF_CONFIG_TARGET_INVALID",
    "--base-href must be a non-empty string."
  ) ?? DEFAULT_TARGET_CONFIG.baseHref;
  return {
    renderer,
    output: path.resolve(root, output),
    routing: "hash",
    baseHref,
    configuration: options.configuration ?? DEFAULT_TARGET_CONFIG.configuration,
  };
}

/**
 * @description Resolves the docs configuration from CLI arguments only.
 * @summary Applies every documented default (root from `--cwd` or `process.cwd()`, tsconfig,
 * include/exclude globs, snapshot storage, and the {@link DEFAULT_TARGET_CONFIG} target),
 * validates the renderer/extractor/plugin selections, and reports accepted-but-unapplied
 * settings (plugins, layouts, theme) as warnings. The CLI never reads, imports, or discovers a
 * `decafdocs.config.*` file: omitted arguments fall back to the documented defaults so
 * `decaf docs build` works in a project that only has a `src` directory and a
 * `tsconfig.json`.
 * @function resolveDocsConfig
 * @param {DocsCliOptions} [options={}] - The CLI arguments to resolve; every field is optional.
 * @returns {ResolvedDocsConfig} The fully resolved configuration for one docs run.
 * @throws {DocsBuildError} When an argument is invalid, a renderer/extractor/plugin is
 * unsupported, the tsconfig is missing, or no include pattern is given.
 * @example
 * ```ts
 * const config = resolveDocsConfig({ cwd: process.cwd() });
 * ```
 * @memberOf module:docaf.cli
 */
export function resolveDocsConfig(
  options: DocsCliOptions = {}
): ResolvedDocsConfig {
  const root = path.resolve(options.cwd ?? process.cwd());
  const warnings: string[] = [];

  const plugins = asList(options.plugins);
  if (plugins) {
    const unknown = plugins.filter(
      (plugin) => !SUPPORTED_PLUGINS.includes(plugin)
    );
    if (unknown.length) {
      throw configError(
        "DOCAF_PLUGIN_UNSUPPORTED",
        `Unsupported docs plugin(s): ${unknown.join(
          ", "
        )}. Supported plugins: ${SUPPORTED_PLUGINS.join(", ")}.`
      );
    }
    warnings.push(
      "--plugins is accepted for TDS §14 compatibility; this release always runs the built-in BetterDocs plugin set in a fixed order."
    );
  }

  const extractors = asList(options.extractors) ?? ["angular"];
  const unsupportedExtractors = extractors.filter(
    (extractor) => !SUPPORTED_COMPONENT_EXTRACTORS.includes(extractor)
  );
  if (unsupportedExtractors.length) {
    throw configError(
      "DOCAF_COMPONENT_EXTRACTOR_UNSUPPORTED",
      `Unsupported component extractor(s): ${unsupportedExtractors.join(
        ", "
      )}. This release ships only the angular extractor; add a ComponentExtractor and register it before enabling another framework.`
    );
  }

  if (options.layouts !== undefined) {
    warnings.push(
      "--layout is accepted for TDS §14 compatibility; semantic layouts are resolved from the published snapshot by the target."
    );
  }
  if (options.theme !== undefined) {
    warnings.push(
      "--theme is accepted for TDS §14 compatibility; the Angular target ships the docs stylesheet."
    );
  }

  const tsconfigPath = path.resolve(
    root,
    options.tsconfig ?? "./tsconfig.json"
  );
  if (!fs.existsSync(tsconfigPath)) {
    throw configError(
      "DOCAF_CONFIG_TSCONFIG_MISSING",
      `Docs source tsconfig not found at ${tsconfigPath}. Point --tsconfig at an existing tsconfig.json.`
    );
  }

  const include = asList(options.include) ?? ["src/**/*.ts"];
  const exclude = asList(options.exclude) ?? [
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.d.ts",
  ];

  if (!include.length) {
    throw configError(
      "DOCAF_CONFIG_SOURCE",
      "--include must contain at least one glob pattern."
    );
  }

  const snapshotDirectory = path.resolve(
    root,
    options.snapshotDirectory ?? "./.decaf-docs"
  );
  const snapshotFile = assertNonEmpty(
    options.snapshotFile,
    "DOCAF_CONFIG_SNAPSHOT_UNSUPPORTED",
    "--snapshot-file must be a non-empty file name."
  ) ?? "snapshot.json";

  return {
    root,
    packageRoot: resolveDocafPackageRoot(root),
    project: inferProject(
      root,
      options.projectName,
      options.projectVersion
    ),
    source: {
      tsconfigPath,
      include,
      exclude,
    },
    publisher: {
      includePrivate: options.includePrivate ?? false,
    },
    storage: {
      snapshotDirectory,
      snapshotPath: path.join(snapshotDirectory, snapshotFile),
      manifestPath: path.join(snapshotDirectory, "build-cache.json"),
    },
    targets: [resolveTarget(options, root)],
    warnings,
  };
}

/**
 * @description Reads a tsconfig.json and returns its compiler options.
 * @summary Parses the tsconfig at the given path, converts its `compilerOptions` JSON into
 * TypeScript compiler options relative to the tsconfig's directory, forces `noEmit`, and
 * surfaces parse/conversion errors as DocsBuildError diagnostics.
 * @function loadCompilerOptions
 * @param {string} tsconfigPath - Path to the tsconfig file to load.
 * @returns {ts.CompilerOptions} The converted compiler options with `noEmit` enabled.
 * @throws {DocsBuildError} When the tsconfig cannot be read or its compiler options are invalid.
 * @memberOf module:docaf.cli
 */
export function loadCompilerOptions(
  tsconfigPath: string
): ts.CompilerOptions {
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (read.error) {
    throw configError(
      "DOCAF_CONFIG_TSCONFIG_INVALID",
      `Cannot read ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(
        read.error.messageText,
        "\n"
      )}`
    );
  }
  const converted = ts.convertCompilerOptionsFromJson(
    (read.config as { compilerOptions?: Record<string, unknown> })
      .compilerOptions ?? {},
    path.dirname(tsconfigPath),
    tsconfigPath
  );
  if (converted.errors.length) {
    throw new DocsBuildError(
      converted.errors.map((diagnostic) => ({
        severity: "error" as const,
        code: `DOCAF_CONFIG_TSCONFIG_${diagnostic.code}`,
        message: ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n"
        ),
      }))
    );
  }
  return { ...converted.options, noEmit: true };
}

/**
 * @description Computes a stable hash fingerprint of the resolved docs configuration.
 * @summary Hashes the canonical form of the project metadata, source settings (tsconfig path,
 * include/exclude globs), publisher flags, per-target renderer/routing/configuration, and base
 * href. The value is stored in the build cache manifest and compared on later runs to decide
 * whether a previously written snapshot can be reused.
 * @function configFingerprint
 * @param {ResolvedDocsConfig} config - The resolved configuration to fingerprint.
 * @returns {string} Deterministic hash of the cache-relevant configuration subset.
 * @memberOf module:docaf.cli
 */
export function configFingerprint(config: ResolvedDocsConfig): string {
  return stableHash(
    stableStringify({
      project: config.project,
      source: {
        tsconfig: config.source.tsconfigPath,
        include: config.source.include,
        exclude: config.source.exclude,
      },
      publisher: config.publisher,
      targets: config.targets.map((target) => ({
        renderer: target.renderer,
        routing: target.routing,
        configuration: target.configuration,
        baseHref: target.baseHref,
      })),
    })
  );
}
