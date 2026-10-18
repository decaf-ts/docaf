import ts from "typescript";
import type { DecafDocsPlugin, DocsSourceContext } from "../types";

const IMPORT_TYPEDEF =
  /\/\*\*\s*?@typedef\s*?{\s*?import.*\*\//g;
const IMPORT_TYPE =
  /import\s*\(\s*["']([^"']+)["']\s*\)(\.[A-Za-z_$][\w$]*)*/g;

/**
 * @description Options for the `import("...")` type handling plugin.
 * @summary Selects the strategy used for `@typedef {import(...)}` comments.
 * In `compat` mode the historical BetterDocs workaround strips those comments
 * before parsing; in `native` mode import type references are validated against
 * the shared TypeScript program's module resolution.
 */
export interface ImportTypePluginOptions {
  /**
   * `compat` preserves BetterDocs' workaround of deleting
   * `@typedef {import(...)}` comments before parsing.
   * `native` resolves the import through the shared TypeScript program.
   */
  mode?: "compat" | "native";
}

/**
 * Port of BetterDocs `typedef-import.js`.
 */
export class ImportTypePlugin implements DecafDocsPlugin {
  readonly name = "import-type";
  private readonly mode: "compat" | "native";

  constructor(options: ImportTypePluginOptions = {}) {
    this.mode = options.mode ?? "native";
  }

  beforeParse(source: DocsSourceContext): void {
    if (this.mode === "compat") {
      source.source = source.source.replace(IMPORT_TYPEDEF, "");
      return;
    }
    const compilerOptions = source.program.getCompilerOptions();
    for (const match of source.source.matchAll(IMPORT_TYPE)) {
      const specifier = match[1];
      const resolved = ts.resolveModuleName(
        specifier,
        source.filename,
        compilerOptions,
        ts.sys
      ).resolvedModule;
      if (!resolved) {
        const position = source.sourceFile.getLineAndCharacterOfPosition(
          match.index ?? 0
        );
        source.diagnostics.error(
          "DOCAF_IMPORT_TYPE_UNRESOLVED",
          `Cannot resolve import type "${specifier}"`,
          {
            fileName: source.filename,
            line: position.line + 1,
            column: position.character + 1,
          }
        );
      }
    }
  }
}
