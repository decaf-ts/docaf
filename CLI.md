# Documentation CLI

`@decaf-ts/docaf` ships a `decaf docs` command that extracts TypeScript sources, publishes the target-independent documentation snapshot, and builds renderer output from that snapshot.

## Requirements

- Node.js >= 20 and npm >= 10
- `@decaf-ts/cli` installed globally or in the project (it discovers `cli-module` files in `node_modules/@decaf-ts`)
- `@decaf-ts/docaf` installed in the project
- A `tsconfig.json` for the documented sources

The Angular renderer toolchain (`@angular/cli`, `@angular/build`, `@angular/compiler-cli`) is installed with `@decaf-ts/docaf`.

## Commands

Run the commands from the package root (the directory containing `tsconfig.json`). Every
setting is a CLI argument; the CLI never reads or discovers a configuration file.

```bash
decaf docs init     # validate the source selection and prepare the snapshot directory
decaf docs snapshot # extract + publish + write the snapshot
decaf docs build    # snapshot, then build the selected renderer targets
```

### Options

All three subcommands accept the same source and target options.

| Option | Default | Purpose |
| --- | --- | --- |
| `--tsconfig <path>` | `./tsconfig.json` | tsconfig used to compile the documented sources |
| `--include <patterns...>` | `src/**/*.ts` | source include globs (space or comma separated) |
| `--exclude <patterns...>` | `**/*.spec.ts **/*.test.ts **/*.d.ts` | source exclude globs |
| `--project-name <name>` | `package.json` `name`, else the directory name | project name |
| `--project-version <version>` | `package.json` `version` (`"auto"` resolves the same way) | project version |
| `--include-private` | off | include private declarations |
| `--snapshot-dir <path>` | `./.decaf-docs` | snapshot directory |
| `--snapshot-file <name>` | `snapshot.json` | snapshot file name |
| `--renderer <renderer>` | `angular` | target renderer |
| `--output <path>` | `./dist/docs-angular` | target output directory |
| `--base-href <href>` | `./` | base href emitted in `index.html` |
| `--configuration <mode>` | `production` | Angular build configuration |
| `--routing <strategy>` | `hash` | routing strategy (only `hash` is supported) |
| `--targets <list>` | all targets | `build` only: restrict the build to these renderers |
| `--plugins <names...>` | built-in set | TDS-compatible plugin names (compatibility only) |
| `--extractors <names...>` | `angular` | component extractors |
| `--theme <name>` | docs stylesheet | TDS-compatible theme name (compatibility only) |
| `--layout <mappings...>` | snapshot layouts | TDS-compatible layout mappings (compatibility only) |

`--renderer` and `--targets` are mutually exclusive when both are supplied.

### Path arguments and trust

This is a single-user local developer tool. `--output`, `--tsconfig`, `--snapshot-dir`, and
`--snapshot-file` are resolved with the privileges of the operator running the command and are
not confined against path traversal; do not pass values derived from untrusted input to a docs
build.

### `decaf docs build`

```bash
decaf docs build --tsconfig ./tsconfig.json --include "src/**/*.ts" \
  --output ./docs --base-href ./
```

Extracts, publishes, and snapshots the documentation, then builds the selected renderer
target. Each target is built in a staging directory beside its output. Files are moved into
the output directory only after the build succeeds; a failed build leaves the previous
output untouched. The snapshot is written once and is never mutated by a renderer.

Set `--base-href ./` when the output must work when `index.html` is opened directly from
disk (`file://`) or when it is served from a subpath. The generated app uses hash routing,
relative asset URLs, and a classic script bundle; under `file://` it reads the snapshot from
`assets/docs/snapshot.js` and over HTTP it fetches `assets/docs/snapshot.json`. Use
`--base-href /` only for root-served HTTP deployments.

### `decaf docs snapshot`

```bash
decaf docs snapshot --tsconfig ./tsconfig.json --include "src/**/*.ts"
```

Extracts and publishes the documentation once and writes `.decaf-docs/snapshot.json` plus
`.decaf-docs/build-cache.json`. No renderer runs.

### `decaf docs init`

```bash
decaf docs init --tsconfig ./tsconfig.json --include "src/**/*.ts"
```

Validates the CLI-provided source selection, reports the resolved snapshot and output paths,
and creates the snapshot directory. It never writes a configuration file - subsequent runs
use the same CLI arguments.

