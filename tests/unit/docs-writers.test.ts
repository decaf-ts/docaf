import path from "node:path";
import { AngularComponentExtractor } from "../../src/generator/extractors/AngularComponentExtractor";
import { DecafModelWriter } from "../../src/generator/writers/DecafModelWriter";
import { BetterDocsCompatibilityWriter } from "../../src/generator/writers/BetterDocsCompatibilityWriter";
import { GeneratedDocsStore } from "../../src/generator/store";
import { DocletModel, DocsIds } from "../../src/models";
import type {
  ConvertedDeclaration,
  ConvertedMember,
  DocletEmitter,
} from "../../src/generator/types";
import {
  VERTICAL_SLICE,
  contextForFile,
} from "./support/typescript";

const declaration: ConvertedDeclaration = {
  name: "FixtureClass",
  longname: "docaf-writers.FixtureClass",
  kind: "class",
  description: "Fixture class.",
  classdesc: "Fixture class description.",
  access: "public",
  order: 0,
  exportName: "FixtureClass",
  tags: [
    { title: "category", value: "Fixtures", kind: "category" },
    { title: "subcategory", value: "Unit", kind: "subcategory" },
  ],
  examples: [],
  parameters: [],
  properties: [],
  augments: [],
  implementsList: [],
  location: {
    fileName: "fixture.ts",
    line: 4,
    column: 1,
  },
  syntheticComment: "/** Fixture class. */",
  modifiers: ["export"],
  decorators: [],
};

const member: ConvertedMember = {
  name: "run",
  longname: "docaf-writers.FixtureClass.run",
  kind: "function",
  description: "Runs the fixture.",
  access: "public",
  async: true,
  static: false,
  optional: false,
  order: 0,
  tags: [{ title: "method", kind: "method" }],
  examples: [{ caption: "Run", code: "fixture.run()" }],
  parameters: [
    {
      name: "value",
      typeText: "string",
      optional: false,
      rest: false,
      defaultValue: '"value"',
      description: "Input value.",
    },
  ],
  properties: [],
  returnType: "void",
  location: {
    fileName: "fixture.ts",
    line: 6,
    column: 3,
  },
  syntheticComment: "/** Runs the fixture. */",
  modifiers: ["public", "async"],
  decorators: [],
};

describe("DecafModelWriter", () => {
  it("emits declarations, members and their source-located models", () => {
    const store = new GeneratedDocsStore();
    const writer = new DecafModelWriter(store, "docaf-writers");
    const context = contextForFile(path.join(VERTICAL_SLICE, "adapter.ts"));

    const owner = writer.emitDeclaration(declaration, context);
    const emittedMember = writer.emitMember(
      declaration,
      member,
      owner,
      context
    );

    expect(owner.uid).toBe(DocsIds.doclet("docaf-writers", "FixtureClass"));
    expect(owner.kind).toBe("class");
    expect(owner.scope).toBe("global");
    expect(owner.summary).toBe("Fixture class.");
    expect(owner.sourceId).toBeDefined();
    expect(owner.signatureIds).toHaveLength(1);

    expect(emittedMember.uid).toBe(
      `${owner.uid}#run:0`
    );
    expect(emittedMember.memberofUid).toBe(owner.uid);
    expect(emittedMember.scope).toBe("instance");
    expect(emittedMember.async).toBe(true);
    expect(emittedMember.signatureIds).toHaveLength(1);

    expect(store.size("doclets")).toBe(2);
    expect(store.size("sources")).toBe(2);
    expect(store.size("signatures")).toBe(2);
    expect(store.size("parameters")).toBe(1);
    expect(store.size("returns")).toBe(1);
    expect(store.size("examples")).toBe(1);
    expect(store.get("references")).toHaveLength(0);
  });

  it("emits component, property and event records for an extraction", async () => {
    const store = new GeneratedDocsStore();
    const writer = new DecafModelWriter(store, "docaf-writers");
    const context = contextForFile(path.join(VERTICAL_SLICE, "widget.component.ts"));
    const extractor = new AngularComponentExtractor();
    const widget = context.sourceFile.statements.find(
      (statement) =>
        (statement as { name?: { text?: string } }).name?.text ===
        "DocWidgetComponent"
    )!;
    const extraction = await extractor.extract(widget, context);
    const doclet = new DocletModel({
      uid: DocsIds.doclet("docaf-writers", "DocWidgetComponent"),
      name: "DocWidgetComponent",
      longname: "docaf-writers.DocWidgetComponent",
      kind: "class",
    });
    store.add("doclets", doclet);

    const component = writer.emitComponent(doclet, extraction);

    expect(component).toBe(extraction.component);
    expect(component.docletUid).toBe(doclet.uid);
    expect(component.propertyUids).toEqual(
      extraction.properties.map((property) => property.uid)
    );
    expect(component.eventUids).toEqual(
      extraction.events.map((event) => event.uid)
    );
    expect(doclet.componentId).toBe(component.uid);
    expect(store.size("components")).toBe(1);
    expect(store.size("componentProperties")).toBe(2);
    expect(store.size("componentEvents")).toBe(1);
    for (const property of store.get("componentProperties")) {
      expect((property as { componentUid?: string }).componentUid).toBe(
        component.uid
      );
    }
    for (const event of store.get("componentEvents")) {
      expect((event as { componentUid?: string }).componentUid).toBe(
        component.uid
      );
    }
  });
});

