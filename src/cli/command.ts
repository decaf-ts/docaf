import path from "node:path";
import { Command } from "commander";
import { DocsBuildError } from "../generator/diagnostics";
import { loadDocsConfig, writeDefaultConfig } from "./config";
import { DocsCliOrchestrator } from "./orchestrator";
import { parseRendererSelection } from "./targets";
import type { DocsOperationSummary } from "./types";

interface BuildCommandOptions {
  config?: string;
  renderer?: string;
  targets?: string;
}

interface ConfigCommandOptions {
  config?: string;
}

function reportError(error: unknown): void {
  if (error instanceof DocsBuildError) {
    console.error("decaf docs failed:");
    for (const diagnostic of error.diagnostics) {
      const location = diagnostic.location
        ? ` (${diagnostic.location.fileName}:${diagnostic.location.line}:${diagnostic.location.column})`
        : "";
      console.error(
        `  [${diagnostic.code}] ${diagnostic.message}${location}`
      );
    }
    return;
  }
  console.error(
    `decaf docs failed: ${error instanceof Error ? error.message : String(error)}`
  );
  if (error instanceof Error && error.stack) console.error(error.stack);
}

async function guard(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}

function printWarnings(warnings: readonly string[]): void {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

function printSummary(summary: DocsOperationSummary): void {
  printWarnings(summary.warnings);
  const doclets = summary.counts.doclets ?? 0;
  const pages = summary.counts.pages ?? 0;
  console.log(
    `docs snapshot ${summary.cacheHit ? "reused from cache" : "written"}: ${summary.snapshotPath}`
  );
  console.log(
    `project ${summary.project.name}@${summary.project.version} — ${doclets} doclet(s), ${pages} page(s), fingerprint ${summary.fingerprint}`
  );
  for (const target of summary.targets) {
    console.log(
      `built ${target.renderer}: ${target.output} (${target.files.length} file(s), ${target.durationMs}ms)`
    );
    printWarnings(target.warnings);
  }
  console.log(`completed in ${summary.durationMs}ms`);
}

/**
 * @description Creates the `build` subcommand of `decaf docs`.
 * @summary Loads the docs config (honouring `--config`), resolves the renderer selection from
 * `--renderer`/`--targets`, runs the orchestrator to extract, publish and snapshot the docs and
 * build the selected renderer targets, then prints a summary. Errors are reported as
 * diagnostics and set the process exit code to 1 instead of throwing.
 * @returns {Command} The configured commander `build` command.
 */
export function createBuildCommand(): Command {
  return new Command("build")
    .description(
      "Extract, publish and snapshot the docs, then build the selected renderer targets"
    )
    .option("--config <path>", "Path to decafdocs.config.ts (or .js/.mjs/.cjs)")
    .option("--renderer <renderer>", "Build only the configured target for this renderer")
    .option(
      "--targets <renderers>",
      "Comma separated renderers to build (for example: angular)"
    )
    .action(async function (this: Command, options: BuildCommandOptions) {
      await guard(async () => {
        const config = await loadDocsConfig({ configPath: options.config });
        const renderers = parseRendererSelection(options);
        const summary = await new DocsCliOrchestrator(config).build(renderers);
        printSummary(summary);
      });
    });
}

/**
 * @description Creates the `snapshot` subcommand of `decaf docs`.
 * @summary Loads the docs config (honouring `--config`) and runs the orchestrator in snapshot
 * mode: extract and publish the docs and write the target-independent snapshot without
 * building any renderer target. Prints the operation summary; failures are reported as
 * diagnostics with exit code 1.
 * @returns {Command} The configured commander `snapshot` command.
 */
export function createSnapshotCommand(): Command {
  return new Command("snapshot")
    .description(
      "Extract and publish the docs and write the target-independent snapshot (no target build)"
    )
    .option("--config <path>", "Path to decafdocs.config.ts (or .js/.mjs/.cjs)")
    .action(async function (this: Command, options: ConfigCommandOptions) {
      await guard(async () => {
        const config = await loadDocsConfig({ configPath: options.config });
        const summary = await new DocsCliOrchestrator(config).snapshot();
        printSummary(summary);
      });
    });
}

/**
 * @description Creates the `init` subcommand of `decaf docs`.
 * @summary Writes a default `decafdocs.config.ts` at the path given via `--config`, defaulting
 * to `decafdocs.config.ts` in the current working directory, and prints the created path plus
 * next-step guidance. Failures are reported as diagnostics with exit code 1.
 * @returns {Command} The configured commander `init` command.
 */
export function createInitCommand(): Command {
  return new Command("init")
    .description("Write a default decafdocs.config.ts")
    .option("--config <path>", "Path of the config file to create")
    .action(async function (this: Command, options: ConfigCommandOptions) {
      await guard(async () => {
        const target = writeDefaultConfig({
          path: options.config
            ? path.resolve(options.config)
            : path.resolve(process.cwd(), "decafdocs.config.ts"),
        });
        console.log(`created ${target}`);
        console.log(
          'next: adjust source.include/targets, then run "decaf docs build"'
        );
      });
    });
}

/**
 * Builds the `docs` command registered by the docaf cli-module. The binary
 * exposes it as `decaf docs <subcommand>` once @decaf-ts/docaf is installed.
 */
export function createDocsCommand(): Command {
  const docs = new Command("docs").description(
    "Generate Decaf documentation (extract, publish, snapshot and build targets)"
  );
  docs.addCommand(createBuildCommand());
  docs.addCommand(createSnapshotCommand());
  docs.addCommand(createInitCommand());
  return docs;
}
