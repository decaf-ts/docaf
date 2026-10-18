import {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPropertyModel,
  DocExampleModel,
  DocletModel,
  DocsIds,
} from "../../src/models";
import type { PublicationDataset } from "../../src/publisher/dataset";
import { PreviewBuilder } from "../../src/publisher/PreviewBuilder";

interface ComponentFixture {
  docletUid?: string;
  exampleIds?: string[];
  properties?: string[];
  events?: string[];
  name?: string;
}

function datasetWith(
  component: ComponentFixture = {},
  examples: Array<{ uid: string; code: string; caption?: string }> = [
    { uid: "example:one", code: "" },
  ]
): PublicationDataset {
  const componentUid = DocsIds.component(
    "angular",
    "fixture.ts",
    component.name ?? "Widget"
  );
  const docletUid = component.docletUid ?? "doclet:widget";
  const doclet = new DocletModel({
    uid: docletUid,
    name: component.name ?? "Widget",
    longname: `fixture.${component.name ?? "Widget"}`,
    kind: "class",
    exampleIds: component.exampleIds ?? examples.map((entry) => entry.uid),
  });
  const model = new DocComponentModel({
    uid: componentUid,
    docletUid,
    framework: "angular",
    name: component.name ?? "Widget",
    exportName: component.name ?? "Widget",
    sourceFile: "fixture.ts",
    standalone: true,
  });
  return {
    doclets: [doclet],
    tags: [],
    types: [],
    parameters: [],
    returns: [],
    signatures: [],
    examples: examples.map(
      (entry) =>
        new DocExampleModel({
          uid: entry.uid,
          ownerUid: docletUid,
          index: 0,
          code: entry.code,
          caption: entry.caption,
        })
    ),
    sources: [],
    references: [],
    components: [model],
    componentProperties: (component.properties ?? []).map(
      (name) =>
        new DocComponentPropertyModel({
          uid: DocsIds.componentProperty(componentUid, name),
          componentUid,
          name,
          kind: "input",
        })
    ),
    componentEvents: (component.events ?? []).map(
      (name) =>
        new DocComponentEventModel({
          uid: DocsIds.componentEvent(componentUid, name),
          componentUid,
          name,
          typeText: "EventEmitter<void>",
        })
    ),
    componentPreviews: [],
    tutorials: [],
  };
}

function previewFor(dataset: PublicationDataset) {
  return dataset.componentPreviews[0];
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PreviewBuilder regex metacharacters (L4)", () => {
  it("extracts a default for a property named value[0]", () => {
    const dataset = datasetWith(
      { properties: ["value[0]"] },
      [{ uid: "example:bracket", code: "<widget value[0]: 42 />" }]
    );

    expect(() => new PreviewBuilder().process(dataset)).not.toThrow();

    expect(previewFor(dataset).inputDefaults).toEqual({ "value[0]": 42 });
    expect(previewFor(dataset).controls).toEqual(["value[0]"]);
  });

  it("extracts a default for a dotted property name", () => {
    const dataset = datasetWith(
      { properties: ["a.b"] },
      [{ uid: "example:dot", code: '<widget a.b: "hello" />' }]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({ "a.b": "hello" });
  });

  it("extracts quoted metacharacter property names", () => {
    const dataset = datasetWith(
      { properties: ["a.b", "value[0]"] },
      [
        {
          uid: "example:quoted",
          code: '<widget "a.b": true \'value[0]\': -3.5 />',
        },
      ]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({
      "a.b": true,
      "value[0]": -3.5,
    });
  });

  it("does not treat a metacharacter property as a substring match", () => {
    const dataset = datasetWith(
      { properties: ["a.b"] },
      [{ uid: "example:substring", code: "xa.by: 99" }]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({});
  });
});

describe("PreviewBuilder literal extraction", () => {
  it("parses booleans, numbers and strings", () => {
    const dataset = datasetWith(
      { properties: ["enabled", "ratio", "count", "label"] },
      [
        {
          uid: "example:literals",
          code: 'enabled: true, ratio: 1.5, count: -2, label: "hello"',
        },
      ]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({
      enabled: true,
      ratio: 1.5,
      count: -2,
      label: "hello",
    });
  });

  it("parses single-quoted strings and false", () => {
    const dataset = datasetWith(
      { properties: ["label", "disabled"] },
      [{ uid: "example:single", code: "label: 'world', disabled: false" }]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({
      label: "world",
      disabled: false,
    });
  });

  it("leaves properties without a default out of inputDefaults", () => {
    const dataset = datasetWith(
      { properties: ["label", "unknown"] },
      [{ uid: "example:none", code: "label: 'set'" }]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({ label: "set" });
  });

  it("skips an unterminated string literal", () => {
    const dataset = datasetWith(
      { properties: ["label"] },
      [{ uid: "example:unterminated", code: 'label: "unterminated' }]
    );

    new PreviewBuilder().process(dataset);

    expect(previewFor(dataset).inputDefaults).toEqual({});
  });
});

describe("PreviewBuilder preview records", () => {
  it("names the first preview after the component and uses captions", () => {
    const dataset = datasetWith(
      {
        name: "Fancy Widget",
        exampleIds: ["example:first", "example:second", "example:third"],
      },
      [
        { uid: "example:first", code: "" },
        { uid: "example:second", code: "", caption: "  Caption   here  " },
        { uid: "example:third", code: "" },
      ]
    );

    new PreviewBuilder().process(dataset);

    expect(dataset.componentPreviews.map((preview) => preview.name)).toEqual([
      "Caption here",
      "Fancy Widget",
      "Fancy Widget-3",
    ]);
  });

  it("skips missing examples and components without examples", () => {
    const dataset = datasetWith(
      { exampleIds: ["example:missing", "example:present"] },
      [{ uid: "example:present", code: "" }]
    );

    new PreviewBuilder().process(dataset);

    expect(dataset.componentPreviews).toHaveLength(1);
    expect(dataset.componentPreviews[0].name).toBe("Widget");

    const withoutExamples = datasetWith({ exampleIds: [] });
    new PreviewBuilder().process(withoutExamples);
    expect(withoutExamples.componentPreviews).toEqual([]);
  });

  it("skips components whose doclet is missing", () => {
    const dataset = datasetWith();
    dataset.doclets = [];

    new PreviewBuilder().process(dataset);

    expect(dataset.componentPreviews).toEqual([]);
  });

  it("records controls, events and the component entry", () => {
    const dataset = datasetWith(
      { properties: ["label"], events: ["clicked"] },
      [{ uid: "example:controls", code: "" }]
    );

    new PreviewBuilder().process(dataset);

    const preview = previewFor(dataset);
    const component = dataset.components[0];
    expect(preview.componentUid).toBe(component.uid);
    expect(preview.entry).toBe(component.uid);
    expect(preview.kind).toBe("native");
    expect(preview.framework).toBe("angular");
    expect(preview.controls).toEqual(["label"]);
    expect(preview.sourceFile).toBe("fixture.ts");
    expect(preview.uid).toBe(DocsIds.componentPreview(component.uid, "Widget"));
  });

  it("replaces existing previews and sorts them by uid", () => {
    const dataset = datasetWith(
      { exampleIds: ["example:two", "example:one"] },
      [
        { uid: "example:one", code: "" },
        { uid: "example:two", code: "" },
      ]
    );
    dataset.componentPreviews = [];

    new PreviewBuilder().process(dataset);

    const uids = dataset.componentPreviews.map((preview) => preview.uid);
    expect(uids).toEqual([...uids].sort((a, b) => a.localeCompare(b)));
  });
});