describe("BetterDocsCompatibilityWriter", () => {
  function trackingEmitter() {
    const owner = new DocletModel({ uid: "doclet:inner-owner" });
    let declarationCalls = 0;
    let memberCalls = 0;
    const emitter: DocletEmitter = {
      emitDeclaration: () => {
        declarationCalls += 1;
        return owner;
      },
      emitMember: () => {
        memberCalls += 1;
        return new DocletModel({ uid: "doclet:inner-member" });
      },
    };
    return {
      emitter,
      owner,
      get declarationCalls() {
        return declarationCalls;
      },
      get memberCalls() {
        return memberCalls;
      },
    };
  }

  it("records BetterDocs-shaped declarations and still delegates emission", () => {
    const inner = trackingEmitter();
    const writer = new BetterDocsCompatibilityWriter(inner.emitter);
    const context = contextForFile(path.join(VERTICAL_SLICE, "adapter.ts"));

    const result = writer.emitDeclaration(declaration, context);

    expect(result).toBe(inner.owner);
    expect(inner.declarationCalls).toBe(1);
    expect(writer.doclets).toHaveLength(1);
    expect(writer.doclets[0]).toMatchObject({
      name: "FixtureClass",
      longname: "docaf-writers.FixtureClass",
      kind: "class",
      category: "Fixtures",
      subCategory: "Unit",
      meta: {
        filename: "fixture.ts",
        path: "fixture.ts",
        lineno: 4,
        columnno: 1,
      },
    });
    expect(writer.doclets[0].params).toEqual([]);
  });

  it("records BetterDocs-shaped members with params, returns and scope", () => {
    const inner = trackingEmitter();
    const writer = new BetterDocsCompatibilityWriter(inner.emitter);
    const context = contextForFile(path.join(VERTICAL_SLICE, "adapter.ts"));

    writer.emitMember(
      declaration,
      member,
      inner.owner,
      context
    );

    expect(inner.memberCalls).toBe(1);
    expect(writer.doclets).toHaveLength(1);
    expect(writer.doclets[0]).toMatchObject({
      name: "run",
      longname: "docaf-writers.FixtureClass.run",
      kind: "function",
      memberof: "docaf-writers.FixtureClass",
      scope: "instance",
      description: "Runs the fixture.",
      async: true,
      optional: false,
      type: undefined,
    });
    expect(writer.doclets[0].params).toEqual([
      {
        name: "value",
        type: "string",
        optional: false,
        variable: false,
        description: "Input value.",
        defaultvalue: '"value"',
      },
    ]);
    expect(writer.doclets[0].returns).toEqual([{ type: "void" }]);
    expect(writer.doclets[0].examples).toEqual([
      { caption: "Run", code: "fixture.run()" },
    ]);
    expect(writer.doclets[0].syntheticComment).toBe(
      "/** Runs the fixture. */"
    );
  });
});
