import type {
  DocComponentModel,
  DocComponentPreviewModel,
  DocLayoutModel,
} from "../models";

/**
 * @description Configuration for component previews in the docs output.
 * @summary Controls how component previews are produced and rendered: whether previews are
 * enabled at all, whether they run in a native runtime for the target renderer, how
 * cross-framework previews are handled, and where preview fixture files live.
 * @interface DocsPreviewConfig
 * @memberOf module:docaf.build
 */
export interface DocsPreviewConfig {
  /**
   * Whether component previews are emitted at all.
   *
   * When `false` (or omitted) the target skips preview generation entirely; when
   * `true` the target renders preview entries for every extracted component that has one.
   */
  enabled?: boolean;

  /**
   * Whether previews run in the renderer's native runtime.
   *
   * When `true` previews are rendered by the target's own component runtime; when
   * `false` or omitted the target falls back to its cross-framework strategy.
   */
  native?: boolean;

  /**
   * How previews of components from other frameworks are rendered.
   *
   * `"iframe"` isolates foreign-framework previews in a sandboxed frame; `"none"`
   * drops them. Targets may reject unsupported values during validation.
   */
  crossFramework?: "iframe" | "none";

  /**
   * Directory that holds preview fixture files.
   *
   * Interpreted relative to the project root unless an absolute path is given;
   * fixtures are copied into the generated site by the target when previews are enabled.
   */
  fixturesDirectory?: string;
}

/**
 * @description Top-level docs configuration resolved from the project's docaf config file.
 * @summary Carries project metadata, component extraction and preview settings, publisher
 * flags controlling which content is emitted (private members, source, tutorials, search),
 * and output options such as the base href and directory. Unknown keys are allowed so
 * renderer-specific sections can be added without breaking this shape.
 * @interface DocsConfig
 * @memberOf module:docaf.build
 */
export interface DocsConfig {
  /**
   * Project metadata stamped onto the generated site.
   *
   * `name` titles the site (and feeds generated identifiers); `version` is shown
   * alongside it. Both fall back to safe defaults when omitted.
   */
  project?: {
    /** Display name of the documented project. */
    name?: string;
    /** Version string of the documented project. */
    version?: string;
  };

  /**
   * Component extraction and preview settings for the build.
   *
   * `extractors` selects the framework extractors whose component models are
   * available to the target; `previews` mirrors {@link DocsPreviewConfig}.
   */
  components?: {
    /** Names of the component extractors to run (e.g. `["angular"]`). */
    extractors?: string[];
    /** Preview rendering configuration; see {@link DocsPreviewConfig}. */
    previews?: DocsPreviewConfig;
  };

  /**
   * Publisher flags controlling which content is emitted.
   *
   * Every flag defaults to a conservative value; targets read these to decide
   * whether private members, source references, tutorials, and search indexes are published.
   */
  publisher?: {
    /** Whether private declarations are included in the output. */
    includePrivate?: boolean;
    /** Whether source file references are published. */
    includeSource?: boolean;
    /** Whether tutorials are published. */
    includeTutorials?: boolean;
    /** Whether a search index is generated. */
    includeSearch?: boolean;
  };

  /**
   * Output location options for the generated site.
   *
   * `baseHref` is emitted in `index.html` and must be relative (`"./"`) for
   * `file://` usage; `directory` is the target output path.
   */
  output?: {
    /** Base href emitted in the generated `index.html`. */
    baseHref?: string;
    /** Output directory of the generated site. */
    directory?: string;
  };

  /**
   * Renderer-specific configuration sections.
   *
   * Unknown keys are preserved so targets can read their own sections (e.g. an
   * `angular` section) without breaking this shared shape.
   */
  [key: string]: unknown;
}

/**
 * @description Everything a build target needs to generate the documentation site.
 * @summary Passed to each {@link DocsBuildTarget} lifecycle call. It bundles the project root,
 * the final output directory, the path to the docs snapshot produced by the generator, the
 * resolved docs configuration, and the extracted component, preview, and layout models.
 * @interface DocsBuildContext
 * @memberOf module:docaf.build
 */
