### How to Use

`@decaf-ts/docaf` is used in three ways: from the CLI, from a container image, or as a
library. The same configuration drives all three, so a project can switch between them
without changing its sources.

#### Requirements

- Node.js >= 20 and npm >= 10.
- `@decaf-ts/cli` installed **in the project** (or globally). It discovers
  `@decaf-ts/docaf` as a cli-module and exposes it as `decaf docs ...`. No `npm link`
  is required or supported.
- A `tsconfig.json` covering the sources you want to document.
- Docker only if you use the container image.

#### Quick start

Install the generator and the CLI in the project whose sources you want to document:

```bash
npm install --save-dev @decaf-ts/docaf @decaf-ts/cli
```

Every option is a CLI argument - there is no configuration file. Validate the source
selection, take a target-independent snapshot, and build the site:

```bash
npx decaf docs init --tsconfig ./tsconfig.json --include "src/**/*.ts"
npx decaf docs snapshot --tsconfig ./tsconfig.json --include "src/**/*.ts"
npx decaf docs build --tsconfig ./tsconfig.json --include "src/**/*.ts" \
  --output ./docs --base-href ./
```

`decaf docs init` validates the source selection and creates the snapshot directory; it never
writes a config file.

#### CLI reference

```bash
decaf docs init [options]
decaf docs snapshot [options]
decaf docs build [options]
```

| Command | What it does |
| --- | --- |
| `init` | Validates the source selection and creates the snapshot directory. It never writes a config file. |
| `snapshot` | Extracts the sources, publishes the documentation, and writes `.decaf-docs/snapshot.json` plus `.decaf-docs/build-cache.json`. No renderer runs. |
| `build` | Takes (or reuses) a snapshot, then builds the selected renderer targets. |

Every command accepts the same source and target options:

- `--tsconfig <path>` - `tsconfig.json` for the documented sources (default `./tsconfig.json`).
- `--include <patterns...>` - source include globs, space or comma separated (default `src/**/*.ts`).
- `--exclude <patterns...>` - source exclude globs (default `**/*.spec.ts **/*.test.ts **/*.d.ts`).
- `--project-name <name>` / `--project-version <version>` - project metadata (defaults from `package.json`).
- `--include-private` - include private declarations.
- `--snapshot-dir <path>` / `--snapshot-file <name>` - snapshot location (defaults `.decaf-docs/snapshot.json`).
- `--renderer <renderer>` - target renderer (default and only supported value: `angular`).
- `--output <path>` - target output directory (default `./dist/docs-angular`).
- `--base-href <href>` - base href emitted in `index.html` (default `./`).
- `--configuration <mode>` - Angular build configuration, `production` or `development` (default `production`).
- `--routing <strategy>` - routing strategy (default and only supported value: `hash`).
- `--targets <list>` - restricts `build` to the listed renderers (comma or space separated).
- `--plugins`, `--extractors`, `--theme`, `--layout` - TDS-compatibility values; see [CLI.md](./CLI.md).

Each target builds in a staging directory and is moved into its output directory only
after the build succeeds. A failed build leaves the previous output untouched. The
snapshot is written once and renderers cannot modify it.

Run commands from the project root (the directory containing `tsconfig.json`). Relative
`--tsconfig`, `--snapshot-dir`, and `--output` paths resolve from the current directory.

The full flag list, configuration schema, defaults, caching rules, and `DOCAF_*`
diagnostics are in [CLI.md](./CLI.md).

#### CLI options (no config file)

There is no `decafdocs.config.*` file and the CLI never looks for one. Every setting is a
CLI argument; omitted arguments use the defaults in [CLI.md](./CLI.md). This repository runs
the self-hosted build entirely from arguments:

```bash
decaf docs build --tsconfig ./tsconfig.json --include "src/**/*.ts" \
  --exclude "**/*.spec.ts" "**/*.test.ts" "**/*.d.ts" \
  --renderer angular --output ./docs --base-href ./ --configuration production
```

The emitted site uses hash routing and relative asset URLs (`--base-href ./`), so
`./docs/index.html` can be opened directly from disk (`file://`) as well as served over
HTTP from any subpath. Under `file://` the snapshot is read from the generated
`assets/docs/snapshot.js`; over HTTP the runtime fetches `assets/docs/snapshot.json`.
Use `--base-href /` only when the site is always served from the domain root.

#### Generated site architecture (Angular renderer)

With `--renderer angular` the build emits a standalone static app assembled from dedicated
standalone Angular components - one per BetterDocs block (site layout, header, footer,
sidebar, navigation tree, breadcrumbs, table of contents, symbol header, signature,
members, parameters, returns, examples, source, code, text, search, preview, tutorial, and
the page hosts) - shipped with `@decaf-ts/docaf/for-angular` under
`src/for-angular/components/`. A route is resolved by the docs page host through
`DocsPageService`, which returns the page's nested layout graph; each semantic section is
then drawn by the matching component.

