import path from "node:path";
import ts from "typescript";
import type { DocletModel } from "../../../models";
import type {
  ConvertedDeclaration,
  ConvertedExample,
  ConvertedMember,
  ConvertedParameter,
  ConvertedProperty,
  ConvertedTag,
  DocletEmitter,
  DocsSourceContext,
  SourceLocation,
} from "../../types";

/**
 * BetterDocs' synthetic comment helpers, ported from
 * `typescript/type-converter.js` at commit
 * 248ea8f0ed0eaff9eaf568554566f80454ab8cf5.
 *
 * The generated comment text is retained for:
 *  - `BetterDocsCompatibilityWriter` and the parity fixtures;
 *  - the individual helper parity tests required by TDS §5.2.
 *
 * The production path never re-parses the generated comment; the same
 * conversion result feeds `DecafModelWriter` directly.
 */
export const appendComment = (
  commentBlock: string,
  toAppend: string
): string =>
  commentBlock.replace(
    /[\n,\s]*\*\//,
    toAppend
      .split("\n")
      .map((line) => `\n * ${line}`)
      .join("") + "\n */"
  );

function getJsDoc(node: ts.Node): ts.NodeArray<ts.JSDoc> | undefined {
  return (node as unknown as { jsDoc?: ts.NodeArray<ts.JSDoc> }).jsDoc;
}

function isSimpleInlineableExpression(node: ts.Node): boolean {
  return (
    ts.isStringLiteralLike(node) ||
    node.kind === ts.SyntaxKind.NumericLiteral ||
    (node.kind >= ts.SyntaxKind.FirstKeyword &&
      node.kind <= ts.SyntaxKind.LastKeyword)
  );
}

/**
 * @description Renders a TypeScript type node into the legacy BetterDocs type
 * label.
 * @summary Returns a short name for the given type node: identifier names with
 * recursively rendered type arguments (`Map<K, V>` style), `function` for
 * function types and function-like nodes, `Array` for array types, a
 * `|`-joined union of the constituent names, `object` for type literals with
 * members, and finally the raw trimmed source slice for anything else.
 * @param {ts.Node | undefined} type - The type node to name; an empty string is
 * returned when undefined.
 * @param {string} src - The full source text used to slice unnamed types.
 * @returns {string} The human-readable type label.
 */
export const getTypeName = (type: ts.Node | undefined, src: string): string => {
  if (!type) return "";
  const node = type as ts.TypeNode & {
    typeName?: ts.EntityName;
    typeArguments?: ts.NodeArray<ts.TypeNode>;
    types?: ts.NodeArray<ts.Node>;
    members?: ts.NodeArray<ts.Node>;
  };
  if (node.typeName && ts.isIdentifier(node.typeName)) {
    const typeName = String(node.typeName.escapedText);
    if (node.typeArguments && node.typeArguments.length) {
      const args = node.typeArguments
        .map((subType) => getTypeName(subType, src))
        .join(", ");
      return `${typeName}<${args}>`;
    }
    return typeName;
  }
  if (ts.isFunctionTypeNode(node as ts.TypeNode) || ts.isFunctionLike(node))
    return "function";
  if (ts.isArrayTypeNode(node as ts.TypeNode)) return "Array";
  if (node.types) {
    return node.types.map((subType) => getTypeName(subType, src)).join(" | ");
  }
  if (node.members && node.members.length) return "object";
  return src.substring(node.pos, node.end).trim();
};

/**
 * @description Extracts a display name for a node, mirroring BetterDocs'
 * `getName` helper.
 * @summary Reads the node's `name` identifier when present; otherwise, for
 * callable nodes without a name, renders the parameter list as the name
 * (index signature style). The special `key: string` index-signature name is
 * collapsed to `{...}`. Returns an empty string when neither applies.
 * @param {ts.Node} node - The declaration node whose name is wanted.
 * @param {string} src - The full source text used to slice unnamed callables.
 * @returns {string} The extracted name, or an empty string when none exists.
 */
export const getName = (node: ts.Node, src: string): string => {
  const named = node as ts.Node & {
    name?: ts.Identifier | ts.StringLiteral;
    parameters?: ts.NodeArray<ts.ParameterDeclaration>;
  };
  const name =
    (named.name as ts.Identifier | undefined)?.escapedText ??
    (named.parameters
      ? src.substring(named.parameters.pos, named.parameters.end)
      : undefined);
  if (name === "key: string") return "{...}";
  return String(name ?? "");
};

/**
 * @description Flattens a node's first JSDoc comment into plain text.
 * @summary Returns the comment of the first JSDoc block attached to the node.
 * String comments are returned as-is; multi-part (node array) comments join
 * their string parts, substituting the raw source slice for empty link/text
 * nodes. Returns an empty string when the node has no JSDoc comment.
 * @param {ts.Node} member - The node carrying the JSDoc comment.
 * @param {string} src - The full source text used as fallback for node parts.
 * @returns {string} The comment text, or an empty string when absent.
 */
