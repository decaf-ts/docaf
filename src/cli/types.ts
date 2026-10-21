import type { DocsSnapshotV1 } from "../snapshot";

/**
 * @description Framework-neutral decaf docs configuration.
 * @summary The shape follows TDS §14, but only the options the current generator/targets
 * actually honour are applied; accepted-but-unapplied settings are reported as warnings by
 * the loader.
 * @interface DecafDocsConfig
 * @memberOf module:docaf.cli
 */
export interface DecafDocsConfig {
  /**
   * Project metadata for the generated documentation.
   *
   * Falls back to the `package.json` name/version of the config root when omitted.
   */
  project?: {
    /** Display name of the documented project. */
    name?: string;
    /** Version string shown alongside the project name. */
    version?: string;
  };

  /**
   * Source discovery settings for documentation extraction.
   *
   * `tsconfig` supplies the compiler options; `include`/`exclude` select the
   * TypeScript files to parse (glob syntax as accepted by the CLI arguments).
   */
  source?: {
    /** Path to the tsconfig.json providing the compiler options. */
    tsconfig?: string;
    /** Glob patterns selecting the source files to document. */
    include?: string[];
    /** Glob patterns excluding matched files from documentation. */
    exclude?: string[];
  };

  /**
   * Documentation plugin names, accepted for TDS §14 compatibility.
   *
   * This release always runs the built-in BetterDocs plugin set in a fixed order;
   * unknown names are rejected and known names only produce a compatibility warning.
   */
  plugins?: string[];

  /**
   * Component extraction settings.
   *
   * `extractors` selects the framework extractors to run; `previews` controls how
   * component previews are rendered in the output.
   */
  components?: {
    /** Names of the component extractors to run (e.g. `["angular"]`). */
    extractors?: string[];
    /** Preview rendering options for extracted components. */
    previews?: {
      /** Whether component previews are emitted at all. */
      enabled?: boolean;
      /** Whether previews run in the renderer's native runtime. */
      native?: boolean;
      /** How cross-framework previews are rendered (`"iframe"` or `"none"`). */
      crossFramework?: "iframe" | "none";
      /** Directory holding preview fixture files. */
      fixturesDirectory?: string;
    };
  };

  /**
   * Publisher flags controlling which content is emitted.
   *
   * Only `includePrivate` is currently applied; the remaining flags are accepted for
   * TDS §14 compatibility and reported as warnings when set.
   */
  publisher?: {
    /** Whether private declarations are included in the output. */
    includePrivate?: boolean;
    /** Whether source file references are published (compatibility only). */
    includeSource?: boolean;
    /** Whether tutorials are published (compatibility only). */
    includeTutorials?: boolean;
    /** Whether a search index is generated (compatibility only). */
    includeSearch?: boolean;
    /** Whether BetterDocs-compatible output is emitted (compatibility only). */
    betterDocsCompatibility?: boolean;
    /** Whether doclet categories are preserved (compatibility only). */
    preserveCategories?: boolean;
    /** Whether doclet subcategories are preserved (compatibility only). */
    preserveSubcategories?: boolean;
  };

  /**
   * Snapshot storage settings.
   *
   * `adapter` selects the storage adapter name (compatibility only); `snapshot`
   * configures where and how the target-independent snapshot is written.
   */
  storage?: {
    /** Storage adapter name (compatibility only). */
    adapter?: string;
    /** Snapshot file layout applied by the CLI. */
    snapshot?: {
      /** Snapshot serialization format (compatibility only). */
      format?: string;
      /** Snapshot schema version (compatibility only). */
      schemaVersion?: number;
      /** Directory the snapshot and build cache are written to. */
      directory?: string;
      /** File name of the snapshot inside the snapshot directory. */
      file?: string;
    };
  };

  /**
   * Semantic layout overrides (compatibility only).
   *
   * Accepted for TDS §14 compatibility; semantic layouts are resolved from the
   * published snapshot by the render target, not from this setting.
   */
  layouts?: Record<string, string>;

  /**
   * Theme selection (compatibility only).
   *
   * Accepted for TDS §14 compatibility; the Angular target ships the docs stylesheet.
   */
  theme?: {
    /** Name of the theme to apply (compatibility only). */
    name?: string;
  };

  /**
   * Renderer targets to build.
   *
   * Each entry declares one output site; see {@link DecafDocsTargetConfig}. The
   * CLI resolves exactly one target from its arguments.
   */
  targets?: DecafDocsTargetConfig[];
}

/**
 * @description Configuration of a single renderer target in the docs config file.
 * @summary Declares which renderer to build with, the output directory for the generated site,
 * and optional overrides such as the routing strategy (hash), the base href, and the Angular
 * build configuration used when the target is {@link DecafDocsConfig}'s angular target.
 * @interface DecafDocsTargetConfig
 * @memberOf module:docaf.cli
 */
export interface DecafDocsTargetConfig {
  /** Renderer flavour that builds this target (e.g. `"angular"`). */
  renderer: string;

  /** Output directory of the generated site for this target. */
  output: string;

