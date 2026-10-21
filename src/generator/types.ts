import type ts from "typescript";
import type {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPropertyModel,
  DocletModel,
} from "../models";
import type { DocsDiagnostics } from "./diagnostics";

/**
 * @description Context handed to every plugin for a single parsed source file.
 * @summary The same `ts.Program` and `ts.TypeChecker` instance is shared by every
 * source file of a build; plugins must never create their own program.
 * @interface DocsSourceContext
 */
export interface DocsSourceContext {
  filename: string;
  source: string;
  sourceFile: ts.SourceFile;
  program: ts.Program;
  checker: ts.TypeChecker;
  rootNames: readonly string[];
  diagnostics: DocsDiagnostics;
  declarations?: Map<string, ts.Declaration>;
}

/**
 * @description Project wide context handed to `afterParse` hooks.
 * @summary Exposes the doclets produced by the run, the declarations map
 * shared across the pipeline, the build diagnostics sink, and the root file
 * names of the program.
 * @interface DocsPluginContext
 */
export interface DocsPluginContext {
  doclets: DocletModel[];
  declarations: Map<string, ts.Declaration>;
  diagnostics: DocsDiagnostics;
  rootNames: readonly string[];
}

/**
 * @description Lifecycle contract preserved from BetterDocs/JSDoc.
 * @summary A docs plugin optionally hooks `beforeParse` (per source file),
 * `newDoclet` (per emitted doclet), and `afterParse` (once per run with the
 * full doclet list). All hooks may be async.
 * @interface DecafDocsPlugin
 */
export interface DecafDocsPlugin {
  readonly name: string;

  beforeParse?(source: DocsSourceContext): void | Promise<void>;

  newDoclet?(
    doclet: DocletModel,
    source: DocsSourceContext
  ): void | Promise<void>;

  afterParse?(context: DocsPluginContext): void | Promise<void>;
}

/**
 * @description Raw metadata describing a component input/property.
 * @summary Carries the pre-persistence shape of a component property as
 * produced by an extractor: its name, optional kind/alias/type text,
 * optionality flags, default value and documentation description. Extractors
 * convert this into `DocComponentPropertyModel` records.
 */
export interface ComponentPropertyMetadata {
  name: string;
  kind?: string;
  alias?: string;
  typeText?: string;
  optional?: boolean;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description Raw metadata describing a component output/event.
 * @summary Carries the pre-persistence shape of a component event as produced
 * by an extractor: its name, optional type and payload type texts, and its
 * documentation description. Extractors convert this into
 * `DocComponentEventModel` records.
 */
export interface ComponentEventMetadata {
  name: string;
  typeText?: string;
  payloadTypeText?: string;
  description?: string;
}

/**
 * @description Structured result of a component extractor run.
 * @summary Holds everything learned about one `@component`-decorated class:
 * the owning framework, component/export names, source file and selector, the
 * extracted property and event models, the optional component model itself,
 * and per-declaration source locations for the component, its properties and
 * its events.
 */
export interface ComponentExtraction {
  framework: string;
  name: string;
  exportName: string;
  sourceFile: string;
  selector?: string;
  standalone?: boolean;
  properties: DocComponentPropertyModel[];
  events: DocComponentEventModel[];
  component?: DocComponentModel;
  location?: SourceLocation;
  propertyLocations?: Record<string, SourceLocation>;
  eventLocations?: Record<string, SourceLocation>;
}

/**
 * @description Extractor contract for component frameworks.
 * @summary A future React extractor only needs to implement this
 * interface and be registered; the publisher never changes. `supports`
 * decides whether an extractor handles a declaration, `extract` produces the
 * structured {@link ComponentExtraction}.
 * @interface ComponentExtractor
 */
export interface ComponentExtractor {
  readonly framework: string;

  supports(
    declaration: ts.Declaration,
    context: DocsSourceContext
  ): boolean;

