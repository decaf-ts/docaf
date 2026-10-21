import type { Command } from "commander";
import { createDocsCommand } from "./cli/command";

/**
 * @description `@decaf-ts/cli` module entry point for the docs command.
 * @summary `CliWrapper` discovers a `cli-module.cjs|mjs` file in the package
 * and registers the returned command, exposing this module as `decaf docs ...`.
 * Delegates to {@link createDocsCommand}.
 * @function docsModule
 * @returns {Command} The root `docs` command of the decaf CLI.
 * @memberOf module:docaf.cli
 */
export default function docsModule(): Command {
  return createDocsCommand();
}
