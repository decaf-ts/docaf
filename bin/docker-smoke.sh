#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${DOCAF_DOCKER_IMAGE:-decaf-ts/docaf:smoke-$$}"
RESOURCE_ID="docaf-smoke-$$"
PROJECT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/docaf-smoke-project.XXXXXX")"
OUTPUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/docaf-smoke-output.XXXXXX")"
PROJECT_VOLUME="docaf-smoke-project-${RESOURCE_ID}"
OUTPUT_VOLUME="docaf-smoke-output-${RESOURCE_ID}"
VOLUMES_CREATED=0

cleanup() {
  rm -rf "${PROJECT_DIR}" "${OUTPUT_DIR}"
  if [ "${VOLUMES_CREATED}" = "1" ]; then
    docker volume rm -f "${PROJECT_VOLUME}" "${OUTPUT_VOLUME}" >/dev/null 2>&1 || true
  fi
  if [ "${DOCAF_KEEP_IMAGE:-0}" != "1" ]; then
    docker image rm -f "${IMAGE}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cp -R "${REPO_ROOT}/tests/fixtures/vertical-slice/src" "${PROJECT_DIR}/src"

cat > "${PROJECT_DIR}/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
JSON

cat > "${PROJECT_DIR}/package.json" <<'JSON'
{
  "name": "docaf-docker-smoke",
  "version": "1.0.0",
  "private": true
}
JSON

RUN_ARGS=("--user" "$(id -u):$(id -g)" "-e" "HOME=/tmp")
if [ -n "${DOCAF_DOCKER_RUN_ARGS:-}" ]; then
  read -r -a RUN_ARGS <<< "${DOCAF_DOCKER_RUN_ARGS}"
fi

echo "Building ${IMAGE} from ${REPO_ROOT}"
BUILD_ARGS=(
  --label "docaf.smoke.id=${RESOURCE_ID}"
  -t "${IMAGE}"
)
# buildx with the docker-container driver keeps the result in the build cache
# unless an output is requested; --load makes the image available to docker run.
if docker buildx version >/dev/null 2>&1; then
  BUILD_ARGS+=(--load)
fi
# shellcheck disable=SC2086
docker build "${BUILD_ARGS[@]}" ${DOCAF_DOCKER_BUILD_ARGS:-} "${REPO_ROOT}"

MOUNT_MODE="${DOCAF_SMOKE_MOUNT_MODE:-auto}"
if [ "${MOUNT_MODE}" = "auto" ]; then
  echo "probe" > "${PROJECT_DIR}/.docaf-mount-probe"
  if docker run --rm --entrypoint test "${RUN_ARGS[@]}" \
      -v "${PROJECT_DIR}:/workspace:ro" "${IMAGE}" \
      -f /workspace/.docaf-mount-probe >/dev/null 2>&1; then
    MOUNT_MODE="bind"
  else
    # Remote/DinD Docker daemons cannot see this host's temporary directories.
    # Named volumes go through the daemon itself and exercise the same mounts.
    MOUNT_MODE="volume"
  fi
  rm -f "${PROJECT_DIR}/.docaf-mount-probe"
fi
echo "Mount mode: ${MOUNT_MODE}"

if [ "${MOUNT_MODE}" = "bind" ]; then
  MOUNT_ARGS=(-v "${PROJECT_DIR}:/workspace" -v "${OUTPUT_DIR}:/output")
else
  docker volume create --label "docaf.smoke.id=${RESOURCE_ID}" "${PROJECT_VOLUME}" >/dev/null
  docker volume create --label "docaf.smoke.id=${RESOURCE_ID}" "${OUTPUT_VOLUME}" >/dev/null
  VOLUMES_CREATED=1
  tar -C "${PROJECT_DIR}" -c . | docker run --rm -i --user root \
    --entrypoint sh -v "${PROJECT_VOLUME}:/workspace" "${IMAGE}" \
    -c "tar -x -C /workspace && chown -R $(id -u):$(id -g) /workspace"
  docker run --rm --user root --entrypoint sh \
    -v "${OUTPUT_VOLUME}:/output" "${IMAGE}" \
    -c "chown $(id -u):$(id -g) /output"
  MOUNT_ARGS=(-v "${PROJECT_VOLUME}:/workspace" -v "${OUTPUT_VOLUME}:/output")
fi

echo "Running decaf docs build with mounted source and output folders"
docker run --rm \
  --name "${RESOURCE_ID}" \
  --label "docaf.smoke.id=${RESOURCE_ID}" \
  "${RUN_ARGS[@]}" \
  "${MOUNT_ARGS[@]}" \
  "${IMAGE}" \
  build --tsconfig /workspace/tsconfig.json --include "src/**/*.ts" \
  --project-name docaf-docker-smoke --project-version 1.0.0 \
  --output /output/docs --base-href ./

if [ "${MOUNT_MODE}" = "volume" ]; then
  docker run --rm --user root --entrypoint tar \
    -v "${OUTPUT_VOLUME}:/output" "${IMAGE}" \
    -c -C /output . | tar -x -C "${OUTPUT_DIR}"
fi

[ -f "${OUTPUT_DIR}/docs/index.html" ] || fail "docs/index.html was not generated in the output mount"
[ -f "${OUTPUT_DIR}/docs/assets/docs/snapshot.json" ] || fail "docs/assets/docs/snapshot.json was not generated in the output mount"
[ -d "${OUTPUT_DIR}/docs/assets/i18n" ] || fail "docs/assets/i18n was not generated in the output mount"

FILE_COUNT="$(find "${OUTPUT_DIR}/docs" -type f | wc -l | tr -d ' ')"
echo "docaf docker smoke passed (image=${IMAGE}, mount=${MOUNT_MODE}, output files=${FILE_COUNT})"
echo "Top-level output:"
find "${OUTPUT_DIR}/docs" -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort | head -n 12
