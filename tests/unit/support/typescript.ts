import path from "node:path";
import ts from "typescript";
import { DocsDiagnostics } from "../../../src/generator/diagnostics";
import type {
  ConvertedDeclaration,
  ConvertedMember,
  DocletEmitter,
  DocsSourceContext,
} from "../../../src/generator/types";
import type { DocletModel } from "../../../src/models";

export const FIXTURES = path.resolve(__dirname, "../../fixtures");
export const VERTICAL_SLICE = path.join(FIXTURES, "vertical-slice/src");
export const KINDS_FIXTURE = path.join(FIXTURES, "typescript-kinds/kinds.ts");
export const SIGNALS_FIXTURE = path.join(
  FIXTURES,
  "angular-signals/signals.component.ts"
);

export const COMPILER_OPTIONS: ts.CompilerOptions = {
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

export function createProgram(
  files: readonly string[],
  options: ts.CompilerOptions = {}
): ts.Program {
  return ts.createProgram([...files], {
    ...COMPILER_OPTIONS,
    ...options,
  });
}

export function contextFor(
  program: ts.Program,
  filename: string,
  diagnostics = new DocsDiagnostics()
): DocsSourceContext {
  const sourceFile = program.getSourceFile(filename);
  if (!sourceFile) throw new Error(`Program does not contain ${filename}`);
  return {
    filename,
    source: sourceFile.getFullText(),
    sourceFile,
    program,
    checker: program.getTypeChecker(),
    rootNames: program.getRootFileNames(),
    diagnostics,
  };
}

export function contextForFile(
  filename: string,
  options: ts.CompilerOptions = {},
  diagnostics = new DocsDiagnostics()
): DocsSourceContext {
  const program = createProgram([filename], options);
  return contextFor(program, filename, diagnostics);
}

export function sourceFileOf(
  source: string,
  filename = "fixture.ts"
): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

export interface CapturedEmitter {
  emitter: DocletEmitter;
  declarations: ConvertedDeclaration[];
  members: ConvertedMember[];
}

export function capturingEmitter(): CapturedEmitter {
  const declarations: ConvertedDeclaration[] = [];
  const members: ConvertedMember[] = [];
  const fake = (): DocletModel => ({ uid: "doclet:captured" }) as DocletModel;
  return {
    declarations,
    members,
    emitter: {
      emitDeclaration(declaration) {
        declarations.push(declaration);
        return fake();
      },
      emitMember(_declaration, member) {
        members.push(member);
        return fake();
      },
    },
  };
}
