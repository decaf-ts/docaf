import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { Logging } from "@decaf-ts/logging";
import { DocsBuildError } from "../generator/diagnostics";
import { resolveDocsConfig } from "./config";
import { resolveDocsInputs } from "./inputs";
import { DocsCliOrchestrator } from "./orchestrator";
import { parseRendererSelection } from "./targets";
import type { DocsCliOptions, DocsOperationSummary } from "./types";

const log = Logging.for("decaf docs");

interface TargetOptions {
  renderer?: string;
  output?: string;
  baseHref?: string;
  configuration?: "production" | "development";
  routing?: "hash";
}

interface CommanderSourceOptions {
  snapshotDir?: string;
  layout?: string | string[];
}

interface BuildCommandOptions extends DocsCliOptions, TargetOptions, CommanderSourceOptions {
  targets?: string;
}

interface ConfigCommandOptions extends DocsCliOptions, TargetOptions, CommanderSourceOptions {}

function reportError(error: unknown): void {
  if (error instanceof DocsBuildError) {
    log.error("decaf docs failed:");
    for (const diagnostic of error.diagnostics) {
      const location = diagnostic.location
        ? ` (${diagnostic.location.fileName}:${diagnostic.location.line}:${diagnostic.location.column})`
        : "";
      log.error(`  [${diagnostic.code}] ${diagnostic.message}${location}`);
    }
    return;
  }
  log.error(
    `decaf docs failed: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error : undefined
  );
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
  for (const warning of warnings) log.warn(`warning: ${warning}`);
}

function printSummary(summary: DocsOperationSummary): void {
  printWarnings(summary.warnings);
  const doclets = summary.counts.doclets ?? 0;
  const pages = summary.counts.pages ?? 0;
  log.info(
    `docs snapshot ${summary.cacheHit ? "reused from cache" : "written"}: ${summary.snapshotPath}`
  );
  log.info(
    `project ${summary.project.name}@${summary.project.version} — ${doclets} doclet(s), ${pages} page(s), fingerprint ${summary.fingerprint}`
  );
  for (const target of summary.targets) {
    log.info(
      `built ${target.renderer}: ${target.output} (${target.files.length} file(s), ${target.durationMs}ms)`
    );
    printWarnings(target.warnings);
  }
  log.info(`completed in ${summary.durationMs}ms`);
}

function addSourceOptions(command: Command): Command {
  return command
    .option("--tsconfig <path>", "tsconfig.json for the documented sources", "./tsconfig.json")
    .option(
      "--include <patterns...>",
      "Source include globs (space or comma separated)",
      ["src/**/*.ts"]
    )
    .option(
      "--exclude <patterns...>",
      "Source exclude globs (space or comma separated)",
      ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"]
    )
    .option("--project-name <name>", "Project name (defaults to package.json name)")
    .option("--project-version <version>", 'Project version (defaults to package.json version; "auto" resolves the same way)')
    .option("--include-private", "Include private declarations", false)
    .option("--snapshot-dir <path>", "Snapshot directory", "./.decaf-docs")
    .option("--snapshot-file <name>", "Snapshot file name", "snapshot.json")
    .option("--plugins <names...>", "TDS-compatible plugin names (compatibility only)")
    .option("--extractors <names...>", "Component extractors", ["angular"])
    .option("--theme <name>", "TDS-compatible theme name (compatibility only)")
    .option("--layout <mappings...>", "TDS-compatible layout mappings (compatibility only)");
}

function addTargetOptions(command: Command): Command {
  return command
    .option("--renderer <renderer>", 'Target renderer (default: "angular")')
    .option(
      "--output <path>",
      'Target output directory (default: "./dist/docs-angular")'
    )
    .option(
      "--base-href <href>",
      'Base href emitted in index.html (default: "./")'
    )
    .option(
      "--configuration <mode>",
      'Angular build configuration: "production" or "development" (default: "production")'
    )
    .option(
      "--routing <strategy>",
      'Routing strategy (default and only supported value: "hash")'
    );
}

function toCliOptions(options: BuildCommandOptions): DocsCliOptions {
  return {
    tsconfig: options.tsconfig,
    include: options.include,
    exclude: options.exclude,
    projectName: options.projectName,
    projectVersion: options.projectVersion,
    includePrivate: options.includePrivate,
    snapshotDirectory: options.snapshotDir,
    snapshotFile: options.snapshotFile,
    plugins: options.plugins,
    extractors: options.extractors,
    theme: options.theme,
    layouts: options.layout,
    renderer: options.renderer,
    output: options.output,
    baseHref: options.baseHref,
    configuration: options.configuration,
    routing: options.routing,
  };
}

/**
 * @description Creates the `build` subcommand of `decaf docs`.
 * @summary Resolves all settings from CLI arguments (never from a config file), resolves the
 * renderer selection from `--renderer`/`--targets`, runs the orchestrator to extract, publish
 * and snapshot the docs and build the selected renderer targets, then prints a summary. Errors
 * are reported as diagnostics and set the process exit code to 1 instead of throwing.
 * @function createBuildCommand
 * @returns {Command} The configured commander `build` command.
 * @memberOf module:docaf.cli
 */
export function createBuildCommand(): Command {
  return addTargetOptions(
    addSourceOptions(
      new Command("build").description(
        "Extract, publish and snapshot the docs, then build the selected renderer targets"
      )
    )
  )
    .option(
      "--targets <renderers>",
      "Comma separated renderers to build (for example: angular)"
    )
    .action(async function (this: Command, options: BuildCommandOptions) {
      await guard(async () => {
        const config = resolveDocsConfig(toCliOptions(options));
        const renderers = parseRendererSelection(options);
        const summary = await new DocsCliOrchestrator(config).build(renderers);
        printSummary(summary);
      });
    });
}

/**
 * @description Creates the `snapshot` subcommand of `decaf docs`.
 * @summary Resolves all settings from CLI arguments and runs the orchestrator in snapshot
 * mode: extract and publish the docs and write the target-independent snapshot without
 * building any renderer target. Prints the operation summary; failures are reported as
 * diagnostics with exit code 1.
 * @function createSnapshotCommand
 * @returns {Command} The configured commander `snapshot` command.
 * @memberOf module:docaf.cli
 */
export function createSnapshotCommand(): Command {
  return addTargetOptions(
    addSourceOptions(
      new Command("snapshot").description(
        "Extract and publish the docs and write the target-independent snapshot (no target build)"
      )
    )
  ).action(async function (this: Command, options: ConfigCommandOptions) {
    await guard(async () => {
      const config = resolveDocsConfig(toCliOptions(options as BuildCommandOptions));
      const summary = await new DocsCliOrchestrator(config).snapshot();
      printSummary(summary);
    });
  });
}

/**
 * @description Creates the `init` subcommand of `decaf docs`.
 * @summary Validates the CLI-provided source selection and prepares the snapshot directory.
 * It never writes a configuration file: every subsequent run is driven by CLI arguments.
 * Prints the resolved paths and the next command; failures are reported as diagnostics with
 * exit code 1.
 * @function createInitCommand
 * @returns {Command} The configured commander `init` command.
 * @memberOf module:docaf.cli
 */
export function createInitCommand(): Command {
  return addTargetOptions(
    addSourceOptions(
      new Command("init").description(
        "Validate the project and prepare the docs snapshot directory (no config file)"
      )
    )
  ).action(async function (this: Command, options: ConfigCommandOptions) {
    await guard(async () => {
      const cli = toCliOptions(options as BuildCommandOptions);
      const config = resolveDocsConfig(cli);
      const inputs = resolveDocsInputs(config);
      fs.mkdirSync(config.storage.snapshotDirectory, { recursive: true });
      printWarnings(config.warnings);
      log.info(`docs workspace ready: ${config.root}`);
      log.info(
        `source: ${inputs.files.length} file(s) via ${config.source.tsconfigPath}`
      );
      log.info(`snapshot: ${config.storage.snapshotPath}`);
      log.info(
        `next: decaf docs build --output ${path.relative(config.root, config.targets[0].output) || "."} --base-href ${config.targets[0].baseHref}`
      );
    });
  });
}

/**
 * @description Builds the `docs` command registered by the docaf cli-module.
 * @summary Assembles the `docs` command group with its `build`, `snapshot`, and `init`
 * subcommands. The decaf CLI wrapper discovers the package cli-module and registers the
 * returned command, exposing it as `decaf docs <subcommand>` once `@decaf-ts/docaf` is
 * installed in the project.
 * @function createDocsCommand
 * @returns {Command} The `docs` command group with all subcommands attached.
 * @memberOf module:docaf.cli
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
