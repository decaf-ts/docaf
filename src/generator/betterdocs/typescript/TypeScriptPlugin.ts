import type ts from "typescript";
import type { DocletModel } from "../../../models";
import type { GeneratedDocsStore } from "../../store";
import type { DecafDocsPlugin, DocsSourceContext } from "../../types";
import { DecafModelWriter } from "../../writers/DecafModelWriter";
import { BetterDocsCompatibilityWriter } from "../../writers/BetterDocsCompatibilityWriter";
import { TypeConverter } from "./TypeConverter";

/**
 * @description Options for the TypeScript extraction plugin.
 * @summary Configures the package name stamped onto converted doclets, the
 * store receiving emitted models, the type rendering mode passed to the
 * shared {@link TypeConverter}, whether undocumented symbols are included, and
 * whether the legacy BetterDocs compatibility writer is attached in addition to
 * the production `DecafModelWriter`.
 */
export interface TypeScriptPluginOptions {
  /**
   * Package name recorded on every emitted doclet.
   */
  packageName: string;
  /**
   * Store where the `DecafModelWriter` registers doclet and component models.
   */
  store: GeneratedDocsStore;
  /**
   * Type rendering mode delegated to the converter; defaults to `betterdocs`.
   */
  typeMode?: "betterdocs" | "native";
  /**
   * When true, undocumented symbols are converted as well; defaults to false.
   */
  includeUndocumented?: boolean;
  /**
   * When true, doclets are additionally captured by the
   * `BetterDocsCompatibilityWriter` for parity checks; defaults to false.
   */
  compatibility?: boolean;
}

/**
 * Ported `typescript.js` plugin. It shares a single `TypeConverter` (and
 * therefore a single `ts.Program`/`ts.TypeChecker`) across all sources.
 */
export class TypeScriptPlugin implements DecafDocsPlugin {
  readonly name = "typescript";
  readonly writer: DecafModelWriter;
  readonly compatibility: BetterDocsCompatibilityWriter | undefined;
  private readonly converter: TypeConverter;

  constructor(options: TypeScriptPluginOptions) {
    this.writer = new DecafModelWriter(options.store, options.packageName);
    this.compatibility = options.compatibility
      ? new BetterDocsCompatibilityWriter(this.writer)
      : undefined;
    this.converter = new TypeConverter(this.compatibility ?? this.writer, {
      packageName: options.packageName,
      typeMode: options.typeMode,
      includeUndocumented: options.includeUndocumented,
    });
  }

  extract(context: DocsSourceContext): DocletModel[] {
    return this.converter.convertFile(context);
  }

  declarations(): Map<string, ts.Declaration> {
    return this.converter.getDeclarations();
  }

}
