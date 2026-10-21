# Docker usage

`@decaf-ts/docaf` ships a container image that exposes the same `decaf docs`
CLI as the npm package. The image runs as the unprivileged `node` user and is
designed to read a project mounted from the host and write the generated site
to a mounted output folder.

## Build the image

```bash
docker build -t ghcr.io/decaf-ts/docaf:latest .
```

The build compiles the package, prunes development dependencies, and installs
the published `@decaf-ts/cli` next to it, so `decaf docs ...` works without
`npm-link` or a project-local install.

### Private registry token (BuildKit secret)

Public registry installs need no credentials. When the build must reach a
private mirror, pass the npm token as a BuildKit secret instead of an `ARG` or
`ENV` so it never lands in an image layer:

```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=TOKEN,env=NPM_TOKEN \
  -t ghcr.io/decaf-ts/docaf:latest .
```

Inside the build, `Dockerfile` writes the token to `.npmrc` only for the
`npm ci` step and deletes the file before the layer is committed. The same
pattern works for a token file:

```bash
docker build --secret id=TOKEN,src="$HOME/.npmtoken" -t ghcr.io/decaf-ts/docaf:latest .
```

Never pass `NPM_TOKEN` with `--build-arg`; build arguments are recorded in the
image history.

### npm scripts

The repository also exposes the Docker pipeline as npm scripts:

- `npm run docker:login` authenticates `ghcr.io` with the `docker-user` and
  `docker` credentials from `decaf utils credentials`.
- `npm run docker:build` builds from the root `Dockerfile` with BuildKit,
  passing the `npm` credential as the `TOKEN` secret. It tags both
  `ghcr.io/decaf-ts/docaf:<package version>` and
  `ghcr.io/decaf-ts/docaf:${VERSION:-latest}`.
- `npm run docker:publish` pushes both of those tags.

The scripts require the credentials above and a working BuildKit builder. They
publish the same image and tag names as the Docker Publish workflow, so local
and CI output agree. For a one-off build without credentials, use the direct
`docker build` commands above.

## CI image publishing

`.github/workflows/docker-publish.yml` builds the root `Dockerfile` and publishes
the image to GHCR:

- `ghcr.io/decaf-ts/docaf:<version>` — the `version` field from `package.json`
  at the released commit (`0.1.0` today), matching the npm package version.
- `ghcr.io/decaf-ts/docaf:latest` — floating alias for the most recent publish.

The published artifact is the runtime stage described above: it runs as the
non-root `node` user and keeps the `decaf docs` entrypoint. The optional
BuildKit `TOKEN` secret is wired to `NPM_TOKEN` in the same way as the local
build.

The workflow runs on `release: published` (in parallel with the npm publish) and
on `workflow_dispatch`. The npm `docker:*` scripts target the same image name
and tags for local publishing, so CI and local output agree.

On a release the image is built from the release tag and pushed as-is: the
release pipeline has already run build, test, and security gates. A manual
dispatch defaults to running `build:prod`, `test:all`, and a trivy scan before
the image build; untick those inputs to build the image only. Only
`linux/amd64` is built by default; pass a buildx platform list to publish more
architectures.

The workflow is a thin caller of
`decaf-ts/reusable-actions/.github/workflows/docker-publish.yml@master`, so the
image build, tag composition, and registry login stay in one place. It passes
`secrets: inherit`; no credential is written in the workflow file.

### Dispatch inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `version-tag` | empty | Versioned tag. Empty reads `version` from `package.json`. |
| `push` | `true` | Push the image. Untick for a build-only run. |
| `platforms` | `linux/amd64` | Buildx platform list (for example `linux/amd64,linux/arm64`). |
| `no-cache` | `false` | Build with `--no-cache`. |
| `registries` | `ghcr.io` | Comma-separated registries to log in to and push to. |
| `registry-user` | `decaf-ts-admin` | Username used for every registry login. |
| `run-build-test` | `true` | Run `build:prod` + `test:all` before building the image. |
| `run-trivy-scan` | `true` | Run a trivy vulnerability scan before building the image. |

### Required secrets and protections

- Registry login uses `REGISTRY_TOKEN`, falling back to `GH_PAT` then
  `GH_TOKEN`. Whichever secret is configured must belong to `registry-user`
  (`decaf-ts-admin` by default) and carry permission to write packages. For
  GHCR this is the `write:packages` scope on a personal access token. The
  reusable workflow cannot use the automatic `GITHUB_TOKEN` for this login.
- `NPM_TOKEN` is optional. When set it is passed to the build as the BuildKit
  `TOKEN` secret, exactly like the local `--secret id=TOKEN` command above, so
  the image build can reach a private npm mirror. Public installs need no
  token.
- The GHCR package must be linked to this repository and allow access from the
  release workflow. Keep the repository's release creation and the registry
  secrets restricted to trusted maintainers: whoever can publish a release can
  publish the image.

## Run the CLI against mounted folders

