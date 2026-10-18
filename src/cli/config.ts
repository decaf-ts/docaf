import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { DocsBuildError } from "../generator/diagnostics";
import { resolveDocafPackageRoot } from "../package-root";
import { stableHash, stableStringify } from "../snapshot/canonical";
import type {
  DecafDocsConfig,
  DecafDocsTargetConfig,
  LoadDocsConfigOptions,
  ResolvedDocsConfig,
  ResolvedDocsTarget,
} from "./types";

/**
 * @description File names considered when searching for the docs config in a project root.
 * @summary Tried in order by {@link findConfigFile}: TypeScript variants (.ts, .mts, .cts)
 * first, then JavaScript variants (.mjs, .cjs, .js).
 */
export const DEFAULT_CONFIG_FILES: readonly string[] = [
  "decafdocs.config.ts",
  "decafdocs.config.mts",
  "decafdocs.config.cts",
  "decafdocs.config.mjs",
  "decafdocs.config.cjs",
  "decafdocs.config.js",
];

/**
 * @description Renderer flavours the docs pipeline can build targets for.
 * @summary Used to validate renderer selections and target configurations; this release ships
 * only the "angular" renderer.
 */
export const SUPPORTED_RENDERERS: readonly string[] = ["angular"];

/**
 * @description Component extractor frameworks supported by the docs generator.
 * @summary Used to validate `components.extractors` in the docs config; this release ships only
 * the "angular" extractor.
 */
export const SUPPORTED_COMPONENT_EXTRACTORS: readonly string[] = ["angular"];

/**
 * @description Docs plugin names accepted in the docs config.
 * @summary Validated against `plugins` for TDS compatibility. The current release always runs
 * the built-in BetterDocs plugin set in a fixed order, so a configured list only triggers a
 * compatibility warning.
 */
export const SUPPORTED_PLUGINS: readonly string[] = [
  "typescript",
  "category",
  "component",
  "import-types",
  "load",
];

/**
 * @description Default renderer target applied when the docs config defines no targets.
 * @summary Builds the angular renderer into ./dist/docs-angular using hash routing, so
 * `decaf docs build` works out of the box without a config file.
 */
export const DEFAULT_TARGET_CONFIG: DecafDocsTargetConfig = {
  renderer: "angular",
  output: "./dist/docs-angular",
  routing: "hash",
};

const KNOWN_CONFIG_KEYS = new Set([
  "project",
  "source",
  "plugins",
  "components",
  "publisher",
  "storage",
  "layouts",
  "theme",
  "targets",
]);

function configError(code: string, message: string): DocsBuildError {
  return new DocsBuildError([
    { severity: "error" as const, code, message },
  ]);
}

/**
 * Identity helper mirroring the TDS configuration API so a `decafdocs.config.ts`
 * file can be written with editor autocompletion.
 */
export function defineDocsConfig(config: DecafDocsConfig): DecafDocsConfig {
  return config;
}

/**
 * @description Searches a directory for the first docs config file that exists.
 * @summary Checks each candidate name from {@link DEFAULT_CONFIG_FILES} in order against the
 * given root directory and returns the first match.
 * @param {string} root - Directory to search in.
 * @returns {string | undefined} Absolute path of the first config file found, or undefined when none exists.
 */