  /**
   * Routing strategy of the generated site.
   *
   * Only `"hash"` is supported in this release; it keeps deep links working without
   * a server.
   */
  routing?: "hash";

  /**
   * Base href emitted in the generated `index.html`.
   *
   * Use a relative value such as `"./"` so the site works when opened via `file://`.
   */
  baseHref?: string;

  /**
   * Angular build configuration used for this target.
   *
   * Passed through to the Angular CLI; defaults to `"production"`.
   */
  configuration?: "production" | "development";
}

/**
 * @description A docs target configuration with every option resolved to its final value.
 * @summary Produced by applying the config defaults: routing is always "hash", and baseHref,
 * configuration, and output fall back to their defaults when not specified, so downstream
 * targets never have to handle missing values.
 * @interface ResolvedDocsTarget
 * @memberOf module:docaf.cli
 */
export interface ResolvedDocsTarget {
  /** Renderer flavour that builds this target (e.g. `"angular"`). */
  renderer: string;

  /** Absolute output directory of the generated site for this target. */
  output: string;

  /** Routing strategy; always `"hash"` in this release. */
  routing: "hash";

  /** Base href emitted in the generated `index.html` (default `"./"`). */
  baseHref: string;

  /** Angular build configuration used for this target. */
  configuration: "production" | "development";
}

/**
 * @description Fully resolved docs configuration produced from CLI arguments.
 * @summary Contains the resolved root and docaf package root, project metadata, source
 * discovery inputs (tsconfig path, include/exclude globs), publisher flags, snapshot storage
 * locations (snapshot directory, file, and manifest), the resolved targets, and any warnings
 * emitted while applying accepted-but-unapplied settings. There is no config file: every value
 * comes from a CLI argument or a documented default.
 * @interface ResolvedDocsConfig
 * @memberOf module:docaf.cli
 */
export interface ResolvedDocsConfig {
  /** Absolute root directory all configuration paths resolve against. */
  root: string;

  /** Absolute root of the installed `@decaf-ts/docaf` package. */
  packageRoot: string;

  /** Project metadata resolved from arguments and the root `package.json`. */
  project: {
    /** Display name of the documented project. */
    name: string;
    /** Version string of the documented project. */
    version: string;
  };

  /** Source discovery inputs derived from the CLI arguments. */
  source: {
    /** Absolute path of the tsconfig.json providing compiler options. */
    tsconfigPath: string;
    /** Glob patterns selecting the source files to document. */
    include: string[];
    /** Glob patterns excluding matched files from documentation. */
    exclude: string[];
  };

  /** Publisher flags resolved for this run. */
  publisher: {
    /** Whether private declarations are included in the output. */
    includePrivate: boolean;
  };

  /** Snapshot storage locations resolved for this run. */
  storage: {
    /** Absolute directory the snapshot and build cache are written to. */
    snapshotDirectory: string;
    /** Absolute path of the snapshot file itself. */
    snapshotPath: string;
    /** Absolute path of the build-cache manifest used for reuse decisions. */
    manifestPath: string;
  };

  /** The single resolved renderer target built by this run. */
  targets: ResolvedDocsTarget[];

  /**
   * Warnings emitted while resolving the configuration.
   *
   * Reports accepted-but-unapplied settings (plugins, layouts, theme) so callers can
   * surface TDS §14 compatibility notes.
   */
  warnings: string[];
}

/**
 * @description CLI arguments accepted by every `decaf docs` subcommand.
 * @summary Mirrors the settings that previously lived in `decafdocs.config.*`. Values are
 * resolved against the working directory; omitted options fall back to the documented
 * defaults. This is the only configuration input - the CLI never reads or discovers a config
 * file.
 * @interface DocsCliOptions
 * @memberOf module:docaf.cli
 */
export interface DocsCliOptions {
  /** Working directory all relative paths resolve against; defaults to `process.cwd()`. */
  cwd?: string;

  /** Path to the tsconfig.json providing compiler options; defaults to `./tsconfig.json`. */
  tsconfig?: string;

  /**
   * Include globs selecting the source files to document.
   *
   * Accepts a single pattern or a list; list entries may be space or comma separated.
   * Defaults to every TypeScript file under the `src` directory.
   */
  include?: string | string[];

  /**
   * Exclude globs removing matched files from documentation.
   *
   * Accepts a single pattern or a list; defaults to specs, tests, and declaration
   * files.
   */
  exclude?: string | string[];

  /** Project display name; defaults to the root `package.json` name. */
  projectName?: string;

  /**
   * Project version; defaults to the root `package.json` version.
   *
   * The literal value `"auto"` resolves the same way as the default.
   */
  projectVersion?: string;

  /** Whether private declarations are included; defaults to `false`. */
  includePrivate?: boolean;

  /** Snapshot directory; defaults to `./.decaf-docs`. */
  snapshotDirectory?: string;

  /** Snapshot file name inside the snapshot directory; defaults to `snapshot.json`. */
  snapshotFile?: string;

