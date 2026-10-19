### Description

`@decaf-ts/docaf` is a Decaf-native, framework-independent documentation generator and
runtime, ported from [BetterDocs](https://github.com/SoftwareBrothers/better-docs) onto
Decaf models. The port is recorded in [PORTING.md](./PORTING.md).

It extracts TypeScript sources with a single compiler program, publishes the
documentation as data-only Decaf models (`DocletModel`, `DocPageModel`,
`DocSectionModel`, and related records) backed by `RamAdapter` repositories, and writes a
portable, target-independent snapshot to `.decaf-docs/snapshot.json`. Renderer targets
(currently Angular) build the user-facing site from that snapshot in an isolated staging
directory and never mutate it. BetterDocs, JSDoc, TAFFY, and HTML templating do not run
in the pipeline.

The package ships:

- a `decaf docs` cli-module for `@decaf-ts/cli` with `init`, `snapshot`, and `build`
  commands;
- a portable runtime that hydrates the same snapshot in the browser;
- a Docker image that runs the CLI as a non-root user against mounted source and output
  folders.

The repository dogfoods the generator: its own API site under `docs/` and its README are
produced by the commands documented below.