export const getCommentAsString = (member: ts.Node, src: string): string => {
  const jsDoc = getJsDoc(member);
  if (jsDoc && jsDoc[0] && jsDoc[0].comment !== undefined) {
    const comment = jsDoc[0].comment;
    if (Array.isArray(comment)) {
      return comment
        .map((part) =>
          typeof part === "string"
            ? part
            : part.text.length
              ? part.text
              : src.substring(part.pos, part.end)
        )
        .join("");
    }
    return String(comment);
  }
  return "";
};

/**
 * @description Appends `@param` entries for a callable node's parameters.
 * @summary Walks the parameter declarations of the node (or of its function
 * type annotation) and appends one synthetic `@param {type} name comment` line
 * to the given JSDoc text for each parameter, bracketing optional parameter
 * names with `[` and `]`.
 * @param {string} jsDoc - The comment text to extend; defaults to empty.
 * @param {ts.Node} node - The callable or property carrying the parameters.
 * @param {string} src - The full source text used for name and type extraction.
 * @returns {string} The comment text with the appended `@param` lines.
 */
export const convertParams = (
  jsDoc = "",
  node: ts.Node,
  src: string
): string => {
  const callable = node as ts.Node & {
    type?: ts.FunctionTypeNode;
    parameters?: ts.NodeArray<ts.ParameterDeclaration>;
  };
  const parameters = callable.type?.parameters || callable.parameters;
  if (!parameters) return jsDoc;
  parameters.forEach((parameter) => {
    let name = getName(parameter, src);
    const comment = getCommentAsString(parameter, src);
    if (parameter.questionToken) name = ["[", name, "]"].join("");
    const type = getTypeName(parameter.type, src);
    jsDoc = appendComment(
      jsDoc,
      `@param {${type}} ${name}   ${comment}`
    );
  });
  return jsDoc;
};

/**
 * @description Appends `@property` entries for the members of an object type.
 * @summary Recursively walks type literals, array element types (both
 * `T[]` and `Array<T>` forms) and union constituents, emitting one synthetic
 * `@property {type} name comment` line per type element. Nested members are
 * prefixed with the dotted parent name, optional members are bracketed, and
 * type literals with nested members are labeled `object`.
 * @param {string} jsDoc - The comment text to extend; defaults to empty.
 * @param {ts.Node | undefined} type - The type node whose members are walked;
 * a falsy value returns the input unchanged.
 * @param {string} src - The full source text used for name and type extraction.
 * @param {string | null} parentName - Dotted prefix for nested member names;
 * defaults to null for top-level members.
 * @returns {string} The comment text with the appended `@property` lines.
 */
export const convertMembers = (
  jsDoc = "",
  type: ts.Node | undefined,
  src: string,
  parentName: string | null = null
): string => {
  if (!type) return jsDoc;
  const node = type as ts.TypeNode & {
    types?: ts.NodeArray<ts.TypeNode>;
    typeName?: ts.EntityName;
    typeArguments?: ts.NodeArray<ts.TypeNode>;
    members?: ts.NodeArray<ts.TypeElement>;
    elementType?: ts.TypeNode;
  };
  const typesToCheck: ts.Node[] = [type];
  if (node.types && node.types.length) typesToCheck.push(...node.types);
  typesToCheck.forEach((candidate) => {
    const current = candidate as typeof node;
    if (ts.isArrayTypeNode(candidate) && current.elementType) {
      jsDoc = convertMembers(
        jsDoc,
        current.elementType,
        src,
        parentName ? `${parentName}[]` : "[]"
      );
    }
    if (
      current.typeName &&
      ts.isIdentifier(current.typeName) &&
      current.typeName.escapedText === "Array" &&
      current.typeArguments?.length
    ) {
      current.typeArguments.forEach((subType) => {
        jsDoc = convertMembers(
          jsDoc,
          subType,
          src,
          parentName ? `${parentName}[]` : ""
        );
      });
    }
    (current.members || [])
      .filter((member) => ts.isTypeElement(member))
      .forEach((member) => {
        const element = member as ts.TypeElement & {
          name?: ts.Node;
          type?: ts.TypeNode;
          questionToken?: ts.QuestionToken;
        };
        let name = getName(member, src);
        const comment = getCommentAsString(member, src);
        const members = element.type
          ? ((element.type as ts.TypeLiteralNode).members || [])
          : [];
        const typeName = members.length
          ? "object"
          : getTypeName(element.type, src);
        if (parentName) name = [parentName, name].join(".");
        const nameToPlace = element.questionToken ? `[${name}]` : name;
        jsDoc = appendComment(
          jsDoc,
          `@property {${typeName}} ${nameToPlace}   ${comment}`
        );
        jsDoc = convertMembers(jsDoc, element.type, src, name);
      });
  });
  return jsDoc;
};

