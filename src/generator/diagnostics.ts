import { InternalError } from "@decaf-ts/db-decorators";
import type { SourceLocation } from "./types";

/**
 * @description Severity levels for documentation build diagnostics.
 * @summary Distinguishes `error` diagnostics, which abort the build via
 * {@link DocsDiagnostics.assertClean}, from `warning` diagnostics, which are
 * recorded but tolerated.
 * @memberOf module:docaf
 */
export type DocsDiagnosticSeverity = "error" | "warning";

/**
 * @description A single documentation build diagnostic record.
 * @summary Captures the severity, a stable diagnostic code (for example
 * `DOCAF_LOAD_MISSING` or `DOCAF_TS_1234`), a human-readable message, and an
 * optional source location identifying where the diagnostic originated.
 */
export interface DocsDiagnostic {
  severity: DocsDiagnosticSeverity;
  code: string;
  message: string;
  location?: SourceLocation;
}

/**
 * @description Error thrown when a documentation build accumulates error
 * diagnostics.
 * @summary Extends `InternalError`. Its message lists every error-severity
 * diagnostic (code and message) that led to the failure, while the
 * `diagnostics` property retains the complete collection, warnings included.
 * Thrown by `DocsDiagnostics.assertClean()` and by the pipeline when sources
 * are missing or contain syntactic errors.
 * @class DocsBuildError
 */
export class DocsBuildError extends InternalError {
  readonly diagnostics: readonly DocsDiagnostic[];

  constructor(diagnostics: readonly DocsDiagnostic[]) {
    const errors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error"
    );
    super(
      `Docs build failed with ${errors.length} error(s): ${errors
        .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
        .join("; ")}`
    );
    this.name = "DocsBuildError";
    this.diagnostics = diagnostics;
  }
}

/**
 * @description Collector of documentation build diagnostics.
 * @summary Accumulates `DocsDiagnostic` entries during a build. Plugins and
 * helpers record issues through `error()`/`warning()`/`add()` without throwing,
 * so extraction can continue; the pipeline decides on failure by calling
 * `assertClean()`, which throws a `DocsBuildError` carrying all diagnostics
 * whenever any error-severity entry exists. Diagnostics are never collected
 * after that throw, keeping failed builds atomic.
 * @class DocsDiagnostics
 */
export class DocsDiagnostics {
  private readonly entries: DocsDiagnostic[] = [];

  error(
    code: string,
    message: string,
    location?: SourceLocation
  ): DocsDiagnostic {
    return this.add("error", code, message, location);
  }

  warning(
    code: string,
    message: string,
    location?: SourceLocation
  ): DocsDiagnostic {
    return this.add("warning", code, message, location);
  }

  add(
    severity: DocsDiagnosticSeverity,
    code: string,
    message: string,
    location?: SourceLocation
  ): DocsDiagnostic {
    const diagnostic: DocsDiagnostic = { severity, code, message, location };
    this.entries.push(diagnostic);
    return diagnostic;
  }

  extend(diagnostics: readonly DocsDiagnostic[]): void {
    this.entries.push(...diagnostics);
  }

  get all(): readonly DocsDiagnostic[] {
    return [...this.entries];
  }

  get errors(): readonly DocsDiagnostic[] {
    return this.entries.filter(
      (diagnostic) => diagnostic.severity === "error"
    );
  }

  get warnings(): readonly DocsDiagnostic[] {
    return this.entries.filter(
      (diagnostic) => diagnostic.severity === "warning"
    );
  }

  get hasErrors(): boolean {
    return this.entries.some(
      (diagnostic) => diagnostic.severity === "error"
    );
  }

  clear(): void {
    this.entries.length = 0;
  }

  assertClean(): void {
    if (this.hasErrors) throw new DocsBuildError(this.all);
  }
}
