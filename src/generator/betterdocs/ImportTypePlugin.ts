import ts from "typescript";
import type { DecafDocsPlugin, DocsSourceContext } from "../types";

/**
 * @description Matches JSDoc import typedefs.
 * @summary Regular expression matching `/**`-style comments that declare a
 * `@typedef {import(...)}` reference. Used in `compat` mode to strip those
 * comments from the source before doclet parsing, mirroring the historical
 * BetterDocs workaround.
 */
const IMPORT_TYPEDEF =
  /\/\*\*\s*?@typedef\s*?{\s*?import.*\*\//g;

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
 * @description Port of BetterDocs `typedef-import.js`.
 * @summary Plugin that handles `@typedef {import(...)}` references in parsed
 * sources. In `compat` mode it deletes those comments before parsing; in
 * `native` mode it validates every `import("...")` type node against the
 * shared TypeScript program's module resolution and reports an
 * `DOCAF_IMPORT_TYPE_UNRESOLVED` diagnostic for specifiers that cannot be
 * resolved. `native` is the default.
 */
export class ImportTypePlugin implements DecafDocsPlugin {
  readonly name = "import-type";

  /**
   * @description Selected import-type handling mode.
   * @summary Holds the resolved `mode` option; defaults to `native` when the
   * plugin is constructed without explicit options.
   */
  private readonly mode: "compat" | "native";

  /**
   * @description Creates the import-type plugin.
   * @summary Initializes the plugin with the given options, falling back to
   * `native` mode when no `mode` is provided.
   * @param {ImportTypePluginOptions} [options={}] - Optional plugin options.
   */
  constructor(options: ImportTypePluginOptions = {}) {
    this.mode = options.mode ?? "native";
  }

  /**
   * @description Runs before doclet parsing of a source file.
   * @summary In `compat` mode removes `@typedef {import(...)}` comments from
   * the source. In `native` mode walks the TypeScript AST of the source file
   * and validates each `import("...")` literal against module resolution,
   * emitting a diagnostic when the specifier cannot be resolved.
   * @param {DocsSourceContext} source - The source context being pre-processed.
   */
  beforeParse(source: DocsSourceContext): void {
    if (this.mode === "compat") {
      source.source = source.source.replace(IMPORT_TYPEDEF, "");
      return;
    }
    const compilerOptions = source.program.getCompilerOptions();
    const inspect = (node: ts.Node): void => {
      if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        if (
          argument &&
          ts.isLiteralTypeNode(argument) &&
          ts.isStringLiteral(argument.literal)
        ) {
          const specifier = argument.literal.text;
          const resolved = ts.resolveModuleName(
            specifier,
            source.filename,
            compilerOptions,
            ts.sys
          ).resolvedModule;
          if (!resolved) {
            const position = source.sourceFile.getLineAndCharacterOfPosition(
              argument.literal.getStart(source.sourceFile)
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
      ts.forEachChild(node, inspect);
    };
    inspect(source.sourceFile);
  }
}
