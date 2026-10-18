import type { DocletModel } from "../../models";
import type {
  ConvertedDeclaration,
  ConvertedExample,
  ConvertedMember,
  ConvertedProperty,
  ConvertedTag,
  DocletEmitter,
  DocsSourceContext,
} from "../types";

/**
 * @description Legacy doclet shape of a function parameter.
 * @summary Mirrors JSDoc's `params` entries as BetterDocs produced them:
 * name, rendered type, optionality, rest-parameter flag (`variable`),
 * description and JSDoc-style `defaultvalue`.
 */
export interface LegacyParameter {
  name: string;
  type: string;
  optional: boolean;
  variable?: boolean;
  description?: string;
  defaultvalue?: string;
}

/**
 * @description Legacy doclet shape of a return value.
 * @summary Mirrors JSDoc's `returns` entries as BetterDocs produced them: the
 * rendered return type and an optional description.
 */
export interface LegacyReturn {
  type: string;
  description?: string;
}

/**
 * @description Legacy doclet shape of a JSDoc tag.
 * @summary Structurally identical to `ConvertedTag`; kept as a separate alias
 * so the captured doclets preserve the exact legacy field set (title, value,
 * originalValue, kind, comment) for parity fixtures.
 */
export interface LegacyTag {
  title: string;
  value?: string;
  originalValue?: string;
  kind?: string;
  comment?: string;
}

/**
 * @description Legacy doclet shape of an `@example` entry.
 * @summary Mirrors JSDoc's `examples` entries: a required caption (empty
 * string when the source example has none) and the code body.
 */
export interface LegacyExample {
  caption: string;
  code: string;
}

/**
 * @description A captured doclet in the historical BetterDocs/JSDoc shape.
 * @summary The parity record produced by the compatibility writer for every
 * declaration and member: identity fields (name, longname, kind, memberof,
 * scope), documentation fields (description, classdesc, category,
 * subCategory), flags (access, readonly, abstract, async, virtual, deprecated,
 * optional), signature data (params, returns, properties, tags, examples),
 * JSDoc-style `meta` source location, the synthetic comment, and component and
 * signature extras added by later pipeline stages.
 */
export interface LegacyDoclet {
  name: string;
  longname: string;
  kind: string;
  memberof?: string;
  scope?: string;
  description?: string;
  classdesc?: string;
  category?: string;
  subCategory?: string;
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
  params?: LegacyParameter[];
  returns?: LegacyReturn[];
  properties?: ConvertedProperty[];
  tags: LegacyTag[];
  examples: LegacyExample[];
  meta?: {
    filename: string;
    path: string;
    lineno: number;
    columnno: number;
  };
  undocumented?: boolean;
  syntheticComment?: string;
  component?: { type: string; displayName: string; filePath?: string };
  signature?: string;
  attributes?: string[];
}

function tagsOf(tags: readonly ConvertedTag[]): LegacyTag[] {
  return tags.map((tag) => ({
    title: tag.title,
    value: tag.value,
    originalValue: tag.originalValue ?? tag.value,
    kind: tag.kind ?? tag.title,
    comment: tag.comment,
  }));
}

function examplesOf(examples: readonly ConvertedExample[]): LegacyExample[] {
  return examples.map((example) => ({
    caption: example.caption ?? "",
    code: example.code,
  }));
}

function legacyCategory(tags: readonly LegacyTag[], title: string) {
  return tags.find((tag) => tag.title === title)?.value;
}

function build(
  name: string,
  longname: string,
  kind: string,
  declaration: ConvertedDeclaration,
  specific: Partial<LegacyDoclet> = {}
): LegacyDoclet {
  const tags = tagsOf(declaration.tags);
  const location = declaration.location;
  return {
    name,
    longname,
    kind,
    description: declaration.description,
    classdesc: declaration.classdesc,
    category: legacyCategory(tags, "category"),
    subCategory: legacyCategory(tags, "subcategory"),
    access: declaration.access,
    readonly: declaration.readonly,
    abstract: declaration.abstract,
    async: declaration.async,
    virtual: declaration.virtual,
    deprecated: declaration.deprecated,
    since: declaration.since,
    version: declaration.version,
    optional: declaration.optional,
    type: declaration.type,
    params: declaration.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.typeText,
      optional: parameter.optional,
      variable: parameter.rest,
      description: parameter.description,
      defaultvalue: parameter.defaultValue,
    })),
    returns: declaration.returnType
      ? [{ type: declaration.returnType }]
      : undefined,
    properties: declaration.properties,
    tags,
    examples: examplesOf(declaration.examples),
    meta: location
      ? {
          filename: location.fileName,
          path: location.fileName,
          lineno: location.line,
          columnno: location.column,
        }
      : undefined,
    syntheticComment: declaration.syntheticComment,
    ...specific,
  };
}

/**
 * Parity-only emitter. It records BetterDocs-shaped metadata while the same
 * conversion feeds the production `DecafModelWriter`.
 */
export class BetterDocsCompatibilityWriter implements DocletEmitter {
  readonly doclets: LegacyDoclet[] = [];

  constructor(private readonly inner: DocletEmitter) {}

  emitDeclaration(
    declaration: ConvertedDeclaration,
    source: DocsSourceContext
  ): DocletModel {
    const kind =
      declaration.kind === "class"
        ? "class"
        : declaration.kind === "interface"
          ? "interface"
          : declaration.kind === "typedef"
            ? "typedef"
            : declaration.kind === "function"
              ? "function"
              : declaration.kind;
    this.doclets.push(
      build(declaration.name, declaration.longname, kind, declaration)
    );
    return this.inner.emitDeclaration(declaration, source);
  }

  emitMember(
    declaration: ConvertedDeclaration,
    member: ConvertedMember,
    owner: DocletModel,
    source: DocsSourceContext
  ): DocletModel {
    const kind =
      member.kind === "constructor"
        ? "constructor"
        : member.kind === "function"
          ? "function"
          : "member";
    this.doclets.push(
      build(member.name, member.longname, kind, declaration, {
        memberof: declaration.longname,
        scope: member.static ? "static" : "instance",
        description: member.description,
        classdesc: undefined,
        access: member.access ?? declaration.access,
        readonly: member.readonly ?? declaration.readonly,
        abstract: member.abstract ?? declaration.abstract,
        async: member.async ?? declaration.async,
        virtual: member.virtual ?? declaration.virtual,
        optional: member.optional,
        type: member.type,
        params: member.parameters.map((parameter) => ({
          name: parameter.name,
          type: parameter.typeText,
          optional: parameter.optional,
          variable: parameter.rest,
          description: parameter.description,
          defaultvalue: parameter.defaultValue,
        })),
        returns: member.returnType
          ? [{ type: member.returnType }]
          : undefined,
        properties: member.properties,
        tags: tagsOf(member.tags),
        examples: examplesOf(member.examples),
        syntheticComment: member.syntheticComment,
        meta: member.location
          ? {
              filename: member.location.fileName,
              path: member.location.fileName,
              lineno: member.location.line,
              columnno: member.location.column,
            }
          : undefined,
      })
    );
    return this.inner.emitMember(declaration, member, owner, source);
  }
}
