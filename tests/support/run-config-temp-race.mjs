import fs from "node:fs";
import path from "node:path";

import { loadDocsConfig } from "../../lib/esm/cli/config.js";

const request = JSON.parse(fs.readFileSync(0, "utf8"));
const originalWriteFileSync = fs.writeFileSync;
const writes = [];

function isTemporaryConfigFile(file) {
  return (
    typeof file === "string" &&
    path.basename(file).startsWith(".decafdocs.config.")
  );
}

fs.writeFileSync = function writeFileSync(file, data, options) {
  if (isTemporaryConfigFile(file)) writes.push({ file, options });
  return originalWriteFileSync.call(this, file, data, options);
};

function leftovers() {
  return fs
    .readdirSync(request.root)
    .filter((entry) => entry.startsWith(".decafdocs.config."));
}

try {
  const loads = request.concurrent
    ? [
        loadDocsConfig({ cwd: request.root }),
        loadDocsConfig({ cwd: request.root }),
      ]
    : [loadDocsConfig({ cwd: request.root })];
  const results = await Promise.all(loads);
  process.stdout.write(
    JSON.stringify({
      ok: true,
      pid: process.pid,
      projects: results.map((result) => result.project),
      writes,
      leftovers: leftovers(),
    })
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      pid: process.pid,
      error: {
        name: error?.name,
        message: error?.message,
        diagnostics: error?.diagnostics,
      },
      writes,
      leftovers: leftovers(),
    })
  );
  process.exitCode = 1;
} finally {
  fs.writeFileSync = originalWriteFileSync;
}
