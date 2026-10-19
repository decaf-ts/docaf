### Related packages

`@decaf-ts/docaf` is part of the [Decaf TS](https://github.com/decaf-ts) family. The
packages it uses directly are:

- `@decaf-ts/core` — models, repositories, adapters, and query primitives.
- `@decaf-ts/db-decorators` — persistence-aware model decorators and hooks.
- `@decaf-ts/decoration` — metadata and decoration primitives.
- `@decaf-ts/decorator-validation` — model argument validation.
- `@decaf-ts/ui-decorators` — UI metadata consumed by the renderer and runtime views.
- `@decaf-ts/for-angular` — Angular integration used by the current renderer target.
- `@decaf-ts/cli` — the command wrapper that exposes `decaf docs`.
- `@decaf-ts/utils` — credentials and repository helpers used by development scripts.

The Angular renderer additionally relies on the Angular and Ionic packages declared in
`package.json`. The component-extraction and publishing behavior is a port of
[BetterDocs](https://github.com/SoftwareBrothers/better-docs); the mapping and deliberate
changes are recorded in [PORTING.md](./PORTING.md).
