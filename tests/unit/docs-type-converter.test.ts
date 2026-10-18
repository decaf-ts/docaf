import ts from "typescript";
import { GeneratedDocsStore } from "../../src/generator/store";
import { TypeScriptPlugin } from "../../src/generator/betterdocs/typescript/TypeScriptPlugin";
import {
  appendComment,
  convertMembers,
  convertParams,
  fillMethodComment,
  getName,
  getCommentAsString,
  getTypeName,
  parseJsDocTags,
  TypeConverter,
} from "../../src/generator/betterdocs/typescript/TypeConverter";
import { DocsIds, type DocletModel } from "../../src/models";
import {
  KINDS_FIXTURE,
  VERTICAL_SLICE,
  capturingEmitter,
  contextForFile,
  sourceFileOf,
} from "./support/typescript";

function statementOf(context: ReturnType<typeof contextForFile>, name: string) {
  const statement = context.sourceFile.statements.find(
    (candidate) =>
      (candidate as ts.Statement & { name?: ts.Identifier }).name?.text === name
  );
  if (!statement) throw new Error(`Missing statement ${name}`);
  return statement;
}

function variableType(source: string): { type: ts.TypeNode; source: string } {
  const sourceFile = sourceFileOf(source);
  const statement = sourceFile.statements[0] as ts.VariableStatement;
  return { type: statement.declarationList.declarations[0].type!, source };
}

