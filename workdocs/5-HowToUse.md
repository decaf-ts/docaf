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

Create a configuration file, take a target-independent snapshot, and build the site:

```bash
npx decaf docs init                         # writes decafdocs.config.ts
npx decaf docs snapshot                     # extract + publish + .decaf-docs/snapshot.json
npx decaf docs build                        # snapshot, then build configured targets
```

`decaf docs init` refuses to overwrite an existing configuration file.

#### CLI reference

```bash
decaf docs init [--config <path>]
decaf docs snapshot [--config <path>]
decaf docs build [--config <path>] [--renderer <name> | --targets <list>]
```

| Command | What it does |
| --- | --- |
| `init` | Writes a default `decafdocs.config.ts` (or the `--config` path). |
| `snapshot` | Extracts the sources, publishes the documentation, and writes `.decaf-docs/snapshot.json` plus `.decaf-docs/build-cache.json`. No renderer runs. |
| `build` | Takes (or reuses) a snapshot, then builds the selected renderer targets. |

`build` options:

- `--config <path>` selects a configuration file explicitly.
- `--renderer <name>` builds every configured target for that renderer.
- `--targets <list>` builds the listed renderers (comma or space separated).
- `--renderer` and `--targets` are mutually exclusive.

Each target builds in a staging directory and is moved into its output directory only
after the build succeeds. A failed build leaves the previous output untouched. The
snapshot is written once and renderers cannot modify it.

Run commands from the project root (the directory containing `tsconfig.json`). When
`--config` is used, the configuration file's directory becomes the project root, so
relative source, snapshot, and target paths resolve from there.

The full flag list, configuration schema, defaults, caching rules, and `DOCAF_*`
diagnostics are in [CLI.md](./CLI.md).

#### Configuration

`decafdocs.config.{ts,mts,cts,mjs,cjs,js}` must default-export a configuration object.
`defineDocsConfig` from `@decaf-ts/docaf/cli` adds editor autocompletion but is optional:

```ts
import { defineDocsConfig } from "@decaf-ts/docaf/cli";

export default defineDocsConfig({
  project: {
    name: "@decaf-ts/docaf",
    version: "auto",
  },
  source: {
    tsconfig: "./tsconfig.json",
    include: ["src/**/*.ts"],
    exclude: ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],
  },
  targets: [
    {
      renderer: "angular",
      output: "./docs",
      routing: "hash",
      baseHref: "/",
      configuration: "production",
    },
  ],
});
```

Defaults are documented in [CLI.md](./CLI.md). This repository's own configuration is
[decafdocs.config.ts](./decafdocs.config.ts).

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
  build --config /workspace/decafdocs.config.mjs
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

Documentation sources are Markdown under `workdocs/`, JSDoc comments in `src/`, and the
configuration in `decafdocs.config.ts`:

```bash
npm run readme   # compose README.md from workdocs/ with markdown-include
npm run docs     # readme + build + decaf docs build (dogfoods src/)
```

`npm run docs` writes the portable snapshot to `.decaf-docs/snapshot.json` and the
Angular site to `docs/`. `README.md` is generated: edit `workdocs/` and regenerate it
instead of editing it by hand. The authoring rules are in the
[documentation guide](./workdocs/tutorials/Documentation.md).

#### Troubleshooting

- `DOCAF_CONFIG_MISSING` — the `--config` path does not exist.
- `DOCAF_CONFIG_EXISTS` — `decaf docs init` found an existing configuration file.
- `DOCAF_CONFIG_TSCONFIG_MISSING` — `source.tsconfig` does not exist.
- `DOCAF_NO_SOURCES` — no files matched `source.include`.
- `DOCAF_CLI_SELECTION_CONFLICT` — `--renderer` and `--targets` were used together.
- `DOCAF_RENDERER_UNSUPPORTED` — the requested renderer is not implemented.
- `DOCAF_TARGET_NOT_CONFIGURED` — the renderer is supported but absent from `targets`.

Errors exit with status 1. See [CLI.md](./CLI.md) for the complete diagnostic list.
