import path from "node:path";
import ts from "typescript";
import { AngularComponentExtractor } from "../../src/generator/extractors/AngularComponentExtractor";
import type { DocsSourceContext } from "../../src/generator/types";
import {
  SIGNALS_FIXTURE,
  VERTICAL_SLICE,
  contextForFile,
} from "./support/typescript";

function extractionFor(context: DocsSourceContext) {
  const extractor = new AngularComponentExtractor();
  const declaration = context.sourceFile.statements.find(
    (statement) =>
      ts.isClassDeclaration(statement) &&
      statement.name?.text ===
        (context.filename === SIGNALS_FIXTURE
          ? "SignalWidgetComponent"
          : "DocWidgetComponent")
  );
  if (!declaration) throw new Error("Missing fixture class");
  return { extractor, declaration, context };
}

describe("AngularComponentExtractor", () => {
  const widget = extractionFor(
    contextForFile(path.join(VERTICAL_SLICE, "widget.component.ts"))
  );
  const signals = extractionFor(contextForFile(SIGNALS_FIXTURE));

  it("extracts component metadata from the @Component decorator", async () => {
    const extracted = await widget.extractor.extract(
      widget.declaration,
      widget.context
    );

    expect(extracted).toMatchObject({
      framework: "angular",
      name: "DocWidgetComponent",
      exportName: "DocWidgetComponent",
      sourceFile: "widget.component.ts",
      selector: "doc-widget",
      standalone: true,
    });
    expect(extracted.component).toMatchObject({
      uid: "component:angular:widget.component.ts#DocWidgetComponent",
      name: "DocWidgetComponent",
      selector: "doc-widget",
      standalone: true,
    });
    expect(extracted.location).toMatchObject({
      fileName: "widget.component.ts",
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });

  it("extracts @Input aliases, required flags and defaults", async () => {
    const extracted = await widget.extractor.extract(
      widget.declaration,
      widget.context
    );
    const properties = Object.fromEntries(
      extracted.properties.map((property) => [property.name, property])
    );

    expect(Object.keys(properties)).toEqual(["label", "count"]);

    expect(properties.label).toMatchObject({
      kind: "input",
      name: "label",
      alias: undefined,
      typeText: "string",
      required: false,
      optional: true,
      defaultValue: '"hello"',
      description: "Visible label.",
    });

    expect(properties.count).toMatchObject({
      kind: "input",
      name: "count",
      alias: "itemCount",
      typeText: "number",
      required: true,
      optional: false,
      defaultValue: undefined,
      description: "Item count.",
    });
    expect(properties.count.uid).toBe(
      "component-property:component:angular:widget.component.ts#DocWidgetComponent:count"
    );
    expect(extracted.propertyLocations.count).toMatchObject({
      fileName: "widget.component.ts",
      line: expect.any(Number),
    });
    expect(extracted.component?.propertyUids).toEqual([
      properties.label.uid,
      properties.count.uid,
    ]);
  });

  it("extracts @Output events and their payload types", async () => {
    const extracted = await widget.extractor.extract(
      widget.declaration,
      widget.context
    );
    const changed = extracted.events[0];

    expect(extracted.events).toHaveLength(1);
    expect(changed).toMatchObject({
      name: "changed",
      description: "Emitted when the label changes.",
    });
    expect(changed.typeText).toContain("EventEmitter<");
    expect(changed.payloadTypeText).toContain("value: string");
    expect(extracted.eventLocations.changed).toMatchObject({
      fileName: "widget.component.ts",
      line: expect.any(Number),
    });
    expect(extracted.component?.eventUids).toEqual([changed.uid]);
  });

  it("extracts signal input, model and output declarations", async () => {
    const extracted = await signals.extractor.extract(
      signals.declaration,
      signals.context
    );
    const properties = Object.fromEntries(
      extracted.properties.map((property) => [property.name, property])
    );
    const events = Object.fromEntries(
      extracted.events.map((event) => [event.name, event])
    );

    expect(Object.keys(properties)).toEqual([
      "label",
      "count",
      "value",
      "title",
      "legacy",
    ]);
    expect(Object.keys(events)).toEqual(["saved", "close"]);

    expect(properties.label).toMatchObject({
      typeText: "string",
      required: false,
      optional: true,
      defaultValue: '"hello"',
    });
    expect(properties.count).toMatchObject({
      typeText: "number",
      required: true,
      optional: false,
    });
    expect(properties.count.defaultValue).toBeUndefined();
    expect(properties.value).toMatchObject({
      typeText: "number",
      required: false,
      defaultValue: "3",
    });
    expect(properties.title).toMatchObject({
      alias: "displayTitle",
      typeText: "string",
      required: true,
      optional: false,
      defaultValue: '"title"',
    });
    expect(properties.legacy).toMatchObject({
      alias: "legacyAlias",
      typeText: "string",
      required: true,
      optional: false,
      defaultValue: '"legacy"',
    });

    expect(events.saved.payloadTypeText).toBe("{ id: number }");
    expect(events.saved.typeText).toBe("output<{ id: number }>");
    expect(events.close.payloadTypeText).toBe("void");
    expect(events.close.typeText).toContain("EventEmitter<void>");
  });

  it("supports only classes decorated with @Component", () => {
    const plain = contextForFile(path.join(VERTICAL_SLICE, "adapter.ts"));
    const base = plain.sourceFile.statements.find(
      (statement) =>
        (statement as { name?: { text?: string } }).name?.text === "BaseAdapter"
    )!;
    expect(widget.extractor.supports(widget.declaration)).toBe(true);
    expect(widget.extractor.supports(base)).toBe(false);
  });
});