  /** Renderer flavour to build with; defaults to `"angular"`. */
  renderer?: string;

  /** Output directory of the generated site; defaults to `./dist/docs-angular`. */
  output?: string;

  /** Base href emitted in `index.html`; defaults to `"./"`. */
  baseHref?: string;

  /** Angular build configuration; defaults to `"production"`. */
  configuration?: "production" | "development";

  /**
   * Routing strategy of the generated site.
   *
   * Only `"hash"` is supported in this release.
   */
  routing?: "hash";

  /**
   * Documentation plugin names, accepted for TDS §14 compatibility.
   *
   * Unknown names are rejected; known names only produce a compatibility warning.
   */
  plugins?: string | string[];

  /**
   * Component extractor names to run.
   *
   * This release ships only the `"angular"` extractor; anything else is rejected.
   */
  extractors?: string | string[];

  /** Theme name, accepted for TDS §14 compatibility (warning only). */
  theme?: string;

  /** Layout mappings, accepted for TDS §14 compatibility (warning only). */
  layouts?: string | string[];
}

/**
 * @description Backwards-compatible alias for {@link DocsCliOptions}.
 * @summary Retained for callers that imported the previous options type; both names describe
 * the same CLI-only inputs.
 * @typedef {DocsCliOptions} LoadDocsConfigOptions
 * @memberOf module:docaf.cli
 */
export type LoadDocsConfigOptions = DocsCliOptions;

/**
 * @description A source file selected for docs extraction.
 * @summary Carries both the absolute path used for reading/parsing and the path relative to
 * the config root, which is recorded in the snapshot for stable reporting.
 * @interface DocsSourceFile
 * @memberOf module:docaf.cli
 */
export interface DocsSourceFile {
  /** Absolute path of the source file on disk. */
  absolute: string;

  /** Path of the source file relative to the config root, using `/` separators. */
  relative: string;
}

/**
 * @description Resolved inputs for a docs extraction run.
 * @summary Bundles the selected source files, the TypeScript compiler options resolved from
 * the configured tsconfig, and the configuration fingerprint used to decide whether a cached
 * snapshot can be reused.
 * @interface DocsInputs
 * @memberOf module:docaf.cli
 */
export interface DocsInputs {
  /** Selected source files in deterministic (sorted) order. */
  files: DocsSourceFile[];

  /** Compiler options converted from the configured tsconfig with `noEmit` forced. */
  compilerOptions: import("typescript").CompilerOptions;

  /**
   * Fingerprint of the extraction inputs.
   *
   * Hashes the per-file content hashes together with the compiler options, project
   * metadata, and publisher flags; a matching fingerprint lets the orchestrator reuse the
   * cached snapshot.
   */
  fingerprint: string;
}

/**
 * @description Build outcome for a single renderer target.
 * @summary Reports the renderer, its output directory, the generated files, how long the build
 * took, and any warnings collected while building that target.
 * @interface DocsTargetSummary
 * @memberOf module:docaf.cli
 */
export interface DocsTargetSummary {
  /** Renderer flavour that built this target (e.g. `"angular"`). */
  renderer: string;

  /** Output directory the finished site was published to. */
  output: string;

  /** Paths of every file written by the target build. */
  files: string[];

  /** Wall-clock duration of the target build in milliseconds. */
  durationMs: number;

  /** Non-fatal warnings collected while building the target. */
  warnings: string[];
}

/**
 * @description Overall result of a docs CLI operation (build or snapshot).
 * @summary Aggregates the operation mode, project metadata, the snapshot location, whether the
 * snapshot was reused from cache, the configuration fingerprint, element counts, per-target
 * build summaries, collected warnings, total duration, and the full produced snapshot.
 * @interface DocsOperationSummary
 * @memberOf module:docaf.cli
 */
export interface DocsOperationSummary {
  /** Operation mode: `"snapshot"` writes the snapshot only; `"build"` also builds targets. */
  mode: "build" | "snapshot";

  /** Project metadata the documentation was generated for. */
  project: {
    /** Display name of the documented project. */
    name: string;
    /** Version string of the documented project. */
    version: string;
  };

  /** Absolute path of the snapshot file the operation produced or reused. */
  snapshotPath: string;

  /**
   * Whether the snapshot was reused from the build cache.
   *
   * `true` when the fingerprint matched the cached manifest, meaning extraction and
   * publication were skipped entirely.
   */
  cacheHit: boolean;

  /** Fingerprint of the extraction inputs that produced (or matched) the snapshot. */
  fingerprint: string;

  /** Element counts per snapshot table (e.g. `{ doclets: 281, pages: 264 }`). */
  counts: Record<string, number>;

  /** Per-target build summaries; empty for snapshot-only runs. */
  targets: DocsTargetSummary[];

  /** Warnings collected while resolving the configuration and building targets. */
  warnings: string[];

  /** Total wall-clock duration of the operation in milliseconds. */
  durationMs: number;

  /** The complete snapshot the operation produced or reused. */
  snapshot: DocsSnapshotV1;
}