  extract(
    declaration: ts.Declaration,
    context: DocsSourceContext
  ): Promise<ComponentExtraction>;
}

/**
 * @description One-based source position of a documented symbol.
 * @summary Identifies the file, line and column (both 1-based) where a
 * declaration, diagnostic or component element originates; used by diagnostic
 * reporting and stored on extracted models.
 */
export interface SourceLocation {
  fileName: string;
  line: number;
  column: number;
}

/**
 * @description A JSDoc tag converted from a TypeScript AST node.
 * @summary Doclet-shaped record mirroring a JSDoc tag: its `title` (tag name),
 * the normalized `value` (built from type/name/comment for `@param`/`@return`,
 * or the tag comment otherwise), the pre-normalization `originalValue`, a
 * `kind` discriminator (e.g. `param`, `return`, or the tag title), and the
 * raw tag `comment`.
 */
export interface ConvertedTag {
  title: string;
  value?: string;
  originalValue?: string;
  kind?: string;
  comment?: string;
}

/**
 * @description An `@example` tag split into caption and code.
 * @summary Doclet-shaped record for examples: the fenced code body, an
 * optional caption parsed from `<caption>...</caption>` markup, and an
 * optional language hint for syntax highlighting.
 */
export interface ConvertedExample {
  caption?: string;
  code: string;
  language?: string;
}

/**
 * @description A parameter converted from a TypeScript declaration.
 * @summary Doclet-shaped record for a function/method parameter: its name,
 * rendered type text, whether it is optional, whether it is a rest parameter,
 * and optional default value and description taken from the parameter's JSDoc.
 */
export interface ConvertedParameter {
  name: string;
  typeText: string;
  optional: boolean;
  rest: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description A type-literal member converted from a TypeScript type node.
 * @summary Doclet-shaped record for an `@property`-style entry on typedefs and
 * interfaces: the (dotted, for nested members) name, rendered type text,
 * optionality, and the member's description from its JSDoc.
 */
export interface ConvertedProperty {
  name: string;
  typeText: string;
  optional: boolean;
  description?: string;
}

/**
 * @description The doclet kinds a top-level declaration can convert to.
 * @summary Enumerates the `kind` values the type converter assigns to
 * declarations: `class`, `interface`, `function`, `typedef`, `enum` and
 * `module`.
 * @memberOf module:docaf
 */
export type ConvertedDeclarationKind =
  | "class"
  | "interface"
  | "function"
  | "typedef"
  | "enum"
  | "module"
  | "namespace";

/**
 * @description The doclet kinds a class/interface/enum member can convert to.
 * @summary Enumerates the `kind` values the type converter assigns to members:
 * `function` (methods), `member` (fields and enum members), `constructor` and
 * `accessor`.
 * @memberOf module:docaf
 */
export type ConvertedMemberKind =
  | "function"
  | "member"
  | "constructor"
  | "accessor";

/**
 * @description Doclet-shaped conversion of a top-level TypeScript declaration.
 * @summary The intermediate record produced by the type converter for
 * classes, interfaces, functions, typedefs, enums and modules: identity
 * (name, longname, kind), documentation (description, classdesc, tags,
 * examples), signature data (parameters, properties, return type, inheritance
 * and implementation lists), flags (access, readonly, abstract, async,
 * virtual, deprecated), ordering metadata, source location, the synthetic
 * BetterDocs-style JSDoc comment retained for parity, and the raw modifier and
 * decorator texts. Consumed by `DocletEmitter` implementations.
 */
export interface ConvertedDeclaration {
  name: string;
  longname: string;
  kind: ConvertedDeclarationKind;
  description?: string;
  classdesc?: string;
  access?: string;
  readonly?: boolean;
  abstract?: boolean;
  async?: boolean;
  virtual?: boolean;
  deprecated?: boolean;
  since?: string;
  version?: string;
  optional?: boolean;
  type?: string;
  order: number;
  exportName?: string;
  tags: ConvertedTag[];
  examples: ConvertedExample[];
  parameters: ConvertedParameter[];
  properties: ConvertedProperty[];
  returnType?: string;
  augments: string[];
  implementsList: string[];
  location?: SourceLocation;
  syntheticComment: string;
  modifiers: string[];
  decorators: string[];
}

/**
 * @description Emission contract turning converted declarations into doclet
 * models.
 * @summary Implemented by the production `DecafModelWriter` (which registers
 * models in the `GeneratedDocsStore`) and, in compatibility runs, by the
 * `BetterDocsCompatibilityWriter`. The type converter calls `emitDeclaration`
 * once per top-level declaration and `emitMember` for each of its members,
 * passing the owning declaration's model as `owner`.
 */
export interface DocletEmitter {
  emitDeclaration(
    declaration: ConvertedDeclaration,
    source: DocsSourceContext
  ): DocletModel;

  emitMember(
    declaration: ConvertedDeclaration,
    member: ConvertedMember,
    owner: DocletModel,
    source: DocsSourceContext
  ): DocletModel;
}

/**
 * @description Doclet-shaped conversion of a class/interface/enum member.
 * @summary The intermediate record produced by the type converter for methods,
 * fields, constructors, accessors and enum members: identity (name, longname,
 * kind), documentation (description, tags, examples), signature data
 * (parameters, properties, return type, default value), flags (access,
 * readonly, abstract, async, virtual, static, optional), ordering metadata,
 * source location, the synthetic BetterDocs-style JSDoc comment retained for
 * parity, and the raw modifier and decorator texts.
 */
export interface ConvertedMember {
  name: string;
  longname: string;
  kind: ConvertedMemberKind;
  description?: string;
  access?: string;
  readonly?: boolean;
  abstract?: boolean;
  async?: boolean;
  virtual?: boolean;
  static?: boolean;
  optional?: boolean;
  type?: string;
  order: number;
  tags: ConvertedTag[];
  examples: ConvertedExample[];
  parameters: ConvertedParameter[];
  properties: ConvertedProperty[];
  returnType?: string;
  defaultValue?: string;
  location?: SourceLocation;
  syntheticComment: string;
  modifiers: string[];
  decorators: string[];
}