The components and layouts register themselves with the Decaf rendering engine under
semantic tags (for example `docs.text`, `docs.code`, `docs.members`) via
`AngularDocsRendererAdapter`, so the same tags stay portable across renderer targets.
Component previews referenced by the snapshot are wired through a generated preview
registry injected under the `DOCS_ANGULAR_PREVIEWS` token and rendered by the same
component set.

#### Docker

The published image is `ghcr.io/decaf-ts/docaf`. Build it locally with:

```bash
docker build -t ghcr.io/decaf-ts/docaf:latest .
```

When the build must reach a private npm registry, pass the token as a BuildKit secret so
it never lands in an image layer. Never use `--build-arg` for credentials:

```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=TOKEN,env=NPM_TOKEN \
  -t ghcr.io/decaf-ts/docaf:latest .
```

The mount contract is fixed: `/workspace` holds the project and **must be writable**
(docaf writes `.decaf-docs/snapshot.json` and `.decaf-docs/build-cache.json` under the
project root), while `/output` receives generated sites. Keep output out of the source
tree:

```bash
mkdir -p dist/docs
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/dist:/output" \
  ghcr.io/decaf-ts/docaf:latest \
  build --tsconfig /workspace/tsconfig.json --include "src/**/*.ts" \
  --output /output/docs --base-href ./
```

The entrypoint is already `decaf docs`, so the first argument is the subcommand. The
image runs as the non-root `node` user; use `--user "$(id -u):$(id -g)" -e HOME=/tmp`
when the mounted output is owned by your host user.

The repository ships `bin/docker-smoke.sh`, which builds the image, runs a real
`decaf docs build` against a throwaway project, and asserts the rendered site and
snapshot in the output mount:

```bash
bin/docker-smoke.sh
```

Image build, registry-token handling, mount permissions, smoke-test variables, CI
publishing, and the CSP/hosting recommendation are covered in [DOCKER.md](./DOCKER.md).

#### CI image publishing

`.github/workflows/docker-publish.yml` is a thin caller of the shared
`decaf-ts/reusable-actions` Docker workflow. It runs on `release: published` and on
`workflow_dispatch`, and publishes:

- `ghcr.io/decaf-ts/docaf:<version>` from `package.json` at the released commit;
- `ghcr.io/decaf-ts/docaf:latest` as the floating tag.

Release builds reuse the release pipeline's gates. Manual dispatch defaults to running
`build:prod`, `test:all`, and a Trivy scan before the image build; untick
`run-build-test` or `run-trivy-scan` to build the image only. Other inputs include
`version-tag`, `push`, `platforms`, `no-cache`, `registries`, and `registry-user`.
The full input table is in [DOCKER.md](./DOCKER.md).

Registry login uses `REGISTRY_TOKEN`, falling back to `GH_PAT` and then `GH_TOKEN`; the
token must belong to the configured `registry-user` and have package-write permission
(`write:packages` for GHCR). `NPM_TOKEN` is optional and is passed to the build as the
BuildKit `TOKEN` secret for private npm mirrors. The workflow passes `secrets: inherit`
and contains no credential literals.

#### Development

Requires the same Node.js and npm versions. From a checkout of this repository:

```bash
npm ci                 # reproducible install from package-lock.json
npm run build          # development build into lib/ and dist/
npm run build:prod     # production build
npm run lint           # ESLint
npm run test:all       # full Jest suite
npm run test:e2e       # build, then run the Playwright end-to-end suite
npm run test:parity    # parity checks against the recorded BetterDocs baseline
npm run test:docker    # build the image and run bin/docker-smoke.sh end to end
npm run coverage       # full suite with coverage and reports
npm run docs           # README + build + self-hosted API docs
```

The individual unit, integration, distribution, circular-dependency, and release
scripts, the project layout, and the shared-workspace rules are documented in the
[developer guide](./workdocs/tutorials/For%20Developers.md).

#### How this repository documents itself

Documentation sources are Markdown under `workdocs/` and JSDoc comments in `src/`; every
build setting is passed as a CLI argument:

```bash
npm run readme   # compose README.md from workdocs/ with markdown-include
npm run docs     # readme + build + decaf docs build --output ./docs --base-href ./
```

`npm run docs` writes the portable snapshot to `.decaf-docs/snapshot.json` and the
Angular site to `docs/`. `README.md` is generated: edit `workdocs/` and regenerate it
instead of editing it by hand. The authoring rules are in the
[documentation guide](./workdocs/tutorials/Documentation.md).

#### Troubleshooting

- `DOCAF_CONFIG_TSCONFIG_MISSING` — the `--tsconfig` path does not exist.
- `DOCAF_NO_SOURCES` — no files matched `--include`.
- `DOCAF_CONFIG_SOURCE` — `--include`/`--exclude` is malformed.
- `DOCAF_CLI_SELECTION_CONFLICT` — `--renderer` and `--targets` were used together.
- `DOCAF_RENDERER_UNSUPPORTED` — the requested renderer is not implemented.
- `DOCAF_TARGET_NOT_CONFIGURED` — the renderer is supported but absent from `targets`.

Errors exit with status 1. See [CLI.md](./CLI.md) for the complete diagnostic list.
