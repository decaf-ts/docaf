/**
 * @description Command-line interface for the docaf documentation generator.
 * @summary Declares the `cli` namespace of `docaf`, exposed through the `@decaf-ts/docaf/cli`
 * subpath export and registered as `decaf docs` by the package cli-module. It groups the
 * `init`/`snapshot`/`build` command factories, the arguments-only configuration resolution
 * (there is no config file), source/compiler-input resolution, renderer target selection, the
 * extract-publish-snapshot-build orchestrator, and the option/result types shared by all of them.
 * @namespace cli
 * @memberOf module:docaf
 */
export * from "./types";
export * from "./config";
export * from "./inputs";
export * from "./targets";
export * from "./orchestrator";
export * from "./command";
