import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { DocletModel, DocTagModel } from "../../models";
import type { GeneratedDocsStore } from "../store";
import { GeneratedDocsStore as Store } from "../store";
import type {
  ComponentExtractor,
  DecafDocsPlugin,
  DocsSourceContext,
} from "../types";
import { DocsBuildError, DocsDiagnostics } from "../diagnostics";
import { CategoryPlugin } from "../betterdocs/CategoryPlugin";
import { ComponentPlugin } from "../betterdocs/ComponentPlugin";
import { ImportTypePlugin } from "../betterdocs/ImportTypePlugin";
import { LoadPlugin } from "../betterdocs/LoadPlugin";
import { TypeScriptPlugin } from "../betterdocs/typescript/TypeScriptPlugin";
import { AngularComponentExtractor } from "../extractors/AngularComponentExtractor";
import { commonDirectory } from "../paths";

/**
 * @description Options for running the documentation plugin pipeline.
 * @summary Configures the project identity stamped onto emitted doclets, the
 * root file names (files or directories) documented by the build, optional
 * compiler options merged over sensible defaults, extra plugins and component
 * extractors, the `@load` allowed roots, type rendering mode, whether
 * undocumented symbols are emitted, and whether BetterDocs compatibility
 * capture is enabled.
 */
export interface DocsPipelineOptions {
  project: { name: string; version: string };
  rootNames: readonly string[];
  compilerOptions?: ts.CompilerOptions;
  plugins?: readonly DecafDocsPlugin[];
  componentExtractors?: readonly ComponentExtractor[];
  allowedRoots?: readonly string[];
  typeMode?: "betterdocs" | "native";
  includeUndocumented?: boolean;
  compatibility?: boolean;
}

/**
 * @description Output of a successful pipeline run.
 * @summary Exposes the filled `GeneratedDocsStore` (also queried for the
 * final doclet list), the collected diagnostics (guaranteed error-free after a
 * successful run), the shared `ts.Program`, and the TypeScript plugin whose
 * converter holds the longname-to-declaration mapping.
 */
export interface DocsPipelineResult {
  store: GeneratedDocsStore;
  doclets: DocletModel[];
  diagnostics: DocsDiagnostics;
  program: ts.Program;
  typeScript: TypeScriptPlugin;
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  skipLibCheck: true,
  strict: false,
  noEmit: true,
  allowJs: true,
  jsx: ts.JsxEmit.Preserve,
  types: [],
};

function collectFiles(rootNames: readonly string[]): string[] {
  const files: string[] = [];
  for (const rootName of rootNames) {
    const resolved = path.resolve(rootName);
    if (!fs.existsSync(resolved))
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_SOURCE_MISSING",
          message: `Documented source does not exist: ${rootName}`,
        },
      ]);
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
        const child = path.join(resolved, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles([child]));
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
          files.push(child);
      }
    } else if (/\.tsx?$/.test(path.basename(resolved))) {
      files.push(resolved);
    }
  }
  return [...new Set(files)].sort();
}


function syntacticDiagnostics(
  program: ts.Program,
  diagnostics: DocsDiagnostics
): void {
  for (const diagnostic of program.getSyntacticDiagnostics()) {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n"
    );
    const location =
      diagnostic.file && diagnostic.start !== undefined
        ? (() => {
            const position =
              diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
            return {
              fileName: diagnostic.file.fileName,
              line: position.line + 1,
              column: position.character + 1,
            };
          })()
        : undefined;
    diagnostics.error(
      `DOCAF_TS_${diagnostic.code}`,
      message,
      location
    );
  }
}

/**
 * The plugin lifecycle pipeline. A single `ts.Program` and `ts.TypeChecker`
 * are shared by every source and every plugin for the whole build.
 */
export class DocsPipeline {
  private readonly options: DocsPipelineOptions;

  constructor(options: DocsPipelineOptions) {
    this.options = options;
  }

  async run(): Promise<DocsPipelineResult> {
    const diagnostics = new DocsDiagnostics();
    const store = new Store();
    const files = collectFiles(this.options.rootNames);
    if (!files.length)
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_NO_SOURCES",
          message: "No TypeScript sources matched the documented roots",
        },
      ]);
    const program = ts.createProgram(files, {
      ...DEFAULT_COMPILER_OPTIONS,
      ...(this.options.compilerOptions ?? {}),
    });
    const checker = program.getTypeChecker();
    syntacticDiagnostics(program, diagnostics);

    const resolveTags = (doclet: DocletModel): readonly DocTagModel[] =>
      store
        .get<DocTagModel>("tags")
        .filter((tag) => tag.ownerUid === doclet.uid);

    const typeMode =
      this.options.typeMode ??
      (this.options.compatibility ? "betterdocs" : "native");
    const typeScript = new TypeScriptPlugin({
      packageName: this.options.project.name,
      store,
      typeMode,
      includeUndocumented: this.options.includeUndocumented,
      compatibility: this.options.compatibility,
    });

    const extractors: ComponentExtractor[] = [
      ...(this.options.componentExtractors ?? []),
      new AngularComponentExtractor(),
    ];

    const allowedRoots = this.options.allowedRoots
      ? [...this.options.allowedRoots]
      : [commonDirectory(files)];

    const plugins: DecafDocsPlugin[] = [
      new CategoryPlugin(resolveTags),
      new ComponentPlugin({ store, extractors, resolveTags }),
      new ImportTypePlugin({
        mode: typeMode === "betterdocs" ? "compat" : "native",
      }),
      new LoadPlugin({ allowedRoots, resolveTags }),
      ...(this.options.plugins ?? []),
    ];

    const contexts: DocsSourceContext[] = files.map((filename) => {
      const sourceFile =
        program.getSourceFile(filename) ??
        ts.createSourceFile(
          filename,
          fs.readFileSync(filename, "utf8"),
          ts.ScriptTarget.Latest,
          true
        );
      return {
        filename,
        source: sourceFile.getFullText(),
        sourceFile,
        program,
        checker,
        rootNames: files,
        diagnostics,
        declarations: typeScript.declarations(),
      };
    });

    for (const context of contexts) {
      for (const plugin of plugins) {
        if (plugin.beforeParse) await plugin.beforeParse(context);
      }
      if (context.source !== context.sourceFile.getFullText()) {
        context.sourceFile = ts.createSourceFile(
          context.filename,
          context.source,
          ts.ScriptTarget.Latest,
          true
        );
      }
    }

    const doclets: DocletModel[] = [];
    for (const context of contexts) {
      const extracted = typeScript.extract(context);
      doclets.push(...extracted);
      context.declarations = typeScript.declarations();
      for (const doclet of extracted) {
        for (const plugin of plugins) {
          if (plugin.newDoclet) await plugin.newDoclet(doclet, context);
        }
      }
    }

    const projectContext = {
      doclets: store.get<DocletModel>("doclets"),
      declarations: typeScript.declarations(),
      diagnostics,
      rootNames: files,
    };
    for (const plugin of plugins) {
      if (plugin.afterParse) await plugin.afterParse(projectContext);
    }

    if (diagnostics.hasErrors) throw new DocsBuildError(diagnostics.all);

    return {
      store,
      doclets: store.get<DocletModel>("doclets"),
      diagnostics,
      program,
      typeScript,
    };
  }
}