export interface DocsBuildContext {
  /**
   * Absolute path of the project being documented.
   *
   * Roots all relative path resolution (sources, assets, fixtures) during the build.
   */
  projectRoot: string;

  /**
   * Final output directory of the generated site.
   *
   * Targets write into a staging sibling of this directory and publish atomically;
   * the CLI moves the staging result here on success.
   */
  outputDirectory: string;

  /**
   * Path to the target-independent docs snapshot.
   *
   * Points at the `snapshot.json` produced by extraction/publication; targets read
   * it and must never rewrite it.
   */
  snapshotPath: string;

  /** Resolved docs configuration; see {@link DocsConfig}. */
  config: DocsConfig;

  /** Component models extracted for the documented sources. */
  components: DocComponentModel[];

  /** Component preview models keyed to {@link DocsBuildContext.components}. */
  previews: DocComponentPreviewModel[];

  /** Semantic layout descriptors the renderer maps page slots onto. */
  layouts: DocLayoutModel[];
}

/**
 * @description Outcome of running a single docs build target.
 * @summary Identifies the target that ran, the renderer flavour it used, the output directory,
 * the list of generated files, the build duration, and any warnings collected during the run.
 * @interface DocsBuildResult
 * @memberOf module:docaf.build
 */
export interface DocsBuildResult {
  /** Stable identifier of the build target that ran (e.g. `"angular"`). */
  targetId: string;

  /** Renderer flavour the target implements (e.g. `"angular"`). */
  rendererFlavour: string;

  /** Directory the finished site was published to. */
  outputDirectory: string;

  /** Paths of every file written by the build, relative to the output directory. */
  files: string[];

  /** Wall-clock duration of the target build in milliseconds. */
  durationMs: number;

  /** Non-fatal warnings collected while building the target. */
  warnings: string[];
}

/**
 * @description Renderer-independent abstraction for generating documentation output for a target stack.
 * @summary A build target validates the environment (e.g. required dependencies and preview
 * compatibility), prepares the workspace (e.g. scaffolding a throwaway application), and then
 * builds the final output into the context's output directory. Implementations are selected
 * from the resolved docs configuration by renderer flavour.
 * @interface DocsBuildTarget
 * @memberOf module:docaf.build
 */
export interface DocsBuildTarget {
  /** Stable identifier of the target implementation (e.g. `"angular"`). */
  readonly id: string;

  /** Renderer flavour the target implements (e.g. `"angular"`). */
  readonly rendererFlavour: string;

  /**
   * Checks that the environment can run this target.
   *
   * Implementations verify required dependencies are resolvable from the project
   * (or the docaf install) and that the context's preview configuration is supported, failing
   * fast with {@link DocsBuildError} diagnostics before anything is written.
   * @param {DocsBuildContext} context - The build context to validate against.
   * @returns {Promise<void>} Resolves when the environment is ready; rejects with diagnostics otherwise.
   * @throws {DocsBuildError} When a dependency is missing or the preview configuration is unsupported.
   */
  validate(context: DocsBuildContext): Promise<void>;

  /**
   * Prepares the workspace the target builds in.
   *
   * Implementations read the snapshot from the context, scaffold the target-specific
   * application under (or next to) `context.outputDirectory`, copy assets in, and leave the
   * directory ready for `build`. Preparation must be repeatable: calling it again rebuilds the
   * scaffold from scratch.
   * @param {DocsBuildContext} context - The build context to prepare from.
   * @returns {Promise<void>} Resolves when the workspace is prepared; rejects with diagnostics otherwise.
   * @throws {DocsBuildError} When the snapshot cannot be read or scaffolding fails.
   */
  prepare(context: DocsBuildContext): Promise<void>;

  /**
   * Builds the final site into the context's output directory.
   *
   * Implementations compile/assemble the prepared workspace, write the produced
   * files, and report what was generated. Failures leave any previously published output
   * untouched; the CLI orchestrates atomic staging around this call.
   * @param {DocsBuildContext} context - The build context to build with.
   * @returns {Promise<DocsBuildResult>} Summary of the generated files, duration, and warnings.
   * @throws {DocsBuildError} When the underlying toolchain fails.
   */
  build(context: DocsBuildContext): Promise<DocsBuildResult>;
}
