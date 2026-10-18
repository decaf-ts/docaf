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
 */
export interface DocsPreviewConfig {
  enabled?: boolean;
  native?: boolean;
  crossFramework?: "iframe" | "none";
  fixturesDirectory?: string;
}

/**
 * @description Top-level docs configuration resolved from the project's docaf config file.
 * @summary Carries project metadata, component extraction and preview settings, publisher
 * flags controlling which content is emitted (private members, source, tutorials, search),
 * and output options such as the base href and directory. Unknown keys are allowed so
 * renderer-specific sections can be added without breaking this shape.
 */
export interface DocsConfig {
  project?: {
    name?: string;
    version?: string;
  };
  components?: {
    extractors?: string[];
    previews?: DocsPreviewConfig;
  };
  publisher?: {
    includePrivate?: boolean;
    includeSource?: boolean;
    includeTutorials?: boolean;
    includeSearch?: boolean;
  };
  output?: {
    baseHref?: string;
    directory?: string;
  };
  [key: string]: unknown;
}

/**
 * @description Everything a build target needs to generate the documentation site.
 * @summary Passed to each {@link DocsBuildTarget} lifecycle call. It bundles the project root,
 * the final output directory, the path to the docs snapshot produced by the generator, the
 * resolved docs configuration, and the extracted component, preview, and layout models.
 */
export interface DocsBuildContext {
  projectRoot: string;
  outputDirectory: string;
  snapshotPath: string;
  config: DocsConfig;
  components: DocComponentModel[];
  previews: DocComponentPreviewModel[];
  layouts: DocLayoutModel[];
}

/**
 * @description Outcome of running a single docs build target.
 * @summary Identifies the target that ran, the renderer flavour it used, the output directory,
 * the list of generated files, the build duration, and any warnings collected during the run.
 */
export interface DocsBuildResult {
  targetId: string;
  rendererFlavour: string;
  outputDirectory: string;
  files: string[];
  durationMs: number;
  warnings: string[];
}

/**
 * @description Renderer-independent abstraction for generating documentation output for a target stack.
 * @summary A build target validates the environment (e.g. required dependencies and preview
 * compatibility), prepares the workspace (e.g. scaffolding a throwaway application), and then
 * builds the final output into the context's output directory. Implementations are selected
 * from the resolved docs configuration by renderer flavour.
 * @class DocsBuildTarget
 */
export interface DocsBuildTarget {
  readonly id: string;
  readonly rendererFlavour: string;

  validate(context: DocsBuildContext): Promise<void>;
  prepare(context: DocsBuildContext): Promise<void>;
  build(context: DocsBuildContext): Promise<DocsBuildResult>;
}
