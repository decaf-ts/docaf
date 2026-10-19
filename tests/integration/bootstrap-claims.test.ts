import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../support/harness";

interface PackageManifest {
  scripts?: Record<string, string>;
}

const PACKAGE_JSON = path.join(REPO_ROOT, "package.json");
const DOCKER_SMOKE_SCRIPT = path.join(REPO_ROOT, "bin", "docker-smoke.sh");
const LOCK_SYNC_TIMEOUT_MS = 120_000;
const DOCKER_SMOKE_TIMEOUT_MS = 30 * 60 * 1000;
const DOCKER_TEST_ENABLED = process.env.DOCAF_DOCKER_TEST === "1";

function readManifest(): PackageManifest {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")) as PackageManifest;
}

function assertClaim(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

describe("docaf bootstrap claims", () => {
  it(
    "keeps package-lock.json in sync with package.json for npm ci",
    () => {
      const result = spawnSync(
        "npm",
        ["ci", "--dry-run", "--no-audit", "--no-fund"],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
          timeout: LOCK_SYNC_TIMEOUT_MS,
          env: { ...process.env },
        }
      );
      if (result.error) throw result.error;

      assertClaim(
        result.status === 0,
        `npm ci --dry-run failed (status ${result.status}, signal ${result.signal})\n` +
          `stdout:\n${result.stdout}\n` +
          `stderr:\n${result.stderr}`
      );
    },
    LOCK_SYNC_TIMEOUT_MS
  );

  it("wires the Docker smoke gate to the docker-smoke.sh script", () => {
    const command = readManifest().scripts?.["test:docker"];

    assertClaim(
      typeof command === "string" && /\bbin\/docker-smoke\.sh\b/.test(command),
      `package.json scripts["test:docker"] must invoke bin/docker-smoke.sh, got ${
        command === undefined ? "undefined" : JSON.stringify(command)
      }`
    );

    assertClaim(
      fs.existsSync(DOCKER_SMOKE_SCRIPT),
      `${DOCKER_SMOKE_SCRIPT} is missing`
    );
    assertClaim(
      fs.statSync(DOCKER_SMOKE_SCRIPT).isFile(),
      `${DOCKER_SMOKE_SCRIPT} is not a file`
    );

    try {
      fs.accessSync(DOCKER_SMOKE_SCRIPT, fs.constants.X_OK);
    } catch {
      throw new Error(`${DOCKER_SMOKE_SCRIPT} is not executable`);
    }
  });

  (DOCKER_TEST_ENABLED ? it : it.skip)(
    "passes the Docker image build smoke gate when DOCAF_DOCKER_TEST=1",
    () => {
      const result = spawnSync("bash", [DOCKER_SMOKE_SCRIPT], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: DOCKER_SMOKE_TIMEOUT_MS,
        env: { ...process.env },
      });
      if (result.error) throw result.error;

      assertClaim(
        result.status === 0,
        `bin/docker-smoke.sh failed (status ${result.status}, signal ${result.signal})\n` +
          `stdout:\n${result.stdout}\n` +
          `stderr:\n${result.stderr}`
      );
    },
    DOCKER_SMOKE_TIMEOUT_MS
  );
});
