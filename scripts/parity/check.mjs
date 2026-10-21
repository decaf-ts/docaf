#!/usr/bin/env node
/**
 * Executable BetterDocs parity comparison.
 *
 * Provenance:
 *  - Baseline: SoftwareBrothers/better-docs at commit
 *    248ea8f0ed0eaff9eaf568554566f80454ab8cf5 (MIT), normalized into
 *    tests/fixtures/parity/baseline.json by
 *    scripts/parity/generate-baseline.mjs.
 *  - Port: src/generator/betterdocs/typescript/TypeConverter.ts (the ported
 *    `typescript/type-converter.js` used by TypeScriptPlugin).
 *  - Common fixtures: tests/fixtures/parity/common (scripts/parity/
 *    fixtures.json).
 *  - Normalization: scripts/parity/normalize.mjs (version 1).
 *
 * The baseline toolchain is developer-only: the generated fixture file is
 * committed, and this script loads the ported TypeScript sources directly
 * through a local transpile hook. No BetterDocs, JSDoc, TAFFY or Playwright
 * package enters the runtime dependency graph.
 *
 * Exit code 0 means every committed baseline doclet block matched the port's
 * normalized semantics for the same fixture statement. A mismatch prints the
 * first differing record and exits 1.
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Logging } from "@decaf-ts/logging";

import {
  BASELINE_COMMIT,
  NORMALIZATION_VERSION,
  firstDifference,
  parseComment,
} from "./normalize.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const ts = requireFromRoot("typescript");

const log = Logging.for("docaf parity");

const BASELINE_FILE = path.join(ROOT, "tests/fixtures/parity/baseline.json");
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(SCRIPT_DIR, "fixtures.json"), "utf8")
);
const FIXTURE_ROOT = path.join(ROOT, MANIFEST.fixtureRoot);

const COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  skipLibCheck: true,
  strict: false,
  noEmit: true,
  allowJs: true,
  types: [],
};

function installTypeScriptLoader() {
  requireFromRoot.extensions[".ts"] = function loadTypeScript(
    module,
    filename
  ) {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        experimentalDecorators: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

function loadPortConverter() {
  installTypeScriptLoader();
  return requireFromRoot(
    path.join(
      ROOT,
      "src/generator/betterdocs/typescript/TypeConverter.ts"
    )
  ).TypeConverter;
}

function contextFor(filename, source) {
  const program = ts.createProgram([filename], COMPILER_OPTIONS);
  const sourceFile = program.getSourceFile(filename);
  if (!sourceFile) throw new Error(`Program does not contain ${filename}`);
  return {
    filename,
    source,
    sourceFile,
    program,
    checker: program.getTypeChecker(),
    rootNames: [filename],
    diagnostics: {
      error() {},
      warn() {},
      info() {},
    },
  };
}

function portSemantics(TypeConverter, filename, source) {
  const declarationComments = new Map();
  const doclet = () => ({ uid: "parity-doclet" });
  const emitter = {
    emitDeclaration(declaration) {
      declarationComments.set(declaration.name, {
        kind: declaration.kind,
        comment: declaration.syntheticComment ?? "",
      });
      return doclet();
    },
    emitMember() {
      return doclet();
    },
  };
  const converter = new TypeConverter(emitter, {
    packageName: "parity",
    typeMode: "betterdocs",
  });
  converter.convertFile(contextFor(filename, source));
  return declarationComments;
}

function checkFixture(TypeConverter, fixture) {
  const absolute = path.join(FIXTURE_ROOT, fixture.file);
  if (!fs.existsSync(absolute)) {
    return {
      failures: [`${fixture.file}: fixture file is missing`],
      improvements: [],
    };
  }
  const source = fs.readFileSync(absolute, "utf8");
  const digest = createHash("sha256").update(source).digest("hex");
  if (digest !== fixture.sha256) {
    return {
      failures: [
        `${fixture.file}: fixture changed since the baseline was generated ` +
          `(expected sha256 ${fixture.sha256}, got ${digest}). ` +
          `Run npm run parity:baseline.`,
      ],
      improvements: [],
    };
  }

  const actual = portSemantics(TypeConverter, absolute, source);
  const failures = [];
  const improvements = [];
  for (const statement of fixture.statements) {
    const entry = actual.get(statement.name);
    if (!entry) {
      failures.push(
        `${fixture.file}:${statement.name}: port emitted no declaration`
      );
      continue;
    }
    const blocks = parseComment(entry.comment);
    if (statement.blocks.length === 0) {
      // BetterDocs' type converter drops documented aliases it cannot classify
      // (import types, qualified type references). The port documents them;
      // that is a deliberate improvement, so assert the declaration exists but
      // do not require baseline comment parity. See scripts/parity/README.md.
      improvements.push(`${fixture.file}:${statement.name}`);
      continue;
    }
    const difference = firstDifference(statement.blocks, blocks);
    if (difference) {
      failures.push(
        `${fixture.file}:${statement.name} (${statement.kind}): ${difference}`
      );
    }
  }
  return { failures, improvements };
}

function main() {
  if (!fs.existsSync(BASELINE_FILE)) {
    log.error(
      "parity: missing tests/fixtures/parity/baseline.json; run " +
        "npm run parity:baseline with the pinned BetterDocs checkout"
    );
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  if (baseline.provenance?.baseline?.commit !== BASELINE_COMMIT) {
    log.error(
      `parity: baseline fixture provenance commit ` +
        `"${baseline.provenance?.baseline?.commit}" does not match the pin ` +
        `"${BASELINE_COMMIT}"`
    );
    process.exit(1);
  }
  if (
    baseline.provenance?.normalizationVersion !== NORMALIZATION_VERSION
  ) {
    log.error(
      `parity: normalization version mismatch (fixture ` +
        `${baseline.provenance?.normalizationVersion}, code ${NORMALIZATION_VERSION}); ` +
        `run npm run parity:baseline`
    );
    process.exit(1);
  }

  const TypeConverter = loadPortConverter();
  const failures = [];
  const improvements = [];
  let statements = 0;
  let blocks = 0;
  for (const fixture of baseline.fixtures) {
    const result = checkFixture(TypeConverter, fixture);
    failures.push(...result.failures);
    improvements.push(...result.improvements);
    statements += fixture.statements.length;
    blocks += fixture.statements.reduce(
      (total, statement) => total + statement.blocks.length,
      0
    );
  }

  log.info(
    `parity: baseline ${BASELINE_COMMIT.slice(0, 8)} · ` +
      `${baseline.fixtures.length} fixtures · ${statements} statements · ` +
      `${blocks} normalized blocks`
  );
  if (failures.length) {
    log.error(`parity: ${failures.length} mismatch(es)`);
    for (const failure of failures) log.error(`  - ${failure}`);
    process.exit(1);
  }
  if (improvements.length) {
    log.info(
      `parity: ${improvements.length} documented port-only improvement(s): ` +
        improvements.join(", ")
    );
  }
  log.info("parity: OK");
}

main();