export function findConfigFile(root: string): string | undefined {
  for (const candidate of DEFAULT_CONFIG_FILES) {
    const resolved = path.join(root, candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const dynamicImport = new Function(
  "specifier",
  "return import(specifier);"
) as (specifier: string) => Promise<unknown>;

function normalizeModuleExport(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (
      isRecord(current) &&
      "default" in current &&
      (current.default !== undefined || Object.keys(current).length === 1)
    ) {
      current = current.default;
      continue;
    }
    break;
  }
  if (typeof current === "function") {
    return (current as () => unknown)();
  }
  return current;
}

async function importConfigFile(configPath: string): Promise<DecafDocsConfig> {
  const extension = path.extname(configPath);
  let modulePath = configPath;

  if (extension === ".ts" || extension === ".mts" || extension === ".cts") {
    const source = fs.readFileSync(configPath, "utf8");
    const commonjs = extension === ".cts";
    const transpiled = ts.transpileModule(source, {
      fileName: configPath,
      compilerOptions: {
        module: commonjs ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        sourceMap: false,
        inlineSourceMap: false,
      },
    });
    if (transpiled.diagnostics?.length) {
      throw configError(
        "DOCAF_CONFIG_TRANSPILE",
        `Cannot transpile docs config ${configPath}: ${ts.flattenDiagnosticMessageText(
          transpiled.diagnostics[0].messageText,
          "\n"
        )}`
      );
    }
    const temporary = path.join(
      path.dirname(configPath),
      `.decafdocs.config.${stableHash(source)}.${process.pid}.${randomBytes(4).toString("hex")}${
        commonjs ? ".cjs" : ".mjs"
      }`
    );
    fs.writeFileSync(temporary, transpiled.outputText, {
      encoding: "utf8",
      flag: "wx"
    });
    modulePath = temporary;
    try {
      const imported = await dynamicImport(
        `${pathToFileURL(modulePath).href}?v=${Date.now()}`
      );
      return normalizeModuleExport(imported) as DecafDocsConfig;
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  if (
    extension === ".cjs" ||
    extension === ".js" ||
    extension === ".mjs" ||
    extension === ""
  ) {
    const imported = await dynamicImport(
      `${pathToFileURL(modulePath).href}?v=${Date.now()}`
    );
    return normalizeModuleExport(imported) as DecafDocsConfig;
  }

  throw configError(
    "DOCAF_CONFIG_UNSUPPORTED",
    `Unsupported docs config extension "${extension}". Use decafdocs.config.ts, .mts, .cts, .mjs, .cjs, or .js.`
  );
}

async function readConfig(options: LoadDocsConfigOptions): Promise<{
  root: string;
  configPath?: string;
  config: DecafDocsConfig;
}> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  let configPath: string | undefined;
  if (options.configPath) {
    configPath = path.resolve(cwd, options.configPath);
    if (!fs.existsSync(configPath)) {
      throw configError(
        "DOCAF_CONFIG_MISSING",
        `Docs config not found at ${configPath}. Create one with "decaf docs init" or pass an existing --config path.`
      );
    }
  } else {
    configPath = findConfigFile(cwd);
  }
  if (!configPath) {
    return { root: cwd, config: {} };
  }
  const loaded = await importConfigFile(configPath);
  if (!isRecord(loaded)) {
    throw configError(
      "DOCAF_CONFIG_INVALID",
      `Docs config ${configPath} must export a configuration object (default export).`
    );
  }
  return { root: path.dirname(configPath), configPath, config: loaded };
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

function assertStringArray(
  value: unknown,
  code: string,
  message: string
): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw configError(code, message);
  }
  return value as string[];
}

function resolveTarget(
  target: DecafDocsTargetConfig,
  index: number,
  root: string
): ResolvedDocsTarget {
  if (!isRecord(target)) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      `targets[${index}] must be an object with "renderer" and "output".`
    );
  }
  if (typeof target.renderer !== "string" || !target.renderer.trim()) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      `targets[${index}].renderer must be a non-empty string.`
    );
  }
  if (typeof target.output !== "string" || !target.output.trim()) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      `targets[${index}] (${target.renderer}).output must be a non-empty directory path.`
    );
  }
  if (target.routing !== undefined && target.routing !== "hash") {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      `targets[${index}] (${target.renderer}).routing only supports "hash" in this release.`
    );
  }
  if (
    target.configuration !== undefined &&
    target.configuration !== "production" &&
    target.configuration !== "development"
  ) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      `targets[${index}] (${target.renderer}).configuration must be "production" or "development".`
    );
  }
  return {
    renderer: target.renderer,
    output: path.resolve(root, target.output),
    routing: target.routing ?? "hash",
    baseHref: target.baseHref ?? "/",
    configuration: target.configuration ?? "production",
  };
}

/**
 * Loads, validates, and normalizes a docs configuration. Missing files fall
 * back to the documented defaults so `decaf docs build` works in a project
 * that only has a `src` directory and a `tsconfig.json`.
 */
