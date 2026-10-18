import { AngularDocsBuildTarget } from "../build/AngularDocsBuildTarget";
import type { DocsBuildTarget } from "../build/DocsBuildTarget";
import { DocsBuildError } from "../generator/diagnostics";
import type { ResolvedDocsConfig, ResolvedDocsTarget } from "./types";

/**
 * @description Options shared by all build target factories.
 * @summary Passed to every target factory when instantiating a {@link DocsBuildTarget}: the
 * docaf package root used to locate bundled assets/toolchain, and the Angular build
 * configuration ("production" or "development") resolved for the target.
 */
export interface BuildTargetOptions {
  packageRoot: string;
  configuration: "production" | "development";
}

type TargetFactory = (options: BuildTargetOptions) => DocsBuildTarget;

const TARGET_FACTORIES: Record<string, TargetFactory> = {
  angular: (options) =>
    new AngularDocsBuildTarget({
      packageRoot: options.packageRoot,
      configuration: options.configuration,
    }),
};

/**
 * @description Lists the renderer flavours that currently have a registered build target.
 * @summary Derived from the registered target factory map, sorted alphabetically; used for
 * error messages and renderer validation.
 * @returns {string[]} Sorted list of supported renderer names.
 */
export function supportedRenderers(): string[] {
  return Object.keys(TARGET_FACTORIES).sort();
}

/**
 * @description Instantiates the {@link DocsBuildTarget} for a resolved target configuration.
 * @summary Looks up the target factory registered for the target's renderer flavour and calls
 * it with the shared {@link BuildTargetOptions}.
 * @param {ResolvedDocsTarget} target - The resolved target configuration to build with.
 * @param {BuildTargetOptions} options - Shared instantiation options (package root, build configuration).
 * @returns {DocsBuildTarget} The build target instance for the renderer.
 * @throws {DocsBuildError} When no build target is registered for the renderer.
 */
export function createBuildTarget(
  target: ResolvedDocsTarget,
  options: BuildTargetOptions
): DocsBuildTarget {
  const factory = TARGET_FACTORIES[target.renderer];
  if (!factory) {
    throw new DocsBuildError([
      {
        severity: "error",
        code: "DOCAF_RENDERER_UNSUPPORTED",
        message: `Unsupported docs renderer "${target.renderer}" (REN-10). Supported renderers: ${supportedRenderers().join(
          ", "
        )}. Add a DocsBuildTarget implementation and register it in src/cli/targets.ts before selecting "${target.renderer}".`,
      },
    ]);
  }
  return factory(options);
}

/**
 * @description Selects the resolved targets to build, optionally filtered by renderer.
 * @summary With no requested renderers all configured targets are returned. With a request
 * list, each renderer is validated against the registered factories and must have at least one
 * configured target; matching targets are returned de-duplicated by renderer/output while
 * preserving the requested order.
 * @param {ResolvedDocsConfig} config - The resolved docs configuration with its targets.
 * @param {string[]} requested - Optional list of renderer names to restrict the build to.
 * @returns {ResolvedDocsTarget[]} The targets selected for the build.
 * @throws {DocsBuildError} When a requested renderer is unsupported or has no configured target.
 */
export function selectTargets(
  config: ResolvedDocsConfig,
  requested?: readonly string[]
): ResolvedDocsTarget[] {
  if (!requested?.length) return config.targets;
  const configuredRenderers = [
    ...new Set(config.targets.map((target) => target.renderer)),
  ];
  const selected: ResolvedDocsTarget[] = [];
  const seen = new Set<string>();
  for (const renderer of requested) {
    if (!TARGET_FACTORIES[renderer]) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_RENDERER_UNSUPPORTED",
          message: `Unsupported docs renderer "${renderer}" (REN-10). Supported renderers: ${supportedRenderers().join(
            ", "
          )}. Configured renderers: ${configuredRenderers.join(", ")}.`,
        },
      ]);
    }
    const matches = config.targets.filter(
      (target) => target.renderer === renderer
    );
    if (!matches.length) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_TARGET_NOT_CONFIGURED",
          message: `Renderer "${renderer}" is supported but no target is configured for it. Add { renderer: "${renderer}", output: "..." } to targets in your docs config.`,
        },
      ]);
    }
    for (const match of matches) {
      const key = `${match.renderer}:${match.output}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(match);
    }
  }
  return selected;
}

/**
 * @description Parses renderer selection options from the CLI into a renderer name list.
 * @summary Accepts either `--renderer <name>` (single renderer) or `--targets <comma or space
 * separated list>`; combining both raises an error. Returns undefined when neither is given,
 * meaning all configured targets should be built.
 * @param {object} options - The parsed CLI options (`renderer` and/or `targets`).
 * @returns {string[] | undefined} Renderer names to build, or undefined for all configured targets.
 * @throws {DocsBuildError} When both `--renderer` and `--targets` are provided.
 */
export function parseRendererSelection(options: {
  renderer?: string;
  targets?: string;
}): string[] | undefined {
  const fromTargets = options.targets
    ?.split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (options.renderer && fromTargets?.length) {
    throw new DocsBuildError([
      {
        severity: "error",
        code: "DOCAF_CLI_SELECTION_CONFLICT",
        message:
          "Use either --renderer <name> or --targets <list>, not both.",
      },
    ]);
  }
  if (options.renderer) return [options.renderer];
  if (fromTargets?.length) return fromTargets;
  return undefined;
}
