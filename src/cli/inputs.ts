import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { DocsBuildError } from "../generator/diagnostics";
import { stableHash, stableStringify } from "../snapshot/canonical";
import type {
  DocsInputs,
  DocsSourceFile,
  ResolvedDocsConfig,
} from "./types";

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".idea",
  ".vscode",
  ".angular",
  ".decaf-docs",
  ".docaf-angular-app",
  "dist",
  "lib",
  "coverage",
  "out-tsc",
  "tmp",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Minimal glob matcher supporting the patterns used by docs configuration:
 * `**` (any number of segments), `*` (a single segment), `?`, and `{a,b}`.
 */
export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*") {
      if (normalized[index + 1] === "*") {
        if (normalized[index + 2] === "/") {
          source += "(?:.*/)?";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    if (character === "{") {
      const end = normalized.indexOf("}", index);
      if (end > index) {
        const choices = normalized
          .slice(index + 1, end)
          .split(",")
          .map((choice) => escapeRegExp(choice));
        source += `(?:${choices.join("|")})`;
        index = end;
        continue;
      }
    }
    source += escapeRegExp(character);
  }
  source += "$";
  return new RegExp(source);
}

function walk(directory: string, root: string, output: string[]): void {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      walk(path.join(directory, entry.name), root, output);
      continue;
    }
    if (!entry.isFile()) continue;
    const absolute = path.join(directory, entry.name);
    output.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
}

/**
 * @description Resolves the TypeScript source files to extract documentation from.
 * @summary Applies the config's `source.include` patterns (literal file paths are kept as-is,
 * glob patterns are matched against a recursive walk of the config root that skips generated
 * and hidden directories), removes files matched by `source.exclude`, de-duplicates and sorts
 * the results.
 * @param {ResolvedDocsConfig} config - The resolved docs configuration with source settings.
 * @returns {DocsSourceFile[]} Sorted, de-duplicated list of selected source files (relative and absolute paths).
 * @throws {DocsBuildError} When no source file matches the include patterns.
 */
export function resolveSourceFiles(
  config: ResolvedDocsConfig
): DocsSourceFile[] {
  const root = config.root;
  const relativeFiles: string[] = [];
  for (const pattern of config.source.include) {
    const literal = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!/[*?{]/.test(literal)) {
      const absolute = path.resolve(root, literal);
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
        relativeFiles.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
      continue;
    }
    const candidates: string[] = [];
    walk(root, root, candidates);
    const matcher = globToRegExp(pattern);
    for (const candidate of candidates) {
      if (matcher.test(candidate)) relativeFiles.push(candidate);
    }
  }

  const excludes = config.source.exclude.map(globToRegExp);
  const files = [...new Set(relativeFiles)]
    .filter((relative) => !excludes.some((matcher) => matcher.test(relative)))
    .sort()
    .map((relative) => ({
      relative,
      absolute: path.resolve(root, relative),
    }));

  if (!files.length) {
    throw new DocsBuildError([
      {
        severity: "error",
        code: "DOCAF_NO_SOURCES",
        message: `No TypeScript sources matched ${JSON.stringify(
          config.source.include
        )} under ${root}. Update source.include in your docs config.`,
      },
    ]);
  }
  return files;
}

function compileOptions(config: ResolvedDocsConfig): ts.CompilerOptions {
  const read = ts.readConfigFile(config.source.tsconfigPath, ts.sys.readFile);
  if (read.error) {
    throw new DocsBuildError([
      {
        severity: "error",
        code: "DOCAF_CONFIG_TSCONFIG_INVALID",
        message: `Cannot read ${config.source.tsconfigPath}: ${ts.flattenDiagnosticMessageText(
          read.error.messageText,
          "\n"
        )}`,
      },
    ]);
  }
  const converted = ts.convertCompilerOptionsFromJson(
    (read.config as { compilerOptions?: Record<string, unknown> })
      .compilerOptions ?? {},
    path.dirname(config.source.tsconfigPath),
    config.source.tsconfigPath
  );
  if (converted.errors.length) {
    throw new DocsBuildError(
      converted.errors.map((diagnostic) => ({
        severity: "error" as const,
        code: `DOCAF_CONFIG_TSCONFIG_${diagnostic.code}`,
        message: ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n"
        ),
      }))
    );
  }
  return { ...converted.options, noEmit: true };
}

/**
 * @description Resolves the complete set of inputs for a docs extraction run.
 * @summary Combines {@link resolveSourceFiles}, the compiler options read from the configured
 * tsconfig (with `noEmit` forced), and a fingerprint that hashes the per-file content hashes
 * together with the compiler options, project metadata, and publisher flags. The fingerprint
 * lets the orchestrator reuse a cached snapshot when none of these changed.
 * @param {ResolvedDocsConfig} config - The resolved docs configuration.
 * @returns {DocsInputs} The selected files, compiler options, and configuration fingerprint.
 */
export function resolveDocsInputs(config: ResolvedDocsConfig): DocsInputs {
  const files = resolveSourceFiles(config);
  const compilerOptions = compileOptions(config);
  const fingerprints = files.map((file) => ({
    relative: file.relative,
    hash: stableHash(fs.readFileSync(file.absolute, "utf8")),
  }));
  const fingerprint = stableHash(
    stableStringify({
      source: fingerprints,
      compilerOptions,
      project: config.project,
      publisher: config.publisher,
    })
  );
  return {
    files,
    compilerOptions,
    fingerprint,
  };
}
