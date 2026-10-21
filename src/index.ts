/**
 * @description Decaf-native, framework-independent documentation generator and runtime.
 * @summary A BetterDocs port that parses JSDoc comment trees into Decaf models persisted with the
 * in-memory `RamAdapter`, exposes query and lookup services over them ({@link DocsLookupService}),
 * and emits data-only publisher output. The portable `DocsSnapshotV1` format lets the same docs be
 * exported on the build side and hydrated in the browser via {@link DocsRuntime}.
 * @module docaf
 */

export * from "./models";
export * from "./database";
export * from "./query";
export * from "./services";
export * from "./snapshot";
export * from "./runtime";
export * from "./generator";
export * from "./publisher";
export * from "./ui";

/**
 * @description Package version placeholder for `@decaf-ts/docaf`.
 * @summary Holds the literal `##VERSION##` token, which the release tooling replaces with the
 * real semver during the publish build.
 * @const VERSION
 * @memberOf module:docaf
 */
export const VERSION = "##VERSION##";