export async function loadDocsConfig(
  options: LoadDocsConfigOptions = {}
): Promise<ResolvedDocsConfig> {
  const { root, configPath, config } = await readConfig(options);
  const warnings: string[] = [];

  for (const key of Object.keys(config)) {
    if (!KNOWN_CONFIG_KEYS.has(key)) {
      throw configError(
        "DOCAF_CONFIG_UNKNOWN_OPTION",
        `Unknown docs config option "${key}" in ${configPath ?? root}. Supported options: ${[
          ...KNOWN_CONFIG_KEYS,
        ].join(", ")}.`
      );
    }
  }

  if (config.plugins !== undefined) {
    const plugins = assertStringArray(
      config.plugins,
      "DOCAF_CONFIG_PLUGINS",
      "plugins must be an array of plugin names."
    )!;
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
      "plugins is accepted for TDS §14 compatibility; this release always runs the built-in BetterDocs plugin set in a fixed order."
    );
  }

  const extractors =
    config.components?.extractors !== undefined
      ? assertStringArray(
          config.components.extractors,
          "DOCAF_CONFIG_EXTRACTORS",
          "components.extractors must be an array of component framework names."
        )!
      : ["angular"];
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

  if (config.components?.previews !== undefined) {
    warnings.push(
      "components.previews is accepted for TDS §14 compatibility; previews are derived from the published snapshot by the selected target."
    );
  }

  const publisher = config.publisher ?? {};
  const ignoredPublisherOptions = [
    publisher.includeSource,
    publisher.includeTutorials,
    publisher.includeSearch,
    publisher.betterDocsCompatibility,
    publisher.preserveCategories,
    publisher.preserveSubcategories,
  ].filter((value) => value !== undefined);
  if (ignoredPublisherOptions.length) {
    warnings.push(
      "publisher.includeSource, includeTutorials, includeSearch, betterDocsCompatibility, preserveCategories and preserveSubcategories are accepted for TDS §14 compatibility but are not configurable in this release."
    );
  }

  const storage = config.storage ?? {};
  if (storage.adapter !== undefined && storage.adapter !== "ram") {
    throw configError(
      "DOCAF_CONFIG_STORAGE_UNSUPPORTED",
      `storage.adapter must be "ram"; received "${String(storage.adapter)}".`
    );
  }
  const snapshotSettings = storage.snapshot ?? {};
  if (
    snapshotSettings.format !== undefined &&
    snapshotSettings.format !== "decaf-json"
  ) {
    throw configError(
      "DOCAF_CONFIG_SNAPSHOT_UNSUPPORTED",
      `storage.snapshot.format must be "decaf-json"; received "${String(
        snapshotSettings.format
      )}".`
    );
  }
  if (
    snapshotSettings.schemaVersion !== undefined &&
    snapshotSettings.schemaVersion !== 1
  ) {
    throw configError(
      "DOCAF_CONFIG_SNAPSHOT_UNSUPPORTED",
      `storage.snapshot.schemaVersion must be 1; received ${String(
        snapshotSettings.schemaVersion
      )}.`
    );
  }
  if (config.layouts !== undefined) {
    warnings.push(
      "layouts is accepted for TDS §14 compatibility; semantic layouts are resolved from the published snapshot by the target."
    );
  }
  if (config.theme !== undefined) {
    warnings.push(
      "theme is accepted for TDS §14 compatibility; the Angular target ships the docs stylesheet."
    );
  }

  const source = config.source ?? {};
  const tsconfigPath = path.resolve(root, source.tsconfig ?? "./tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    throw configError(
      "DOCAF_CONFIG_TSCONFIG_MISSING",
      `Docs source tsconfig not found at ${tsconfigPath}. Point source.tsconfig at an existing tsconfig.json or create one with "decaf docs init".`
    );
  }
  const include =
    assertStringArray(
      source.include,
      "DOCAF_CONFIG_SOURCE",
      "source.include must be an array of glob patterns."
    ) ?? ["src/**/*.ts"];
  const exclude =
    assertStringArray(
      source.exclude,
      "DOCAF_CONFIG_SOURCE",
      "source.exclude must be an array of glob patterns."
    ) ?? ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"];

  const configuredTargets =
    config.targets === undefined ? [DEFAULT_TARGET_CONFIG] : config.targets;
  if (!Array.isArray(configuredTargets) || !configuredTargets.length) {
    throw configError(
      "DOCAF_CONFIG_TARGET_INVALID",
      "targets must be a non-empty array of renderer/output entries."
    );
  }
  const targets = configuredTargets.map((target, index) =>
    resolveTarget(target, index, root)
  );

  const snapshotDirectory = path.resolve(
    root,
    snapshotSettings.directory ?? "./.decaf-docs"
  );
  const snapshotFile = snapshotSettings.file ?? "snapshot.json";

  return {
    root,
    configPath,
    packageRoot: resolveDocafPackageRoot(root),
    project: inferProject(
      root,
      config.project?.name,
      config.project?.version
    ),
    source: {
      tsconfigPath,
      include,
      exclude,
    },
    publisher: {
      includePrivate: publisher.includePrivate ?? false,
    },
    storage: {
      snapshotDirectory,
      snapshotPath: path.join(snapshotDirectory, snapshotFile),
      manifestPath: path.join(snapshotDirectory, "build-cache.json"),
    },
    targets,
    warnings,
    config,
  };
}

