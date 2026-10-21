## For Developers

This guide is for people changing `@decaf-ts/docaf` itself. To *use* the generator in another
project, start with [How to Use](../5-HowToUse.md). The short version: install the package and
`@decaf-ts/cli`, then run `decaf docs build` with arguments only - there is no configuration file.

### Prerequisites

- Node.js >= 20 and npm >= 10. Some tooling (the E2E runner and TypeScript execution) requires
  Node.js >= 22.6.
- Git, for the normal checkout.
- Docker only when you build the image or run the Docker smoke test.

The repository targets Angular 21 for the renderer. The Angular packages are regular
dependencies, not optional peers, so a plain `npm ci` installs everything the renderer needs.

### Bootstrap

Clone the repository and install exactly what the lockfile pins:

```bash
git clone https://github.com/decaf-ts/docaf.git
cd docaf
npm ci
npm run build
```

If the registry needs a token, `npm run do-install` resolves the npm credential through
`decaf utils credentials` and exposes it to npm as `NPM_TOKEN`. Do not put tokens in the
repository or in `package.json`.

### Repository layout

| Path | Contents |
| --- | --- |
| `src/generator/` | TypeScript extraction, the ported BetterDocs type converter, and the model writers |
| `src/build/` | Build targets, including the Angular target |
| `src/ui/` and `src/for-angular/` | Renderer-independent view models and the Angular renderer |
| `src/publisher/` | Pruning, sorting, links, pages, navigation, tutorials, search, and manifests |
| `src/cli/` | `decaf docs` command, configuration loading, and orchestration |
| `src/snapshot/` | Portable snapshot records, codecs, and validation |
| `tests/unit`, `tests/integration` | Jest suites |
| `tests/e2e` | Playwright static-app suite (not part of `test:all`) |
| `tests/fixtures/parity` | Committed BetterDocs parity fixtures and baseline |
| `scripts/parity` | Executable parity harness |
| `workdocs/` | Sources for `README.md` and the long-form guides |
| `bin/` | Docker smoke test, release, and credential helpers |

Build output is `lib/` (ESM and CJS) and `dist/` (bundles). The self-hosted site is written to
`docs/`, and the portable snapshot to `.decaf-docs/`. None of those are hand-edited.

### Architecture

The generator runs in two phases that share one artifact, the target-independent snapshot.

**Extraction and publication.** `DocsPipeline` runs a single TypeScript program over the selected
sources and publishes documentation as data-only decaf-native models (`DocletModel`, `DocTagModel`,
`DocTypeModel`, `DocParameterModel`, `DocReturnModel`, `DocSignatureModel`, `DocExampleModel`, and
related records). Every concrete model class is decorated with `@table` and `@uimodel()` and lives
in `RamAdapter`-backed repositories. The published dataset is written once to
`.decaf-docs/snapshot.json`; renderer targets read it and never rewrite it.

**CLI contract.** Every setting is resolved from CLI arguments; there is no configuration file and
the CLI never looks for one. Omitted arguments fall back to the documented defaults, so a project
with only a `tsconfig.json` and a `src/` directory builds without any arguments. Relative paths
resolve from the current directory.

**Rendering.** Pages are decaf UI views: view classes under `src/ui/` map semantic elements with
`@uielement(...)` and `@uichild(...)`, and `AngularDocsRendererAdapter` creates an
`NgxRenderingEngine` and registers one dedicated Angular component per docs semantic element (the
component folders under `src/for-angular/components/`). The Angular target copies the snapshot into
a generated app and builds it in a staging directory; the built site is moved to the output
directory only after the build succeeds, so a failed build leaves the previous output untouched.

**File-open output strategy.** The emitted site uses hash routing and relative asset URLs
(`--base-href ./` by default). Under `file://` an injected `file-protocol-shim.js` plus the global
`assets/docs/snapshot.js` script feed the snapshot to the runtime without network access; over
HTTP the runtime fetches `assets/docs/snapshot.json` instead. `--base-href /` is only for sites
always served from the domain root.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#E8F0FE", "primaryBorderColor": "#7BAAF7", "primaryTextColor": "#1F2937", "lineColor": "#6B7280", "actorBkg": "#E8F0FE", "actorBorder": "#7BAAF7", "actorTextColor": "#1F2937", "signalColor": "#4B5563", "signalTextColor": "#1F2937", "labelBoxBkgColor": "#FDF2E3", "labelBoxBorderColor": "#F0C674", "labelTextColor": "#1F2937", "loopTextColor": "#1F2937", "noteBkgColor": "#FDF2E3", "noteBorderColor": "#F0C674"}}}%%
sequenceDiagram
    autonumber
    participant CLI as decaf docs
    participant Pipe as DocsPipeline
    participant Snap as snapshot.json
    participant Site as Angular target (staging)
    participant App as Browser runtime

    CLI->>Pipe: settings from CLI args; extract + publish
    activate Pipe
    Pipe-->>CLI: decaf-native models (@table + @uimodel)
    deactivate Pipe
    CLI->>Snap: write target-independent snapshot (once)
    activate Snap
    Snap-->>CLI: immutable snapshot
    deactivate Snap
    CLI->>Site: copy snapshot, build, rewrite index.html
    activate Site
    Site-->>CLI: build succeeded
    deactivate Site
    CLI->>CLI: move staging into output
    App->>Site: open docs/index.html
    activate Site
    alt file:// protocol
        Site-->>App: snapshot.js + file-protocol-shim.js globals
    else http(s)
        Site-->>App: fetch assets/docs/snapshot.json
    end
    deactivate Site
    App->>App: hydrate DocsRuntime
    activate App
    App->>App: render pages via NgxRenderingEngine
    deactivate App