/**
 * @description Completes a member comment with synthetic method tags.
 * @summary Ensures the comment carries `@method`, fills in `@param` lines from
 * the member's parameters when none are present, appends `@property` lines for
 * array return types, and appends a `@return {type}` line when the member has
 * a return type that is not yet documented.
 * @param {string} comment - The member's current comment text.
 * @param {ts.Node} member - The member node carrying parameters and a type.
 * @param {string} src - The full source text used for name and type extraction.
 * @returns {string} The completed comment text.
 */
export const fillMethodComment = (
  comment: string,
  member: ts.Node,
  src: string
): string => {
  if (!comment.includes("@method")) comment = appendComment(comment, "@method");
  if (!comment.includes("@param"))
    comment = convertParams(comment, member, src);
  const typed = member as ts.Node & { type?: ts.TypeNode };
  if (typed.type && ts.isArrayTypeNode(typed.type))
    comment = convertMembers(comment, typed.type, src);
  if (typed.type && !comment.includes("@return")) {
    const returnType = getTypeName(typed.type, src);
    comment = appendComment(comment, `@return {${returnType}}`);
  }
  return comment;
};

function parseExample(value: string): ConvertedExample {
  const match = value.match(
    /^\s*<caption>([\s\S]+?)<\/caption>(\s*[\n\r])([\s\S]+)$/i
  );
  if (match) return { caption: match[1], code: match[3] };
  return { code: value };
}

function tagComment(tag: ts.JSDocTag): string {
  const comment = (tag as ts.JSDocTag & { comment?: unknown }).comment;
  if (comment === undefined) return "";
  if (typeof comment === "string") return comment;
  const rendered = ts.getTextOfJSDocComment(
    comment as ts.NodeArray<ts.JSDocComment>
  );
  return rendered ?? "";
}

/**
 * @description Converts the JSDoc tags attached to a node into converted tag
 * records.
 * @summary Reads every JSDoc tag reachable from the node via the compiler API
 * and maps it to a `ConvertedTag`: parameter tags keep the parameter name as
 * `originalValue` and build a `@param`-shaped value from type, name and
 * comment; return tags carry the type expression in braces; all other tags use
 * the tag's own comment when present, falling back to the raw text after the
 * tag name. The `source` argument is unused and accepted for signature parity.
 * @param {ts.Node} node - The node whose JSDoc tags are converted.
 * @param {string} [source] - Unused source text kept for API compatibility.
 * @returns {ConvertedTag[]} One converted tag per JSDoc tag, in document order.
 */
export function parseJsDocTags(
  node: ts.Node,
  source?: string
): ConvertedTag[] {
  void source;
  const tags = ts.getJSDocTags(node);
  return tags.map((tag) => {
    const title = tag.tagName.text;
    const parameter = tag as ts.JSDocParameterTag;
    if (ts.isJSDocParameterTag(tag)) {
      const name = parameter.name.getText();
      const type = parameter.typeExpression?.type.getText();
      const comment = tagComment(tag);
      return {
        title,
        value: [type ? `{${type}}` : "", name, comment]
          .filter((part) => part.length > 0)
          .join(" "),
        originalValue: name,
        kind: "param",
        comment,
      };
    }
    if (ts.isJSDocReturnTag(tag)) {
      const type = tag.typeExpression?.type.getText();
      return {
        title,
        value: type ? `{${type}}` : "",
        kind: "return",
        comment: tagComment(tag),
      };
    }
    const raw = tag.getText();
    const fallback = raw
      .replace(new RegExp(`^@${title}\\s*`), "")
      .replace(/\*\/\s*$/, "")
      .trim();
    const comment = tagComment(tag);
    const value = comment || fallback;
    return {
      title,
      value,
      originalValue: value,
      kind: title,
      comment,
    };
  });
}

function modifierTexts(node: ts.Node): string[] {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node) ?? []
    : [];
  return modifiers.map((modifier) => modifier.getText());
}

function decoratorTexts(node: ts.Node): string[] {
  const decorators = ts.canHaveDecorators(node)
    ? ts.getDecorators(node) ?? []
    : [];
  return decorators.map((decorator) =>
    decorator.expression.getText()
  );
}

function accessOf(modifiers: readonly string[]): string | undefined {
  return modifiers.find((modifier) =>
    ["public", "private", "protected"].includes(modifier)
  );
}

function locationOf(
  node: ts.Node,
  context: DocsSourceContext
): SourceLocation | undefined {
  if (!node || node.pos < 0) return undefined;
  const start = node.getStart(context.sourceFile);
  const position = context.sourceFile.getLineAndCharacterOfPosition(start);
  return {
    fileName: context.filename,
    line: position.line + 1,
    column: position.character + 1,
  };
}

function memberOfTag(
  tags: readonly ConvertedTag[],
  title: string
): ConvertedTag | undefined {
  return tags.find((tag) => tag.title === title);
}

function hasTag(tags: readonly ConvertedTag[], title: string): boolean {
  return tags.some((tag) => tag.title === title);
}

