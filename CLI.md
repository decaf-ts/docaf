# Documentation CLI

`@decaf-ts/docaf` ships a `decaf docs` command that extracts TypeScript sources, publishes the target-independent documentation snapshot, and builds renderer output from that snapshot.

## Requirements

- Node.js >= 20 and npm >= 10
- `@decaf-ts/cli` installed globally or in the project (it discovers `cli-module` files in `node_modules/@decaf-ts`)
- `@decaf-ts/docaf` installed in the project
- A `tsconfig.json` for the documented sources

The Angular renderer toolchain (`@angular/cli`, `@angular/build`, `@angular/compiler-cli`) is installed with `@decaf-ts/docaf`.

## Commands

Run the commands from the package root (the directory containing `tsconfig.json`).

```bash
decaf docs init                  # write a default decafdocs.config.ts
decaf docs snapshot              # extract + publish + write the snapshot
decaf docs build                 # snapshot, then build the configured targets
```

### `decaf docs build`

```bash
decaf docs build [--config <path>] [--renderer <name> | --targets <list>]
```

- `--config <path>` selects a config file explicitly.
- `--renderer <name>` builds only targets using that renderer.
- `--targets <list>` builds only the listed renderer names (comma separated).
- `--renderer` and `--targets` are mutually exclusive.

Without a config file the command uses the documented defaults, so a project with `src/**/*.ts` and a `tsconfig.json` can run `decaf docs build` directly.

Each target is built in a staging directory beside its output. Files are moved into the output directory only after the build succeeds; a failed build leaves the previous output untouched. The snapshot is written once and is never mutated by a renderer.

### `decaf docs snapshot`

```bash
decaf docs snapshot [--config <path>]
```

Extracts and publishes the documentation once and writes `.decaf-docs/snapshot.json` plus `.decaf-docs/build-cache.json`. No renderer runs.

### `decaf docs init`

```bash
decaf docs init [--config <path>]
```

Writes a `decafdocs.config.ts` (or the path given by `--config`). It refuses to overwrite an existing file.

## Docker

The container image runs the same commands as the npm package. Mount the
project writable at `/workspace` and point the target output at a separate
`/output` mount:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/dist/docs:/output" \
  decaf-ts/docaf:latest build --config /workspace/decafdocs.config.mjs
```

docaf writes its snapshot and build cache under the project root before targets
run, so `/workspace` cannot be mounted read-only; keep generated output out of
the source tree by writing targets to `/output` instead.

The image runs as the non-root `node` user, reads registry tokens through a
BuildKit secret, and ships `bin/docker-smoke.sh` for an end-to-end check. See
[DOCKER.md](./DOCKER.md) for image build, secret mounting, permission handling,
the smoke script, and the CSP/hosting recommendation.

## Configuration

`decafdocs.config.ts` (or `.mts`, `.cts`, `.mjs`, `.cjs`, `.js`) must default-export an object. Use `defineDocsConfig` from `@decaf-ts/docaf/cli` for editor autocompletion.

```ts
import { defineDocsConfig } from "@decaf-ts/docaf/cli";

export default defineDocsConfig({
  project: {
    name: "my-package", // default: package.json name
    version: "auto", // default: package.json version
  },
  source: {
    tsconfig: "./tsconfig.json",
    include: ["src/**/*.ts"],
    exclude: ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],
  },
  publisher: {
    includePrivate: false,
  },
  targets: [
    {
      renderer: "angular",
      output: "./dist/docs-angular",
      routing: "hash",
      baseHref: "/",
      configuration: "production",
    },
  ],
});
```

### Defaults

| Option | Default |
| --- | --- |
| `project.name` | `package.json` `name`, else the directory name |
| `project.version` | `package.json` `version` (`"auto"` resolves the same way) |
| `source.tsconfig` | `./tsconfig.json` |
| `source.include` | `["src/**/*.ts"]` |
| `source.exclude` | `["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"]` |
| `publisher.includePrivate` | `false` |
| `storage.adapter` | `"ram"` |
| `storage.snapshot.format` | `"decaf-json"` |
| `storage.snapshot.schemaVersion` | `1` |
| `targets` | `[{ renderer: "angular", output: "./dist/docs-angular", routing: "hash" }]` |
| snapshot path | `./.decaf-docs/snapshot.json` |
| cache manifest | `./.decaf-docs/build-cache.json` |

### Supported values in this release

- Renderers: `angular`
- Component extractors: `angular`
- Plugins: `typescript`, `category`, `component`, `import-types`, `load`
- Routing: `hash`
- Target configuration: `production` or `development`

The remaining TDS v1.0 configuration fields (`plugins` order, `components.previews`, `publisher` sub-options, `layouts`, `theme`) are accepted with a warning and use the built-in behavior. Unknown top-level keys are rejected.

## Caching

Extraction and publishing are skipped when the source files, compiler options, project metadata, and publisher settings are unchanged. Target configuration changes do not invalidate extraction, so switching targets or renderer options reuses the existing snapshot.

## Diagnostics

Errors are reported as `DOCAF_*` codes and the command exits with status 1. Common codes:

- `DOCAF_CONFIG_MISSING` — `--config` points at a file that does not exist
- `DOCAF_CONFIG_TSCONFIG_MISSING` — `source.tsconfig` does not exist
- `DOCAF_CONFIG_UNKNOWN_OPTION` — unknown top-level configuration key
- `DOCAF_NO_SOURCES` — no files matched `source.include`
- `DOCAF_RENDERER_UNSUPPORTED` — renderer is not implemented (REN-10)
- `DOCAF_TARGET_NOT_CONFIGURED` — selection matched no configured target
- `DOCAF_CLI_SELECTION_CONFLICT` — `--renderer` and `--targets` used together
- `DOCAF_SNAPSHOT_MUTATED` — a renderer modified the published snapshot

## Programmatic use

```ts
import { createDocsCommand } from "@decaf-ts/docaf/cli";

const command = createDocsCommand();
```

`@decaf-ts/docaf/cli` also exports `defineDocsConfig`, `loadDocsConfig`, `resolveDocsInputs`, `selectTargets`, and `DocsCliOrchestrator`.