```

### Build scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Development build into `lib/` and `dist/` |
| `npm run build:prod` | Optimized production build |
| `npm run lint` / `npm run lint-fix` | ESLint, with or without automatic fixes |
| `npm run docs` | `readme` + clean `docs/` + build + `decaf docs build` |
| `npm run readme` | Compose `README.md` from `workdocs/` with `markdown-include` |

`npm run docs` dogfoods the generator against `src/` with arguments only: it composes the README,
builds the package, then runs `decaf docs build --tsconfig ./tsconfig.json --include "src/**/*.ts"
--renderer angular --output ./docs --base-href ./ --configuration production`. It calls the
`decaf` binary from the local `@decaf-ts/cli` devDependency; run `npm ci` before using it.

### Tests

| Command | Scope |
| --- | --- |
| `npm test` / `npm run test:all` | Every Jest suite under `tests/` |
| `npm run test:unit` | `tests/unit` |
| `npm run test:integration` | `tests/integration` |
| `npm run test:dist` | The full suite twice, against `lib/` and `dist/` (`TEST_TARGET`) |
| `npm run test:circular` | Circular-dependency check on `src/index.ts` via `dpdm` |
| `npm run test:parity` | BetterDocs type-converter parity against the committed baseline |
| `npm run test:e2e` | Build, then the Playwright static-app suite |
| `npm run test:docker` | Build the image and run `bin/docker-smoke.sh` end to end (needs Docker; not part of `test:all`) |
| `npm run coverage` | Full suite with coverage, reports under `workdocs/reports/` |
| `npm run prepare-it-tests` | Shared CI hook; a no-op here because no infrastructure is needed |

`test:all` also verifies that `package-lock.json` is in sync with `package.json` via
`npm ci --dry-run`, so a hand-edited or stale lockfile fails the default suite.

`test:dist` needs a build first (`npm run build`). `test:e2e` builds for you, but needs a local
Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

The E2E runner writes evidence to `tmp/e2e-artifacts/e2e-results.json`. `PLAYWRIGHT_ROOT` can
point at an external Playwright install when the browser stack is kept outside this package.

`test:parity` never downloads BetterDocs at test time: it verifies the pinned commit and fixture
hashes, then compares normalized doclets against `tests/fixtures/parity/baseline.json`.
Regenerating that baseline is a maintainer action and requires a checkout of the pinned upstream
commit; see `scripts/parity/README.md`.

Coverage uses `workdocs/reports/jest.coverage.config.cjs`, writes reports to
`workdocs/reports/`, and excludes `cli.ts` because it is an executable entry point.

### Documentation workflow

`README.md` is generated. Edit the section files (`workdocs/1-Header.md` through
`workdocs/99-Footer.md`) or `workdocs/Readme.md`, then:

```bash
npm run readme
```

The long-form guides under `workdocs/tutorials/` are committed Markdown and are not part of the
generated site. The API site itself comes from the JSDoc comments in `src/`; authoring rules are
in [Documentation](./Documentation.md). Check that relative links still resolve when you move or
rename a guide, because the README links into `workdocs/tutorials/`.

### Shared-workspace rules

This checkout may be mounted in a workspace that other runs use concurrently. Keep changes
inside `docaf/`; do not edit `src/`, `tests/`, `package.json`, or another package's files as part
of a documentation change. A documentation task must not commit, branch, or push — the
coordinating issue owns the single approved commit. If you need a source or script change,
report it rather than making it silently.

Treat generated paths (`lib/`, `dist/`, `docs/`, `.decaf-docs/`, `tmp/`, coverage reports) as
disposable. Rebuild them; do not merge them.

### Continuous integration and releases

GitHub Actions run the test, coverage, CodeQL, dependency, Pages, release, and Docker workflows.
Pages deploys the generated site from version tags. Docker publishing is a thin caller of the
shared `decaf-ts/reusable-actions` workflow and publishes `ghcr.io/decaf-ts/docaf:<version>` and
`latest`; see [DOCKER.md](../../DOCKER.md) for inputs and secrets.

Release automation is driven by tags:

```bash
npm run release
```

`bin/tag-release.sh` runs `prepare-release` (lint, production build, coverage, distribution
tests, docs), commits if needed, and creates and pushes the version tag. The release workflow
then publishes the package and the documentation. Never create release tags from a dirty or
unverified tree.

### Common pitfalls

- Running `decaf docs` from the wrong directory: relative `--tsconfig`, `--snapshot-dir`, and
  `--output` paths resolve from the current directory, so run from the project root that contains
  `tsconfig.json`; a missing tsconfig produces `DOCAF_CONFIG_TSCONFIG_MISSING`.
- Editing `README.md` directly: the next `npm run readme` overwrites it.
- Assuming renderers can mutate the snapshot: they cannot; `snapshot` is the shareable,
  target-independent artifact.
- Building Docker with `--build-arg` for credentials: use the `TOKEN` BuildKit secret.
- Mounting `/output` at a path the `node` user cannot write: pass
  `--user "$(id -u):$(id -g)" -e HOME=/tmp`.