function collectExamples(tags: readonly ConvertedTag[]): ConvertedExample[] {
  return tags
    .filter((tag) => tag.title === "example")
    .map((tag) => parseExample(tag.value ?? ""));
}

function collectProperties(
  type: ts.TypeNode | undefined,
  source: string,
  context: DocsSourceContext,
  native: boolean,
  parentName: string | null = null
): ConvertedProperty[] {
  if (!type) return [];
  const result: ConvertedProperty[] = [];
  const node = type as ts.TypeNode & {
    types?: ts.NodeArray<ts.TypeNode>;
    typeName?: ts.EntityName;
    typeArguments?: ts.NodeArray<ts.TypeNode>;
    members?: ts.NodeArray<ts.TypeElement>;
    elementType?: ts.TypeNode;
  };
  if (ts.isArrayTypeNode(type) && node.elementType) {
    result.push(
      ...collectProperties(
        node.elementType,
        source,
        context,
        native,
        parentName ? `${parentName}[]` : "[]"
      )
    );
  }
  if (
    node.typeName &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.escapedText === "Array" &&
    node.typeArguments?.length
  ) {
    node.typeArguments.forEach((argument) => {
      result.push(
        ...collectProperties(
          argument,
          source,
          context,
          native,
          parentName ? `${parentName}[]` : ""
        )
      );
    });
  }
  if (node.types?.length) {
    node.types.forEach((candidate) => {
      result.push(
        ...collectProperties(candidate, source, context, native, parentName)
      );
    });
  }
  (node.members || [])
    .filter((member) => ts.isTypeElement(member))
    .forEach((member) => {
      const element = member as ts.TypeElement & {
        name?: ts.Node;
        type?: ts.TypeNode;
        questionToken?: ts.QuestionToken;
        jsDoc?: ts.NodeArray<ts.JSDoc>;
      };
      let name = getName(member, source);
      if (parentName) name = `${parentName}.${name}`;
      const nested = element.type as ts.TypeLiteralNode | undefined;
      const nestedMembers =
        nested && ts.isTypeLiteralNode(nested) ? nested.members : undefined;
      result.push({
        name,
        typeText: nestedMembers?.length
          ? "object"
          : thisTypeText(element.type, source, context, native),
        optional: Boolean(element.questionToken),
        description: getCommentAsString(member, source),
      });
      result.push(
        ...collectProperties(
          element.type,
          source,
          context,
          native,
          name
        )
      );
    });
  return result;
}

function thisTypeText(
  type: ts.TypeNode | undefined,
  source: string,
  context: DocsSourceContext,
  native: boolean
): string {
  if (!type) return "";
  if (native) return type.getText(context.sourceFile);
  const legacy = getTypeName(type, source);
  return legacy;
}

function parameterDefaults(
  parameter: ts.ParameterDeclaration
): string | undefined {
  return parameter.initializer ? parameter.initializer.getText() : undefined;
}

function nativeTypeText(
  node: ts.Node | undefined,
  context: DocsSourceContext
): string {
  if (!node) return "";
  try {
    return context.checker.typeToString(context.checker.getTypeAtLocation(node));
  } catch {
    return node.getText(context.sourceFile);
  }
}

/**
 * @description Options accepted by the {@link TypeConverter}.
 * @summary Configures the package name assigned to converted doclets, whether
 * type texts are rendered with the legacy BetterDocs heuristic (`betterdocs`)
 * or through the shared TypeScript checker (`native`), and whether symbols
 * without JSDoc comments are still emitted.
 */
export interface TypeConverterOptions {
  /**
   * Package name recorded on every converted declaration.
   */
  packageName: string;
  /**
   * Type rendering mode; defaults to `betterdocs`.
   */
  typeMode?: "betterdocs" | "native";
  /**
   * When true, undocumented symbols are emitted as well; defaults to false.
   */
  includeUndocumented?: boolean;
}

/**
 * Ported BetterDocs TypeScript converter. One instance is shared by every
 * source file of a build, and feeds one emitter (`DecafModelWriter` in
 * production, plus `BetterDocsCompatibilityWriter` in parity runs).
 */
export class TypeConverter {
  private readonly packageName: string;
  private readonly typeMode: "betterdocs" | "native";
  private readonly includeUndocumented: boolean;
  private lastDeclaration: ConvertedDeclaration | undefined;
  private readonly declarationByLongname = new Map<string, ts.Declaration>();

  constructor(
    private readonly emitter: DocletEmitter,
    options: TypeConverterOptions
  ) {
    this.packageName = options.packageName;
    this.typeMode = options.typeMode ?? "betterdocs";
    this.includeUndocumented = options.includeUndocumented ?? false;
  }

  getDeclaration(): ConvertedDeclaration | undefined {
    return this.lastDeclaration;
  }

  getDeclarations(): Map<string, ts.Declaration> {
    return this.declarationByLongname;
  }