/**
 * @description Reads a tsconfig.json and returns its compiler options.
 * @summary Parses the tsconfig at the given path, converts its `compilerOptions` JSON into
 * TypeScript compiler options relative to the tsconfig's directory, forces `noEmit`, and
 * surfaces parse/conversion errors as DocsBuildError diagnostics.
 * @param {string} tsconfigPath - Path to the tsconfig file to load.
 * @returns {ts.CompilerOptions} The converted compiler options with `noEmit` enabled.
 * @throws {DocsBuildError} When the tsconfig cannot be read or its compiler options are invalid.
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
 * include/exclude globs), publisher flags, per-target renderer/routing/configuration, and the
 * raw config. The value is stored in the build cache manifest and compared on later runs to
 * decide whether a previously written snapshot can be reused.
 * @param {ResolvedDocsConfig} config - The resolved docs configuration to fingerprint.
 * @returns {string} Stable hash string identifying this configuration.
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
      })),
      config: config.config,
    })
  );
}

/**
 * @description Options for `decaf docs init` config file generation.
 * @summary Specifies the path of the config file to create and optionally a project name to
 * embed; when omitted the name is inferred from the surrounding package manifest or directory.
 */
export interface InitConfigOptions {
  path: string;
  projectName?: string;
}

/**
 * @description Writes a starter `decafdocs.config.ts` file.
 * @summary Refuses to overwrite an existing config, infers the project name from the given
 * options, the package manifest, or the directory name, writes a default config covering
 * project/source/components/publisher/storage/targets, creating parent directories as needed,
 * and returns the resolved file path.
 * @param {InitConfigOptions} options - Target path and optional project name.
 * @returns {string} Absolute path of the created config file.
 * @throws {DocsBuildError} When a config file already exists at the target path.
 */
export function writeDefaultConfig(options: InitConfigOptions): string {
  const target = path.resolve(options.path);
  if (fs.existsSync(target)) {
    throw configError(
      "DOCAF_CONFIG_EXISTS",
      `Docs config already exists at ${target}. Edit it instead of running "decaf docs init" again.`
    );
  }
  const root = path.dirname(target);
  const manifest = readPackageManifest(root);
  const projectName =
    options.projectName ?? manifest.name ?? path.basename(root) ?? "docs";
  const content = `export default {
  project: {
    name: ${JSON.stringify(projectName)},
    version: "auto",
  },
  source: {
    tsconfig: "./tsconfig.json",
    include: ["src/**/*.ts"],
    exclude: ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],
  },
  components: {
    extractors: ["angular"],
  },
  publisher: {
    includePrivate: false,
  },
  storage: {
    adapter: "ram",
    snapshot: {
      format: "decaf-json",
      schemaVersion: 1,
    },
  },
  targets: [
    {
      renderer: "angular",
      output: "./dist/docs-angular",
      routing: "hash",
    },
  ],
};
`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
}