describe("TypeConverter helper parity", () => {
  const context = contextForFile(KINDS_FIXTURE);
  const toUpper = statementOf(context, "toUpper");
  const derived = statementOf(context, "DerivedThing");

  it("appendComment appends synthetic lines before the closing comment", () => {
    expect(appendComment("/**\n * Hello.\n */", "@method")).toBe(
      "/**\n * Hello.\n * @method\n */"
    );
    expect(
      appendComment("/**\n * Hello.\n */", "@param {string} value\nvalue docs")
    ).toBe(
      "/**\n * Hello.\n * @param {string} value\n * value docs\n */"
    );
  });

  it("resolves type names across primitives, unions, functions and object literals", () => {
    const point = statementOf(context, "Point");
    const primitive = variableType("const a: string = 'a';");
    expect(getTypeName(primitive.type, primitive.source)).toBe("string");
    const array = variableType("const a: string[] = [];");
    expect(getTypeName(array.type, array.source)).toBe("Array");
    const generic = variableType("const a: Array<string> = [];");
    expect(getTypeName(generic.type, generic.source)).toBe("Array<string>");
    const union = variableType("const a: string | number = 1;");
    expect(getTypeName(union.type, union.source)).toBe("string | number");
    const fn = variableType("const a: () => void = () => undefined;");
    expect(getTypeName(fn.type, fn.source)).toBe("function");
    const object = variableType("const a: { flag: boolean } = { flag: true };");
    expect(getTypeName(object.type, object.source)).toBe("object");
    expect(
      getTypeName(
        (point as ts.InterfaceDeclaration).members[0].type,
        context.source
      )
    ).toBe("number");
    expect(getTypeName(undefined, context.source)).toBe("");
  });

  it("reads names and comment text from declarations and parameters", () => {
    const functionDeclaration = toUpper as ts.FunctionDeclaration;
    expect(getName(functionDeclaration, context.source)).toBe("toUpper");
    expect(getName(functionDeclaration.parameters[0], context.source)).toBe(
      "input"
    );
    expect(getCommentAsString(functionDeclaration, context.source)).toBe(
      "Uppercases a value."
    );
    expect(getCommentAsString(functionDeclaration.parameters[0], context.source)).toBe(
      ""
    );
  });

  it("fills synthetic @param, @method and @return tags", () => {
    const base = "/**\n * Uppercases a value.\n */";
    const withParams = convertParams(base, toUpper, context.source);
    expect(withParams).toContain("@param {string} input");
    const method = fillMethodComment(base, toUpper, context.source);
    expect(method).toContain("@method");
    expect(method).toContain("@param {string} input");
    expect(method).toContain("@return {string}");
  });

  it("expands object literal and array members into property tags", () => {
    const widgetOptions = statementOf(context, "WidgetOptions");
    const type = (widgetOptions as ts.TypeAliasDeclaration).type;
    const comment = convertMembers("/**\n * Options.\n */", type, context.source);
    expect(comment).toContain("@property {string} label");
    expect(comment).toContain("@property {number} [count]");
    expect(comment).toContain("@property {object} nested");
    expect(comment).toContain("@property {boolean} nested.flag");

    const array = variableType("const a: { id: string }[] = [];");
    const arrayComment = convertMembers(
      "/**\n * Values.\n */",
      array.type,
      array.source
    );
    expect(arrayComment).toContain("@property {string} [].id");
  });

  it("parses JSDoc tags with their original values and kinds", () => {
    const tags = parseJsDocTags(toUpper, context.source);
    const titles = tags.map((tag) => tag.title);
    expect(titles).toEqual([
      "category",
      "subcategory",
      "param",
      "returns",
      "example",
    ]);

    const param = tags.find((tag) => tag.title === "param")!;
    expect(param).toMatchObject({
      originalValue: "input",
      kind: "param",
      comment: "source text",
    });
    expect(param.value).toContain("input");

    const returns = tags.find((tag) => tag.title === "returns")!;
    expect(returns).toMatchObject({
      kind: "return",
      comment: "uppercased text",
    });

    const example = tags.find((tag) => tag.title === "example")!;
    expect(example.value).toContain("<caption>Uppercase</caption>");

    const category = tags.find((tag) => tag.title === "category")!;
    expect(category.value).toBe("Shapes");
  });

  it("converts enums and the derived class members in declaration order", () => {
    const capture = capturingEmitter();
    const converter = new TypeConverter(capture.emitter, {
      packageName: "docaf-kinds",
    });

    const doclets = converter.convertFile(context);

    expect(capture.declarations).toHaveLength(10);
    expect(doclets).toHaveLength(20);
    expect(capture.declarations.map((entry) => entry.name)).toEqual([
      "Point",
      "NamedThing",
      "BaseThing",
      "DerivedThing",
      "ShapeKind",
      "Handler",
      "WidgetOptions",
      "Identifier",
      "toUpper",
      "Geometry",
    ]);

    const namedThing = capture.declarations.find(
      (entry) => entry.name === "NamedThing"
    )!;
    expect(namedThing.kind).toBe("interface");
    expect(namedThing.augments).toEqual(["Point"]);

    const viaPoint = capture.declarations.find(
      (entry) => entry.name === "Point"
    )!;
    expect(viaPoint.tags.find((tag) => tag.title === "category")?.value).toBe(
      "Shapes"
    );
    expect(
      viaPoint.tags.find((tag) => tag.title === "subcategory")?.value
    ).toBe("Geometry");

    const enumDeclaration = capture.declarations.find(
      (entry) => entry.name === "ShapeKind"
    )!;
    expect(enumDeclaration.kind).toBe("enum");
    expect(
      capture.members
        .filter((member) => member.longname.startsWith("docaf-kinds.ShapeKind."))
        .map((member) => member.name)
    ).toEqual(["Circle", "Square"]);

    const handler = capture.declarations.find(
      (entry) => entry.name === "Handler"
    )!;
    expect(handler.kind).toBe("typedef");
    expect(handler.parameters.map((parameter) => parameter.name)).toEqual([
      "input",
      "count",
    ]);
    expect(handler.parameters[1].optional).toBe(true);
    expect(handler.returnType).toBe("Promise<void>");
    expect(handler.type).toBeUndefined();

    const widgetOptions = capture.declarations.find(
      (entry) => entry.name === "WidgetOptions"
    )!;
    expect(widgetOptions.type).toBe("object");

    const identifier = capture.declarations.find(
      (entry) => entry.name === "Identifier"
    )!;
    expect(identifier.type).toBe("string | number");

    const functionDeclaration = capture.declarations.find(
      (entry) => entry.name === "toUpper"
    )!;
    expect(functionDeclaration.kind).toBe("function");
    expect(functionDeclaration.parameters[0]).toMatchObject({
      name: "input",
      typeText: "string",
      optional: false,
      rest: false,
    });
    expect(functionDeclaration.returnType).toBe("string");
    expect(functionDeclaration.examples).toEqual([
      { caption: "Uppercase", code: 'toUpper("a")' },
    ]);

    const geometry = capture.declarations.find(
      (entry) => entry.name === "Geometry"
    )!;
    expect(geometry.kind).toBe("module");

    const derivedClass = capture.declarations.find(
      (entry) => entry.name === "DerivedThing"
    )!;
    expect(derivedClass.augments).toEqual(["BaseThing"]);
    expect(derivedClass.implementsList).toEqual(["NamedThing"]);
    expect(
      (derived as ts.ClassDeclaration).members.some(
        (member) =>
          (member as ts.NamedDeclaration).name &&
          (member as ts.MethodDeclaration).name?.getText() === "run"
      )
    ).toBe(true);

    const derivedRun = capture.members.find(
      (member) => member.longname === "docaf-kinds.DerivedThing.run"
    )!;
    expect(derivedRun.tags.some((tag) => tag.title === "deprecated")).toBe(
      true
    );
    expect(derivedRun.returnType).toBe("string");

    const factory = capture.members.find(
      (member) => member.longname === "docaf-kinds.DerivedThing.create"
    )!;
    expect(factory.static).toBe(true);
    expect(factory.defaultValue).toBeUndefined();
    expect(factory.parameters[0]).toMatchObject({
      name: "name",
      typeText: "",
      optional: true,
      defaultValue: '"derived"',
    });
    expect(factory.returnType).toBe("DerivedThing");
  });

  it("does not derive a return type or doclet type for constructors", () => {
    const capture = capturingEmitter();
    const converter = new TypeConverter(capture.emitter, {
      packageName: "@fixture/adapter",
    });

    converter.convertFile(contextForFile(`${VERTICAL_SLICE}/adapter.ts`));

    const constructor = capture.members.find(
      (member) => member.name === "constructor"
    )!;
    expect(constructor).toBeDefined();
    expect(constructor.kind).toBe("constructor");
    expect(constructor.returnType).toBeUndefined();
    expect(constructor.type).toBeUndefined();
    expect(
      constructor.tags.some(
        (tag) =>
          tag.title === "return" ||
          tag.title === "returns" ||
          tag.value === "any" ||
          tag.value === "{any}"
      )
    ).toBe(false);
    expect(constructor.syntheticComment).not.toMatch(/@returns?\b/);
  });

  it("honours native type mode for declarations and signatures", () => {
    const capture = capturingEmitter();
    const converter = new TypeConverter(capture.emitter, {
      packageName: "docaf-kinds",
      typeMode: "native",
    });

    converter.convertFile(context);

    const widgetOptions = capture.declarations.find(
      (entry) => entry.name === "WidgetOptions"
    )!;
    expect(widgetOptions.type).toContain("label: string");
    expect(widgetOptions.type).toContain("count?: number");
    expect(widgetOptions.type).toContain("flag: boolean");

    const factory = capture.members.find(
      (member) => member.longname === "docaf-kinds.DerivedThing.create"
    )!;
    expect(factory.parameters[0].typeText).toBe("string");
    expect(factory.returnType).toBe("DerivedThing");
  });

  it("emits decaf models directly from the same conversion result", () => {
    const store = new GeneratedDocsStore();
    const plugin = new TypeScriptPlugin({
      packageName: "docaf-kinds",
      store,
      typeMode: "native",
    });
    const pluginContext = contextForFile(KINDS_FIXTURE);
    const doclets = plugin.extract(pluginContext);

    expect(doclets).toHaveLength(20);
    expect(store.counts().doclets).toBe(20);

    const toUpper = store
      .get<DocletModel>("doclets")
      .find((doclet) => doclet.longname === "docaf-kinds.toUpper")!;
    expect(toUpper.uid).toBe(DocsIds.doclet("docaf-kinds", "toUpper"));
    expect(toUpper.signatureIds).toHaveLength(1);
    expect(toUpper.exampleIds).toHaveLength(1);
    expect(toUpper.tagIds.length).toBeGreaterThan(0);
    expect(toUpper.sourceId).toBeDefined();

    const signature = store
      .get("signatures")
      .find((entry) => entry.uid === toUpper.signatureIds[0])!;
    expect((signature as { signatureText?: string }).signatureText).toBe(
      "toUpper(input: string): string"
    );
    const parameters = store
      .get("parameters")
      .filter(
        (entry) =>
          (entry as { signatureUid?: string }).signatureUid === signature.uid
      );
    expect(parameters).toHaveLength(1);
    expect((parameters[0] as { name?: string }).name).toBe("input");
    expect((parameters[0] as { typeText?: string }).typeText).toBe("string");
    expect(
      store
        .get("returns")
        .some(
          (entry) =>
            (entry as { signatureUid?: string }).signatureUid ===
            signature.uid
        )
    ).toBe(true);

    const derived = store
      .get<DocletModel>("doclets")
      .find((doclet) => doclet.longname === "docaf-kinds.DerivedThing")!;
    expect(derived.augments).toEqual(["BaseThing"]);
    expect(derived.implements).toEqual(["NamedThing"]);
    const derivedRun = store
      .get<DocletModel>("doclets")
      .find((doclet) => doclet.longname === "docaf-kinds.DerivedThing.run")!;
    expect(derivedRun.memberofUid).toBe(derived.uid);
    expect(derivedRun.scope).toBe("instance");
    expect(
      store.get("references").some(
        (reference) =>
          (reference as { ownerUid?: string }).ownerUid === derived.uid &&
          (reference as { kind?: string }).kind === "implements"
      )
    ).toBe(true);
  });

  it("records BetterDocs-shaped parity metadata through the compatibility writer", () => {
    const store = new GeneratedDocsStore();
    const plugin = new TypeScriptPlugin({
      packageName: "docaf-kinds",
      store,
      typeMode: "betterdocs",
      compatibility: true,
    });
    plugin.extract(contextForFile(KINDS_FIXTURE));

    const legacy = plugin.compatibility!.doclets;
    const toUpper = legacy.find((doclet) => doclet.longname === "docaf-kinds.toUpper")!;
    expect(toUpper.kind).toBe("function");
    expect(toUpper.category).toBe("Shapes");
    expect(toUpper.subCategory).toBe("Functions");
    expect(toUpper.params).toEqual([
      expect.objectContaining({
        name: "input",
        type: "string",
        optional: false,
      }),
    ]);
    expect(toUpper.returns).toEqual([{ type: "string" }]);
    expect(toUpper.examples).toEqual([
      { caption: "Uppercase", code: 'toUpper("a")' },
    ]);
    expect(toUpper.meta).toMatchObject({
      filename: expect.stringContaining("kinds.ts"),
      path: expect.stringContaining("kinds.ts"),
      lineno: expect.any(Number),
      columnno: expect.any(Number),
    });
    expect(toUpper.syntheticComment).toContain("@method");
    expect(toUpper.syntheticComment).toContain("@param input source text");
    expect(toUpper.syntheticComment).toContain("@returns uppercased text");

    const derived = legacy.find(
      (doclet) => doclet.longname === "docaf-kinds.DerivedThing"
    )!;
    expect(derived.augments).toBeUndefined();
    expect(derived.syntheticComment).toContain("DerivedThing.prototype.run");
    expect(derived.syntheticComment).toContain("DerivedThing.create");
    expect(derived.syntheticComment).toContain("@deprecated");

    const derivedRun = legacy.find(
      (doclet) => doclet.longname === "docaf-kinds.DerivedThing.run"
    )!;
    expect(derivedRun).toMatchObject({
      memberof: "docaf-kinds.DerivedThing",
      scope: "instance",
      kind: "function",
    });
    expect(derivedRun.tags.some((tag) => tag.title === "deprecated")).toBe(
      true
    );

    expect(store.counts().doclets).toBeGreaterThan(0);
  });
});