  private typeText(
    type: ts.TypeNode | undefined,
    context: DocsSourceContext,
    node?: ts.Node
  ): string {
    if (this.typeMode === "native")
      return (
        (type ? type.getText(context.sourceFile) : "") ||
        nativeTypeText(node, context)
      );
    return getTypeName(type, context.source);
  }

  private returnTypeText(
    member: ts.SignatureDeclarationBase,
    context: DocsSourceContext
  ): string {
    if (member.type)
      return this.typeText(member.type, context, member);
    if (this.typeMode === "native")
      return nativeTypeText(member, context);
    return "";
  }

  private parametersOf(
    member: ts.SignatureDeclarationBase,
    context: DocsSourceContext
  ): ConvertedParameter[] {
    return (member.parameters ?? []).map((parameter) => {
      const name = getName(parameter, context.source);
      const typeText = this.typeText(parameter.type, context, parameter);
      const tag = parseJsDocTags(parameter, context.source).find(
        (candidate) => candidate.title === "param"
      );
      return {
        name,
        typeText,
        optional: Boolean(parameter.questionToken || parameter.initializer),
        rest: Boolean(parameter.dotDotDotToken),
        defaultValue: parameterDefaults(parameter),
        description:
          getCommentAsString(parameter, context.source) ||
          tag?.comment ||
          "",
      };
    });
  }

  private synthesizedTags(
    node: ts.Node,
    context: DocsSourceContext,
    mode: {
      method?: boolean;
      parameterOwner?: ts.SignatureDeclarationBase;
      returnType?: string;
      properties?: readonly ConvertedProperty[];
      modifierNames?: readonly string[];
      isConstructor?: boolean;
    }
  ): ConvertedTag[] {
    const tags = parseJsDocTags(node, context.source);
    const result = [...tags];
    const add = (tag: ConvertedTag): void => {
      if (!hasTag(result, tag.title)) result.push(tag);
    };
    if (mode.isConstructor) add({ title: "constructor", kind: "constructor" });
    if (mode.method) add({ title: "method", kind: "method" });
    for (const modifier of mode.modifierNames ?? []) {
      if (
        ["async", "abstract", "private", "public", "protected"].includes(
          modifier
        )
      )
        add({ title: modifier, kind: modifier });
    }
    for (const parameter of mode.parameterOwner?.parameters ?? []) {
      const name = getName(parameter, context.source);
      const already = tags.some(
        (tag) =>
          tag.title === "param" &&
          (tag.originalValue === name ||
            (tag.value ?? "").includes(` ${name}`))
      );
      if (already) continue;
      result.push({
        title: "param",
        value: `{${this.typeText(parameter.type, context, parameter)}} ${name}`,
        originalValue: name,
        kind: "param",
        comment: getCommentAsString(parameter, context.source),
      });
    }
    if (mode.returnType && !hasTag(result, "return") && !hasTag(result, "returns"))
      result.push({
        title: "return",
        value: `{${mode.returnType}}`,
        kind: "return",
      });
    for (const property of mode.properties ?? []) {
      const already = tags.some(
        (tag) =>
          tag.title === "property" &&
          (tag.value ?? "").includes(property.name)
      );
      if (already) continue;
      result.push({
        title: "property",
        value: `{${property.typeText}} ${property.name}`,
        originalValue: property.name,
        kind: "property",
        comment: property.description,
      });
    }
    return result;
  }