## Docker

The container image runs the same commands as the npm package. Mount the project writable at
`/workspace` and point the target output at a separate `/output` mount:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/dist:/output" \
  ghcr.io/decaf-ts/docaf:latest \
  build --tsconfig /workspace/tsconfig.json --include "src/**/*.ts" \
  --output /output/docs --base-href ./
```

docaf writes its snapshot and build cache under the project root before targets run, so
`/workspace` cannot be mounted read-only; keep generated output out of the source tree by
writing targets to `/output` instead.

The image runs as the non-root `node` user, reads registry tokens through a BuildKit secret,
and ships `bin/docker-smoke.sh` for an end-to-end check. See [DOCKER.md](./DOCKER.md) for
image build, secret mounting, permission handling, the smoke script, and the CSP/hosting
recommendation.

## Supported values in this release

- Renderers: `angular`
- Component extractors: `angular`
- Plugins: `typescript`, `category`, `component`, `import-types`, `load`
- Routing: `hash`
- Target configuration: `production` or `development`

`--plugins`, `--theme`, and `--layout` are accepted with a compatibility warning and use the
built-in behavior. Unknown plugin or extractor names are rejected.

## Caching

Extraction and publishing are skipped when the source files, compiler options, project metadata, and publisher settings are unchanged. Target configuration changes do not invalidate extraction, so switching targets or renderer options reuses the existing snapshot.

## Diagnostics

Errors are reported as `DOCAF_*` codes and the command exits with status 1. Configuration and
selection codes:

- `DOCAF_CONFIG_SOURCE` / `DOCAF_CONFIG_TARGET_INVALID` — malformed include/exclude globs or
  target flags
- `DOCAF_CONFIG_TSCONFIG_MISSING` / `DOCAF_CONFIG_TSCONFIG_INVALID` — `--tsconfig` is absent
  or cannot be parsed
- `DOCAF_CONFIG_PLUGINS` / `DOCAF_PLUGIN_UNSUPPORTED` — malformed or unknown plugin names
- `DOCAF_CONFIG_EXTRACTORS` / `DOCAF_COMPONENT_EXTRACTOR_UNSUPPORTED` — malformed or unknown
  component extractors
- `DOCAF_CONFIG_STORAGE_UNSUPPORTED` / `DOCAF_CONFIG_SNAPSHOT_UNSUPPORTED` — unsupported storage
  adapter, snapshot format, or schema version
- `DOCAF_NO_SOURCES` / `DOCAF_SOURCE_MISSING` — no source files matched, or a selected file is
  missing
- `DOCAF_NO_TARGETS` — no target was selected for the build
- `DOCAF_RENDERER_UNSUPPORTED` — renderer is not implemented (REN-10)
- `DOCAF_TARGET_NOT_CONFIGURED` — selection matched no configured target
- `DOCAF_CLI_SELECTION_CONFLICT` — `--renderer` and `--targets` used together
- `DOCAF_SNAPSHOT_MUTATED` — a renderer modified the published snapshot
- `DOCAF_PACKAGE_ROOT` — the docaf package root could not be located; install it or set
  `DOCAF_PACKAGE_ROOT`

Extraction and publication codes:

- `DOCAF_TS_<n>` — a TypeScript diagnostic from the documented program
- `DOCAF_ANONYMOUS_DECLARATION` — a declaration has no name to document
- `DOCAF_IMPORT_TYPE_UNRESOLVED` — an `import("...")` type could not be resolved
- `DOCAF_COMPONENT_DECLARATION_MISSING` / `DOCAF_COMPONENT_EXTRACTION_EMPTY` — an `@component`
  doclet has no matching class, or the extractor produced nothing
- `DOCAF_COMPONENT_EXTRACTOR_MISSING` — no registered extractor supports the component
- `DOCAF_LOAD_MISSING` / `DOCAF_LOAD_TRAVERSAL` — a `@load` file is unreadable or escapes the
  allowed documentation root

## Programmatic use

```ts
import { createDocsCommand } from "@decaf-ts/docaf/cli";

const command = createDocsCommand();
```

`@decaf-ts/docaf/cli` also exports `resolveDocsConfig`, `resolveDocsInputs`, `selectTargets`, and `DocsCliOrchestrator`.
