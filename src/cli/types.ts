import type { DocsSnapshotV1 } from "../snapshot";

/**
 * Framework-neutral decaf docs configuration. The shape follows TDS §14, but
 * only the options the current generator/targets actually honour are applied;
 * accepted-but-unapplied settings are reported as warnings by the loader.
 */
export interface DecafDocsConfig {
  project?: {
    name?: string;
    version?: string;
  };
  source?: {
    tsconfig?: string;
    include?: string[];
    exclude?: string[];
  };
  plugins?: string[];
  components?: {
    extractors?: string[];
    previews?: {
      enabled?: boolean;
      native?: boolean;
      crossFramework?: "iframe" | "none";
      fixturesDirectory?: string;
    };
  };
  publisher?: {
    includePrivate?: boolean;
    includeSource?: boolean;
    includeTutorials?: boolean;
    includeSearch?: boolean;
    betterDocsCompatibility?: boolean;
    preserveCategories?: boolean;
    preserveSubcategories?: boolean;
  };
  storage?: {
    adapter?: string;
    snapshot?: {
      format?: string;
      schemaVersion?: number;
      directory?: string;
      file?: string;
    };
  };
  layouts?: Record<string, string>;
  theme?: {
    name?: string;
  };
  targets?: DecafDocsTargetConfig[];
}

/**
 * @description Configuration of a single renderer target in the docs config file.
 * @summary Declares which renderer to build with, the output directory for the generated site,
 * and optional overrides such as the routing strategy (hash), the base href, and the Angular
 * build configuration used when the target is {@link DecafDocsConfig}'s angular target.
 */
export interface DecafDocsTargetConfig {
  renderer: string;
  output: string;
  routing?: "hash";
  baseHref?: string;
  configuration?: "production" | "development";
}

/**
 * @description A docs target configuration with every option resolved to its final value.
 * @summary Produced by applying the config defaults: routing is always "hash", and baseHref,
 * configuration, and output fall back to their defaults when not specified, so downstream
 * targets never have to handle missing values.
 */
export interface ResolvedDocsTarget {
  renderer: string;
  output: string;
  routing: "hash";
  baseHref: string;
  configuration: "production" | "development";
}

/**
 * @description Fully resolved docs configuration produced by loading a project's docs config.
 * @summary Contains the resolved paths (config root, optional config file path, docaf package
 * root), project metadata, source discovery inputs (tsconfig path, include/exclude globs),
 * publisher flags, snapshot storage locations (snapshot directory, file, and manifest), the
 * resolved targets, any warnings emitted while applying accepted-but-unapplied settings, and
 * the original raw config for downstream consumers.
 */
export interface ResolvedDocsConfig {
  root: string;
  configPath?: string;
  packageRoot: string;
  project: {
    name: string;
    version: string;
  };
  source: {
    tsconfigPath: string;
    include: string[];
    exclude: string[];
  };
  publisher: {
    includePrivate: boolean;
  };
  storage: {
    snapshotDirectory: string;
    snapshotPath: string;
    manifestPath: string;
  };
  targets: ResolvedDocsTarget[];
  warnings: string[];
  config: DecafDocsConfig;
}

/**
 * @description Options for loading the docs configuration.
 * @summary Allows overriding the working directory used for config discovery and forcing an
 * explicit config file path instead of searching the default locations.
 */
export interface LoadDocsConfigOptions {
  cwd?: string;
  configPath?: string;
}

/**
 * @description A source file selected for docs extraction.
 * @summary Carries both the absolute path used for reading/parsing and the path relative to
 * the config root, which is recorded in the snapshot for stable reporting.
 */
export interface DocsSourceFile {
  absolute: string;
  relative: string;
}

/**
 * @description Resolved inputs for a docs extraction run.
 * @summary Bundles the selected source files, the TypeScript compiler options resolved from
 * the configured tsconfig, and the configuration fingerprint used to decide whether a cached
 * snapshot can be reused.
 */
export interface DocsInputs {
  files: DocsSourceFile[];
  compilerOptions: import("typescript").CompilerOptions;
  fingerprint: string;
}

/**
 * @description Build outcome for a single renderer target.
 * @summary Reports the renderer, its output directory, the generated files, how long the build
 * took, and any warnings collected while building that target.
 */
export interface DocsTargetSummary {
  renderer: string;
  output: string;
  files: string[];
  durationMs: number;
  warnings: string[];
}

/**
 * @description Overall result of a docs CLI operation (build or snapshot).
 * @summary Aggregates the operation mode, project metadata, the snapshot location, whether the
 * snapshot was reused from cache, the configuration fingerprint, element counts, per-target
 * build summaries, collected warnings, total duration, and the full produced snapshot.
 */
export interface DocsOperationSummary {
  mode: "build" | "snapshot";
  project: {
    name: string;
    version: string;
  };
  snapshotPath: string;
  cacheHit: boolean;
  fingerprint: string;
  counts: Record<string, number>;
  targets: DocsTargetSummary[];
  warnings: string[];
  durationMs: number;
  snapshot: DocsSnapshotV1;
}
