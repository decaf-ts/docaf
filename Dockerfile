# syntax=docker/dockerfile:1.7

# Docker deliverable for @decaf-ts/docaf.
#
# The runtime image contains the built docaf package next to the public
# @decaf-ts/cli binary. `CliWrapper` discovers @decaf-ts/docaf as a sibling
# package under the global node_modules scope, so the image exposes
# `decaf docs ...` without npm-link or a project-local install.
#
# Build:
#   docker build -t decaf-ts/docaf:latest .
# Optional private-registry auth (never baked into a layer):
#   DOCKER_BUILDKIT=1 docker build --secret id=TOKEN,env=NPM_TOKEN -t decaf-ts/docaf:latest .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS builder

ENV CI=true
WORKDIR /opt/docaf

# build-scripts reads git metadata when available and warns when git is absent.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Public registry installs are the default. When the build needs an npm token
# (for example a private mirror), pass it as a BuildKit secret; it is written
# only inside this RUN step and removed before the layer is committed.
RUN --mount=type=secret,id=TOKEN,required=false \
    set -eux; \
    if [ -s /run/secrets/TOKEN ]; then \
      printf '//registry.npmjs.org/:_authToken=%s\n' "$(cat /run/secrets/TOKEN)" > .npmrc; \
    fi; \
    npm ci --no-audit --no-fund; \
    rm -f .npmrc

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev --no-audit --no-fund \
    && rm -rf src tests tmp workdocs

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ARG DECAF_CLI_VERSION=0.13.2
ARG DECAF_UTILS_VERSION=1.11.1

# @decaf-ts/utils is installed explicitly because the published @decaf-ts/cli
# 0.13.2 declares it as neither a dependency nor a peer dependency, although
# its slogans module requires it at runtime.
RUN npm install -g --no-audit --no-fund \
      "@decaf-ts/cli@${DECAF_CLI_VERSION}" \
      "@decaf-ts/utils@${DECAF_UTILS_VERSION}" \
    && npm cache clean --force

# A real directory (not a symlink) so CliWrapper's sibling-package crawl sees
# it. The package ships its own pruned node_modules, including the Angular
# renderer toolchain that `decaf docs build` reuses.
COPY --from=builder /opt/docaf /usr/local/lib/node_modules/@decaf-ts/docaf

ENV NODE_ENV=production \
    CI=true \
    NG_CLI_ANALYTICS=false

USER node

WORKDIR /workspace

# `docker run <image> build --output ...` => `decaf docs build --output ...`
ENTRYPOINT ["decaf", "docs"]

LABEL org.opencontainers.image.title="@decaf-ts/docaf" \
      org.opencontainers.image.description="Decaf documentation generator CLI (decaf docs build/snapshot/init)" \
      org.opencontainers.image.licenses="MIT"