The container entrypoint is `decaf docs`, so the first argument selects the
subcommand. Mount the documented project at `/workspace` and an output
directory at `/output`:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/dist:/output" \
  ghcr.io/decaf-ts/docaf:latest \
  build --tsconfig /workspace/tsconfig.json --include "src/**/*.ts" \
  --output /output/docs --base-href ./
```

There is no config file: every setting is a CLI argument (see [CLI.md](./CLI.md)).
The project mount must be writable. docaf writes `.decaf-docs/snapshot.json` and
`.decaf-docs/build-cache.json` under the project root before any target runs, so
a read-only mount on `/workspace` fails. To keep generated output out of the
source tree, point the target output at the separate `/output` mount; the
writable project mount also lets `.decaf-docs/` persist between runs.

## Non-root and mounted-folder permissions

The image sets `USER node` (uid/gid 1000). Bind mounts keep the host owner, so
an output directory that is writable only by your host user will reject the
container user. Choose one of these approaches:

- Run with your own ids and a writable home (the pattern used by the smoke
  script):

  ```bash
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "$PWD:/workspace" \
    -v "$PWD/dist:/output" \
    ghcr.io/decaf-ts/docaf:latest \
    build --tsconfig /workspace/tsconfig.json --include "src/**/*.ts" \
    --output /output/docs --base-href ./
  ```

- Pre-create the output directory and grant group/other write access, or
  `chown` it to uid 1000.

- Use named volumes when the Docker daemon cannot see host paths (remote
  daemons, Docker-in-Docker). Named volumes are owned by the daemon; chown them
  once, or run the writer as root and fix ownership afterwards.

On SELinux hosts add the `:z` relabel option to bind mounts. Keep the project
mount writable: docaf writes its snapshot and build cache under the project
root before targets run, so a read-only `/workspace` mount fails. If you
want generated output kept apart from the source tree, mount a separate target
output directory outside `/workspace`.

## Smoke test

`bin/docker-smoke.sh` builds the image from the repository, generates a
throwaway project from `tests/fixtures/vertical-slice`, runs a real
`decaf docs build` in the container, and asserts that the rendered site,
`assets/docs/snapshot.json`, and `assets/i18n` were produced.

```bash
bin/docker-smoke.sh
npm run test:docker   # package-script alias for the same end-to-end check
```

Useful environment variables:

| Variable | Purpose |
| --- | --- |
| `DOCAF_DOCKER_IMAGE` | Image tag to build and run (default includes the PID). |
| `DOCAF_SMOKE_MOUNT_MODE` | `auto` (default), `bind`, or `volume`. `auto` probes the daemon and falls back to named volumes for remote daemons. |
| `DOCAF_DOCKER_BUILD_ARGS` | Extra arguments appended to `docker build`. |
| `DOCAF_DOCKER_RUN_ARGS` | Overrides the default `--user "$(id -u):$(id -g)" -e HOME=/tmp` run arguments. |
| `DOCAF_KEEP_IMAGE` | Set to `1` to keep the built image after the run. |

The script removes temporary directories, named volumes, and (unless
`DOCAF_KEEP_IMAGE=1`) the image on exit.

## Hosting and Content Security Policy

The Angular target emits a static single-page application that works both from a
static HTTP host and when `index.html` is opened directly from disk (`file://`).
The emitted app uses hash routing, relative asset URLs, a classic (non-module)
script bundle, and generated data scripts, so browsers do not need to fetch JSON
or load ES modules from `file://`. Serve it over HTTPS from a static host or CDN:

- Publish the output directory as-is; `index.html`, `main.js`, `styles-*.css`,
  `file-protocol-shim.js`, `assets/docs/*`, and `assets/i18n/*` must all be
  reachable under the configured `baseHref`. Use `baseHref: "./"` (the value used
  by this repository) for direct file open and subpath hosting; `/` only works
  when the site is served from the domain root.
- Use hash routing (the default) so deep links do not require server-side
  rewrites. If you switch to path routing, configure a fallback to
  `index.html`.
- Over HTTP the runtime fetches the snapshot from `assets/docs/snapshot.json`;
  under `file://` it reads the generated `assets/docs/snapshot.js` instead.
  Translations are loaded from the generated `assets/i18n/en.js` in both modes.
- Serve snapshot JSON and hashed assets with a long-lived immutable cache. Do not
  enable directory listing.

A restrictive Content Security Policy is recommended. The generated
`index.html` contains a small inline script that defines
`globalThis.process`; either allow it by hash or move it to an external file
before enforcing the policy. A starting point:

```text
default-src 'self';
script-src 'self' 'sha256-<hash of the inline bootstrap script>';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

`style-src 'unsafe-inline'` is commonly required by Angular and Ionic
component styles; tighten it with hashes/nonces if your build supports it.
Keep the snapshot and translation files same-origin, or extend `connect-src`
and `img-src` explicitly rather than using a wildcard.
