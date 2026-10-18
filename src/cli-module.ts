import type { Command } from "commander";
import { createDocsCommand } from "./cli/command";

/**
 * @decaf-ts/cli module entry point. `CliWrapper` discovers a
 * `cli-module.cjs|mjs` file in the package and registers the returned command,
 * exposing this module as `decaf docs ...`.
 */
export default function docsModule(): Command {
  return createDocsCommand();
}
