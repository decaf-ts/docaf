#!/usr/bin/env node
/**
 * Regenerates the normalized BetterDocs baseline fixtures.
 *
 * Provenance:
 *  - Baseline repository: https://github.com/SoftwareBrothers/better-docs
 *  - Baseline commit: 248ea8f0ed0eaff9eaf568554566f80454ab8cf5 (MIT)
 *  - Baseline parser: `typescript/type-converter.js` at that commit.
 *  - Common fixtures: tests/fixtures/parity/common (see scripts/parity/
 *    fixtures.json).
 *  - Normalization: scripts/parity/normalize.mjs (version 1). The comparison
 *    is semantic (ordered tag records and doclet identifiers), not a raw
 *    string or HTML snapshot.
 *
 * This script is developer tooling only. It is not part of the package build
 * or runtime dependency graph, and its output is committed so `test:parity`
 * is reproducible without network access to the upstream repository.
 *
 * Regeneration procedure:
 *   git clone https://github.com/SoftwareBrothers/better-docs /tmp/better-docs
 *   git -C /tmp/better-docs checkout 248ea8f0ed0eaff9eaf568554566f80454ab8cf5
 *   npm run parity:baseline
 *
 * Set BETTER_DOCS_BASELINE_ROOT to use a checkout at another location.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASELINE_COMMIT,
  BASELINE_REPOSITORY,
  NORMALIZATION_VERSION,
  parseComment,
} from "./normalize.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const ts = requireFromRoot("typescript");

const BASELINE_ROOT =
  process.env.BETTER_DOCS_BASELINE_ROOT ?? "/tmp/better-docs";
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(SCRIPT_DIR, "fixtures.json"), "utf8")
);
const FIXTURE_ROOT = path.join(ROOT, MANIFEST.fixtureRoot);
const OUTPUT = path.join(ROOT, "tests/fixtures/parity/baseline.json");


function fail(message) {
  console.error(`parity baseline: ${message}`);
  process.exit(1);
}

function assertBaselineCheckout() {
  if (!fs.existsSync(BASELINE_ROOT)) {
    fail(
      `BetterDocs baseline checkout not found at ${BASELINE_ROOT}. Clone ` +
        `${BASELINE_REPOSITORY} and check out ${BASELINE_COMMIT}, then rerun.`
    );
  }
  const converter = path.join(
    BASELINE_ROOT,
    "typescript/type-converter.js"
  );
  if (!fs.existsSync(converter)) {
    fail(`Missing pinned file ${converter}`);
  }
  let revision;
  try {
    revision = execFileSync("git", ["-C", BASELINE_ROOT, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    fail(
      `Cannot read the baseline git revision at ${BASELINE_ROOT}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (revision !== BASELINE_COMMIT) {
    fail(
      `Baseline checkout is at ${revision}, expected ${BASELINE_COMMIT}. ` +
        `Check out the pinned commit before regenerating fixtures.`
    );
  }
}

function loadBaselineConverter() {
  const Module = requireFromRoot("node:module");
  const requireFromBaseline = createRequire(
    path.join(BASELINE_ROOT, "package.json")
  );
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolve(request, parent, ...rest) {
    if (
      request === "typescript" &&
      parent?.filename?.startsWith(BASELINE_ROOT)
    ) {
      return requireFromRoot.resolve("typescript");
    }
    return originalResolve.call(this, request, parent, ...rest);
  };
  try {
    return requireFromBaseline("./typescript/type-converter.js");
  } finally {
    Module._resolveFilename = originalResolve;
  }
}

function statementName(statement) {
  return statement.name?.text ?? null;
}

function isSupported(statement) {
  return (
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isFunctionDeclaration(statement)
  );
}

function statementKind(statement) {
  if (ts.isClassDeclaration(statement)) return "class";
  if (ts.isInterfaceDeclaration(statement)) return "interface";
  if (ts.isTypeAliasDeclaration(statement)) return "type-alias";
  if (ts.isFunctionDeclaration(statement)) return "function";
  return "unsupported";
}

function baselineSemantics(typeConverter, source, filename) {
  const sourceFile = ts.createSourceFile(
    path.basename(filename),
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statements = [];
  sourceFile.statements.forEach((statement, index) => {
    const name = statementName(statement);
    const kind = statementKind(statement);
    if (!isSupported(statement) || !name) return;
    const slice = source.slice(statement.getFullStart(), statement.end);
    const output = typeConverter(slice, filename);
    statements.push({
      index,
      name,
      kind,
      blocks: parseComment(output ?? ""),
    });
  });
  return statements;
}

function main() {
  assertBaselineCheckout();
  const typeConverter = loadBaselineConverter();
  const fixtures = [];
  let blockCount = 0;

  for (const fixture of MANIFEST.fixtures) {
    const absolute = path.join(FIXTURE_ROOT, fixture);
    const source = fs.readFileSync(absolute, "utf8");
    const statements = baselineSemantics(typeConverter, source, absolute);
    for (const statement of statements) blockCount += statement.blocks.length;
    fixtures.push({
      file: fixture,
      sha256: createHash("sha256").update(source).digest("hex"),
      statements,
    });
    console.log(
      `parity baseline: ${fixture}: ${statements.length} statements, ` +
        `${statements.reduce((total, entry) => total + entry.blocks.length, 0)} blocks`
    );
  }

  const document = {
    schemaVersion: 1,
    provenance: {
      baseline: {
        repository: BASELINE_REPOSITORY,
        commit: BASELINE_COMMIT,
        license: "MIT",
        parser: "typescript/type-converter.js",
      },
      fixtures: MANIFEST.fixtureRoot,
      manifest: "scripts/parity/fixtures.json",
      normalizationVersion: NORMALIZATION_VERSION,
      generatedBy: "scripts/parity/generate-baseline.mjs",
      regeneration:
        "git clone https://github.com/SoftwareBrothers/better-docs " +
        "/tmp/better-docs && git -C /tmp/better-docs checkout " +
        `${BASELINE_COMMIT} && npm run parity:baseline`,
    },
    fixtures,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(
    `parity baseline: wrote ${path.relative(ROOT, OUTPUT)} ` +
      `(${fixtures.length} fixtures, ${blockCount} blocks)`
  );
}

main();