  private declarationFromNode(
    statement: ts.Statement,
    context: DocsSourceContext,
    order: number,
    kind: ConvertedDeclaration["kind"]
  ): ConvertedDeclaration | undefined {
    const named = statement as ts.Statement & {
      name?: ts.Identifier;
      typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
      heritageClauses?: ts.NodeArray<ts.HeritageClause>;
    };
    const name = named.name?.text ?? getName(statement, context.source);
    if (!name) {
      context.diagnostics.error(
        "DOCAF_ANONYMOUS_DECLARATION",
        "Anonymous declarations cannot be documented",
        locationOf(statement, context)
      );
      return undefined;
    }
    const modifiers = modifierTexts(statement);
    const description = getCommentAsString(statement, context.source).trim();
    const tags = parseJsDocTags(statement, context.source);
    const signature: ts.SignatureDeclarationBase | undefined =
      ts.isFunctionDeclaration(statement)
        ? statement
        : ts.isTypeAliasDeclaration(statement) &&
            ts.isFunctionTypeNode(statement.type)
          ? statement.type
          : undefined;
    const parameters = signature
      ? this.parametersOf(signature, context)
      : [];
    const returnType = signature
      ? this.returnTypeText(signature, context)
      : undefined;
    const properties =
      ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        ? collectProperties(
            ts.isInterfaceDeclaration(statement)
              ? undefined
              : statement.type,
            context.source,
            context,
            this.typeMode === "native"
          )
        : [];
    const heritage = named.heritageClauses ?? [];
    const augments: string[] = [];
    const implementsList: string[] = [];
    for (const clause of heritage) {
      const values = clause.types.map((type) => type.getText());
      if (clause.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassDeclaration(statement))
        augments.push(...values);
      else if (clause.token === ts.SyntaxKind.ImplementsKeyword)
        implementsList.push(...values);
      else if (clause.token === ts.SyntaxKind.ExtendsKeyword)
        augments.push(...values);
    }
    const declaration: ConvertedDeclaration = {
      name,
      longname: `${this.packageName}.${name}`,
      kind,
      description,
      classdesc: description,
      access: accessOf(modifiers),
      readonly: modifiers.includes("readonly"),
      abstract: modifiers.includes("abstract"),
      async: modifiers.includes("async"),
      virtual: hasTag(tags, "virtual"),
      deprecated: hasTag(tags, "deprecated"),
      since: memberOfTag(tags, "since")?.value,
      version: memberOfTag(tags, "version")?.value,
      optional: hasTag(tags, "optional"),
      type:
        ts.isTypeAliasDeclaration(statement) &&
        !ts.isFunctionTypeNode(statement.type)
          ? this.typeText(statement.type, context)
          : undefined,
      order,
      exportName: modifiers.includes("export") ? name : name,
      tags: this.synthesizedTags(statement, context, {
        method: ts.isFunctionDeclaration(statement),
        parameterOwner: signature,
        returnType,
        properties,
        modifierNames: modifiers,
      }),
      examples: [],
      parameters,
      properties,
      returnType,
      augments,
      implementsList,
      location: locationOf(statement, context),
      syntheticComment: "",
      modifiers,
      decorators: decoratorTexts(statement),
    };
    declaration.examples = collectExamples(declaration.tags);
    declaration.syntheticComment = this.syntheticForDeclaration(
      statement,
      context
    );
    return declaration;
  }

  private syntheticForDeclaration(
    statement: ts.Statement,
    context: DocsSourceContext
  ): string {
    const src = context.source;
    const jsDocNode = getJsDoc(statement)?.[0];
    if (!jsDocNode) return "";
    let comment = src.substring(jsDocNode.pos, jsDocNode.end);
    const name = getName(statement, src);
    if (ts.isFunctionDeclaration(statement))
      return fillMethodComment(comment, statement, src);
    if (ts.isTypeAliasDeclaration(statement)) {
      const alias = statement as ts.TypeAliasDeclaration;
      if (ts.isFunctionTypeNode(alias.type)) {
        comment = appendComment(comment, `@typedef {function} ${name}`);
        return convertParams(comment, alias, src);
      }
      if (ts.isTypeLiteralNode(alias.type)) {
        comment = appendComment(comment, `@typedef {object} ${name}`);
        return convertMembers(comment, alias.type, src);
      }
      if (ts.isIntersectionTypeNode(alias.type)) {
        comment = appendComment(comment, `@typedef {object} ${name}`);
        return convertMembers(comment, alias.type, src);
      }
      if (
        ts.isUnionTypeNode(alias.type) ||
        isSimpleInlineableExpression(alias.type)
      ) {
        const typeName = getTypeName(alias.type, src);
        comment = appendComment(comment, `@typedef {${typeName}} ${name}`);
        return convertMembers(comment, alias.type, src);
      }
    }
    if (ts.isInterfaceDeclaration(statement)) {
      comment = appendComment(comment, `@interface ${name}`);
      statement.members.forEach((member) => {
        const memberJsDoc = getJsDoc(member)?.[0];
        if (!memberJsDoc) return;
        let memberComment = src.substring(memberJsDoc.pos, memberJsDoc.end);
        const memberName = getName(member, src);
        memberComment = appendComment(
          memberComment,
          `@name ${name}#${memberName}`
        );
        if ((member as ts.TypeElement & { questionToken?: ts.QuestionToken }).questionToken)
          memberComment = appendComment(memberComment, "@optional");
        const typeElement = member as ts.TypeElement & { type?: ts.TypeNode };
        if (!typeElement.type && ts.isFunctionLike(member)) {
          memberComment = appendComment(
            memberComment,
            `@type {${getTypeName(member, src)}}`
          );
          memberComment = appendComment(memberComment, "@method");
        } else {
          memberComment = convertMembers(
            memberComment,
            typeElement.type,
            src
          );
          memberComment = appendComment(
            memberComment,
            `@type {${getTypeName(typeElement.type, src)}}`
          );
        }
        comment += `\n${memberComment}`;
      });
      return comment;
    }
    if (ts.isClassDeclaration(statement)) {
      comment = "";
      const className = name;
      statement.members.forEach((member) => {
        const memberJsDoc = getJsDoc(member)?.[0];
        if (!memberJsDoc) return;
        let memberComment = src.substring(memberJsDoc.pos, memberJsDoc.end);
        const modifiers = modifierTexts(member);
        modifiers.forEach((modifier) => {
          const allowed = [
            "async",
            "abstract",
            "private",
            "public",
            "protected",
          ];
          if (allowed.includes(modifier))
            memberComment = appendComment(memberComment, `@${modifier}`);
        });
        const typedMember = member as ts.ClassElement & {
          type?: ts.TypeNode;
        };
        if (typedMember.type && ts.isPropertyDeclaration(member)) {
          memberComment = appendComment(
            memberComment,
            `@type {${getTypeName(typedMember.type, src)}}`
          );
        }
        if (ts.isFunctionLike(member)) {
          memberComment = fillMethodComment(memberComment, member, src);
        }
        if (ts.isConstructorDeclaration(member)) {
          memberComment = appendComment(memberComment, "@constructor");
          memberComment += `\n${className}.prototype.${className}`;
        } else if (modifiers.includes("static")) {
          memberComment += `\n${className}.${getName(member, src)}`;
        } else {
          memberComment += `\n${className}.prototype.${getName(member, src)}`;
        }
        comment += `\n${memberComment}`;
      });
      return comment;
    }
    return comment;
  }

