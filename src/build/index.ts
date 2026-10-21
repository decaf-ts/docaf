/**
 * @description Build targets that render a docs snapshot into a finished documentation site.
 * @summary Declares the `build` namespace of `docaf`, exposed through the `@decaf-ts/docaf/build`
 * subpath export. It groups the renderer-independent {@link DocsBuildTarget} contract (validate,
 * prepare, build) with its implementations - currently the Angular target, which bundles the
 * snapshot as a standalone, file-protocol-safe Angular application. The docs CLI instantiates a
 * target per configured renderer via `createBuildTarget`.
 * @namespace build
 * @memberOf module:docaf
 */
export * from "./DocsBuildTarget";
export * from "./AngularDocsBuildTarget";
