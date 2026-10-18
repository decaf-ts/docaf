### Description

`@decaf-ts/docaf` is a Decaf-native, framework-independent documentation generator and runtime — a port of [BetterDocs](https://github.com/SoftwareBrothers/better-docs) onto Decaf models.

It extracts TypeScript sources with a single compiler program, publishes the documentation as data-only Decaf models (`DocletModel`, `DocPageModel`, `DocSectionModel`, ...) backed by `RamAdapter` repositories, and writes a portable, target-independent snapshot to `.decaf-docs/snapshot.json`. Renderer targets (currently Angular) build user-facing output from that snapshot in an isolated staging directory and never mutate it — no BetterDocs, JSDoc, TAFFY or HTML rendering runs at runtime.

The package ships a `decaf docs` cli-module for `@decaf-ts/cli` (`init`, `snapshot`, `build`) and a Docker image that runs the same CLI against mounted source and output folders.