  private syntheticForMember(
    statement: ts.ClassDeclaration | ts.InterfaceDeclaration,
    member: ts.ClassElement | ts.TypeElement,
    context: DocsSourceContext
  ): string {
    const memberJsDoc = getJsDoc(member)?.[0];
    if (!memberJsDoc) return "";
    const src = context.source;
    let memberComment = src.substring(memberJsDoc.pos, memberJsDoc.end);
    const className = getName(statement, src);
    const memberName = getName(member, src);
    if (ts.isInterfaceDeclaration(statement)) {
      memberComment = appendComment(
        memberComment,
        `@name ${className}#${memberName}`
      );
      if ((member as ts.TypeElement & { questionToken?: ts.QuestionToken }).questionToken)
        memberComment = appendComment(memberComment, "@optional");
      return memberComment;
    }
    const modifiers = modifierTexts(member);
    modifiers.forEach((modifier) => {
      const allowed = ["async", "abstract", "private", "public", "protected"];
      if (allowed.includes(modifier))
        memberComment = appendComment(memberComment, `@${modifier}`);
    });
    const typedMember = member as ts.ClassElement & { type?: ts.TypeNode };
    if (typedMember.type && ts.isPropertyDeclaration(member)) {
      memberComment = appendComment(
        memberComment,
        `@type {${getTypeName(typedMember.type, src)}}`
      );
    }
    if (ts.isFunctionLike(member))
      memberComment = fillMethodComment(memberComment, member, src);
    if (ts.isConstructorDeclaration(member)) {
      memberComment = appendComment(memberComment, "@constructor");
      memberComment += `\n${className}.prototype.${className}`;
    } else if (modifiers.includes("static")) {
      memberComment += `\n${className}.${memberName}`;
    } else {
      memberComment += `\n${className}.prototype.${memberName}`;
    }
    return memberComment;
  }

  private memberFromNode(
    declaration: ConvertedDeclaration,
    member: ts.ClassElement | ts.TypeElement,
    context: DocsSourceContext,
    order: number
  ): ConvertedMember | undefined {
    const nameNode = (member as ts.NamedDeclaration).name;
    const isConstructor = ts.isConstructorDeclaration(member);
    const name = isConstructor
      ? "constructor"
      : nameNode
        ? getName(member, context.source)
        : "";
    if (!name) return undefined;
    const modifiers = modifierTexts(member);
    const isMethod =
      ts.isMethodDeclaration(member) ||
      ts.isMethodSignature(member) ||
      ts.isFunctionLike(member);
    const isCallable =
      ts.isMethodDeclaration(member) ||
      ts.isMethodSignature(member) ||
      ts.isConstructorDeclaration(member);
    const signature = isCallable
      ? (member as ts.SignatureDeclarationBase)
      : undefined;
    const parameters = signature
      ? this.parametersOf(signature, context)
      : [];
    const returnType =
      signature && !isConstructor
        ? this.returnTypeText(signature, context)
        : undefined;
    const typed = member as ts.ClassElement & { type?: ts.TypeNode };
    const properties = collectProperties(
      typed.type,
      context.source,
      context,
      this.typeMode === "native"
    );
    const kind: ConvertedMember["kind"] = isConstructor
      ? "constructor"
      : isMethod
        ? "function"
        : "member";
    const tags = this.synthesizedTags(member, context, {
      method: kind === "function",
      parameterOwner: signature,
      returnType,
      properties,
      modifierNames: modifiers,
      isConstructor,
    });
    const typeText = isConstructor
      ? undefined
      : this.typeText(typed.type, context, member);
    return {
      name,
      longname: `${declaration.longname}.${name}`,
      kind,
      description: getCommentAsString(member, context.source).trim(),
      access: accessOf(modifiers),
      readonly: modifiers.includes("readonly"),
      abstract: modifiers.includes("abstract"),
      async: modifiers.includes("async"),
      virtual: hasTag(tags, "virtual"),
      static: modifiers.includes("static"),
      optional: Boolean(
        (member as ts.TypeElement & { questionToken?: ts.QuestionToken })
          .questionToken || hasTag(tags, "optional")
      ),
      type: typeText || undefined,
      order,
      tags,
      examples: collectExamples(tags),
      parameters,
      properties,
      returnType,
      defaultValue:
        ts.isPropertyDeclaration(member) && member.initializer
          ? member.initializer.getText(context.sourceFile)
          : undefined,
      location: locationOf(member, context),
      syntheticComment: "",
      modifiers,
      decorators: decoratorTexts(member),
    };
  }

