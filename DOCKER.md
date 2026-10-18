# Docker usage

`@decaf-ts/docaf` ships a container image that exposes the same `decaf docs`
CLI as the npm package. The image runs as the unprivileged `node` user and is
designed to read a project mounted from the host and write the generated site
to a mounted output folder.

## Build the image

```bash
docker build -t decaf-ts/docaf:latest .
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
  -t decaf-ts/docaf:latest .
```

Inside the build, `Dockerfile` writes the token to `.npmrc` only for the
`npm ci` step and deletes the file before the layer is committed. The same
pattern works for a token file:

```bash
docker build --secret id=TOKEN,src="$HOME/.npmtoken" -t decaf-ts/docaf:latest .
```

Never pass `NPM_TOKEN` with `--build-arg`; build arguments are recorded in the
image history.

### npm scripts

The repository also exposes the template Docker pipeline as npm scripts:

- `npm run docker:login` authenticates `ghcr.io` with the `docker-user` and
  `docker` credentials from `decaf utils credentials`.
- `npm run docker:build` builds from the root `Dockerfile` with BuildKit,
  passing the `npm` credential as the `TOKEN` secret.
- `npm run docker:publish` pushes the versioned and floating tags.

These scripts are inherited from the `ts-workspace` template: they tag and push
`ghcr.io/decaf-ts/ts-workspace:base-<version>` rather than
`decaf-ts/docaf`, and they require `jq` plus the credentials above. Use them for
the template base image; for the `decaf-ts/docaf` image documented here, use the
manual `docker build` commands above or the Docker Publish workflow.

## Run the CLI against mounted folders

The container entrypoint is `decaf docs`, so the first argument selects the
subcommand. Mount the documented project at `/workspace` and an output
directory at `/output`:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/dist/docs:/output" \
  decaf-ts/docaf:latest build --config /workspace/decafdocs.config.mjs
```

A minimal config for this layout:

```js
// decafdocs.config.mjs
export default {
  project: { name: "my-package", version: "1.0.0" },
  source: { tsconfig: "./tsconfig.json", include: ["src/**/*.ts"] },
  targets: [{ renderer: "angular", output: "/output/docs" }],
};
```

The project mount must be writable. docaf resolves its snapshot directory under
the project root (the config root) and writes `.decaf-docs/snapshot.json` and
`.decaf-docs/build-cache.json` there before any target runs, so a read-only
mount on `/workspace` fails. To keep generated output out of the source tree,
point the target output at the separate `/output` mount; the writable project
mount also lets `.decaf-docs/` persist between runs.

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
    -v "$PWD/dist/docs:/output" \
    decaf-ts/docaf:latest build
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

The Angular target emits a static single-page application plus a data-only
snapshot. Serve it over HTTPS from a static host or CDN:

- Publish the output directory as-is; `index.html`, hashed JS/CSS assets,
  `assets/docs/snapshot.json`, and `assets/i18n/*.json` must all be reachable
  under the configured `baseHref`.
- Use hash routing (the default) so deep links do not require server-side
  rewrites. If you switch to path routing, configure a fallback to
  `index.html`.
- Serve the snapshot and translations as `application/json`, and hashed
  assets with a long-lived immutable cache. Do not enable directory listing.

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