  private emitClassOrInterface(
    statement: ts.ClassDeclaration | ts.InterfaceDeclaration,
    context: DocsSourceContext,
    order: number,
    kind: "class" | "interface"
  ): DocletModel[] {
    const declaration = this.declarationFromNode(
      statement,
      context,
      order,
      kind
    );
    if (!declaration) return [];
    this.lastDeclaration = declaration;
    this.declarationByLongname.set(declaration.longname, statement);
    const owner = this.emitter.emitDeclaration(declaration, context);
    const doclets = [owner];
    let memberOrder = 0;
    for (const member of statement.members) {
      if (
        !this.includeUndocumented &&
        !getJsDoc(member)?.length
      )
        continue;
      const converted = this.memberFromNode(
        declaration,
        member,
        context,
        memberOrder
      );
      if (!converted) continue;
      memberOrder += 1;
      converted.syntheticComment = this.syntheticForMember(
        statement,
        member,
        context
      );
      this.declarationByLongname.set(converted.longname, member);
      doclets.push(
        this.emitter.emitMember(declaration, converted, owner, context)
      );
    }
    return doclets;
  }

  convertFile(context: DocsSourceContext): DocletModel[] {
    const doclets: DocletModel[] = [];
    let order = 0;
    for (const statement of context.sourceFile.statements) {
      const documented = Boolean(getJsDoc(statement)?.length);
      if (!documented && !this.includeUndocumented) continue;
      if (ts.isClassDeclaration(statement)) {
        doclets.push(
          ...this.emitClassOrInterface(statement, context, order, "class")
        );
        order += 1;
        continue;
      }
      if (ts.isInterfaceDeclaration(statement)) {
        doclets.push(
          ...this.emitClassOrInterface(statement, context, order, "interface")
        );
        order += 1;
        continue;
      }
      if (ts.isFunctionDeclaration(statement)) {
        const declaration = this.declarationFromNode(
          statement,
          context,
          order,
          "function"
        );
        if (!declaration) continue;
        this.lastDeclaration = declaration;
        this.declarationByLongname.set(declaration.longname, statement);
        doclets.push(this.emitter.emitDeclaration(declaration, context));
        order += 1;
        continue;
      }
      if (ts.isTypeAliasDeclaration(statement)) {
        const declaration = this.declarationFromNode(
          statement,
          context,
          order,
          "typedef"
        );
        if (!declaration) continue;
        this.lastDeclaration = declaration;
        this.declarationByLongname.set(declaration.longname, statement);
        doclets.push(this.emitter.emitDeclaration(declaration, context));
        order += 1;
        continue;
      }
      if (ts.isEnumDeclaration(statement)) {
        const declaration = this.declarationFromNode(
          statement,
          context,
          order,
          "enum"
        );
        if (!declaration) continue;
        this.lastDeclaration = declaration;
        this.declarationByLongname.set(declaration.longname, statement);
        const owner = this.emitter.emitDeclaration(declaration, context);
        doclets.push(owner);
        let memberOrder = 0;
        for (const member of statement.members) {
          const converted = this.memberFromNode(
            declaration,
            member as unknown as ts.ClassElement,
            context,
            memberOrder
          );
          if (!converted) continue;
          converted.kind = "member";
          memberOrder += 1;
          this.declarationByLongname.set(converted.longname, member);
          doclets.push(
            this.emitter.emitMember(declaration, converted, owner, context)
          );
        }
        order += 1;
        continue;
      }
      if (ts.isModuleDeclaration(statement)) {
        const declaration = this.declarationFromNode(
          statement,
          context,
          order,
          "module"
        );
        if (!declaration) continue;
        this.lastDeclaration = declaration;
        this.declarationByLongname.set(declaration.longname, statement);
        doclets.push(this.emitter.emitDeclaration(declaration, context));
        order += 1;
      }
    }
    return doclets;
  }
}

/**
 * @description Returns the base name of a source file path.
 * @summary Thin wrapper around `path.basename`, used to derive the file name
 * component of source records from a full file path.
 * @param {string} filename - The file path to reduce.
 * @returns {string} The last path segment of the given filename.
 */
export function baseName(filename: string): string {
  return path.basename(filename);
}
