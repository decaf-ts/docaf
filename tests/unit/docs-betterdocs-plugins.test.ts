import fs from "node:fs";
import path from "node:path";
import { CategoryPlugin } from "../../src/generator/betterdocs/CategoryPlugin";
import { ComponentPlugin } from "../../src/generator/betterdocs/ComponentPlugin";
import { ImportTypePlugin } from "../../src/generator/betterdocs/ImportTypePlugin";
import { LoadPlugin } from "../../src/generator/betterdocs/LoadPlugin";
import { AngularComponentExtractor } from "../../src/generator/extractors/AngularComponentExtractor";
import { GeneratedDocsStore } from "../../src/generator/store";
import { DocletModel, DocTagModel, DocsIds } from "../../src/models";
import { DocsDiagnostics } from "../../src/generator/diagnostics";
import type { DocsSourceContext } from "../../src/generator/types";
import {
  VERTICAL_SLICE,
  contextForFile,
  sourceFileOf,
} from "./support/typescript";

function doclet(
  name: string,
  options: Partial<DocletModel> = {}
): DocletModel {
  const model = new DocletModel({
    uid: DocsIds.doclet("plugin-fixture", name),
    name,
    longname: `plugin-fixture.${name}`,
    kind: "class",
  });
  Object.assign(model, options);
  return model;
}

describe("BetterDocs CategoryPlugin", () => {
  it("maps category and subcategory tags onto the doclet", () => {
    const target = doclet("Categorized");
    const tags: DocTagModel[] = [
      new DocTagModel({ uid: "tag:1", ownerUid: target.uid, name: "category", value: "Adapters" }),
      new DocTagModel({ uid: "tag:2", ownerUid: target.uid, name: "subcategory", value: "Memory" }),
    ];
    new CategoryPlugin(() => tags).newDoclet(target);
    expect(target.category).toBe("Adapters");
    expect(target.subCategory).toBe("Memory");
  });

  it("leaves doclets without tags untouched", () => {
    const target = doclet("Plain");
    new CategoryPlugin(() => []).newDoclet(target);
    expect(target.category).toBeUndefined();
    expect(target.subCategory).toBeUndefined();
  });
});

describe("BetterDocs LoadPlugin", () => {
  const context = contextForFile(path.join(VERTICAL_SLICE, "adapter.ts"));
  const loadTag = (value: string): DocTagModel =>
    new DocTagModel({ uid: "tag:load", ownerUid: "doclet:load", name: "load", value });

  it("appends loaded markdown to the doclet and caches the content", () => {
    const cache = new Map<string, string>();
    const plugin = new LoadPlugin({
      allowedRoots: [VERTICAL_SLICE],
      resolveTags: () => [loadTag("./adapter.md")],
      cache,
    });
    const target = doclet("AdapterConfig", {
      description: "Adapter configuration.",
      kind: "interface",
    });

    plugin.newDoclet(target, context);

    expect(target.description).toContain("Adapter configuration.");
    expect(target.description).toContain("Loaded from `@load` during extraction.");
    expect(target.metadata?.load).toContain("# Adapter configuration");
    expect(cache.size).toBe(1);
  });

  it("reports missing files as a build diagnostic", () => {
    const diagnostics = new DocsDiagnostics();
    const plugin = new LoadPlugin({
      allowedRoots: [VERTICAL_SLICE],
      resolveTags: () => [loadTag("./does-not-exist.md")],
    });
    plugin.newDoclet(doclet("Missing"), {
      ...context,
      diagnostics,
    });

    expect(diagnostics.errors).toHaveLength(1);
    expect(diagnostics.errors[0]).toMatchObject({
      code: "DOCAF_LOAD_MISSING",
      severity: "error",
    });
  });

  it("rejects paths that escape the allowed roots", () => {
    const diagnostics = new DocsDiagnostics();
    const plugin = new LoadPlugin({
      allowedRoots: [VERTICAL_SLICE],
      resolveTags: () => [loadTag("../../../../etc/passwd")],
    });
    plugin.newDoclet(doclet("Traversal"), {
      ...context,
      diagnostics,
    });

    expect(diagnostics.errors[0]).toMatchObject({
      code: "DOCAF_LOAD_TRAVERSAL",
    });
  });

  it("ignores doclets without a load tag", () => {
    const diagnostics = new DocsDiagnostics();
    const plugin = new LoadPlugin({ allowedRoots: [VERTICAL_SLICE] });
    const target = doclet("Untagged", { description: "unchanged" });
    plugin.newDoclet(target, { ...context, diagnostics });
    expect(target.description).toBe("unchanged");
    expect(diagnostics.all).toHaveLength(0);
  });

  it("does not re-read a cached file", () => {
    const plugin = new LoadPlugin({
      allowedRoots: [VERTICAL_SLICE],
      resolveTags: () => [loadTag("./adapter.md")],
    });
    const read = jest.spyOn(fs, "readFileSync");
    try {
      plugin.newDoclet(doclet("One"), context);
      plugin.newDoclet(doclet("Two"), context);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      read.mockRestore();
    }
  });
});

describe("BetterDocs ImportTypePlugin", () => {
  const context = (source: string): DocsSourceContext => {
    const filename = path.join(VERTICAL_SLICE, "adapter.ts");
    const base = contextForFile(filename);
    return {
      ...base,
      source,
      sourceFile: sourceFileOf(source, filename),
    };
  };

  it("removes @typedef import comments in compat mode", () => {
    const plugin = new ImportTypePlugin({ mode: "compat" });
    const source = [
      "/** @typedef {import('./decorators').ComponentMetadata} ComponentMetadata */",
      "export const value = 1;",
    ].join("\n");
    const target = context(source);
    plugin.beforeParse(target);
    expect(target.source).toBe("\nexport const value = 1;");
  });

  it("accepts resolvable import types in native mode", () => {
    const diagnostics = new DocsDiagnostics();
    const plugin = new ImportTypePlugin({ mode: "native" });
    const target = context(
      "export type Local = import('./decorators').ComponentMetadata;\n"
    );
    target.diagnostics = diagnostics;
    plugin.beforeParse(target);
    expect(diagnostics.all).toHaveLength(0);
  });

  it("reports unresolved import types with a source location", () => {
    const diagnostics = new DocsDiagnostics();
    const plugin = new ImportTypePlugin({ mode: "native" });
    const target = context("export type Missing = import('no-such-module-xyz').Thing;\n");
    target.diagnostics = diagnostics;
    plugin.beforeParse(target);

    expect(diagnostics.errors).toHaveLength(1);
    expect(diagnostics.errors[0]).toMatchObject({
      code: "DOCAF_IMPORT_TYPE_UNRESOLVED",
      severity: "error",
      location: {
        fileName: path.join(VERTICAL_SLICE, "adapter.ts"),
        line: 1,
      },
    });
  });
});

describe("BetterDocs ComponentPlugin", () => {
  const context = contextForFile(path.join(VERTICAL_SLICE, "widget.component.ts"));

  function componentPlugin(
    store: GeneratedDocsStore,
    extractors = [new AngularComponentExtractor()]
  ): ComponentPlugin {
    return new ComponentPlugin({
      store,
      extractors,
      resolveTags: () => [
        new DocTagModel({ uid: "tag:component", ownerUid: "any", name: "component" }),
      ],
    });
  }

  it("extracts and stores a documented component", async () => {
    const store = new GeneratedDocsStore();
    const target = doclet("DocWidgetComponent");
    await componentPlugin(store).newDoclet(target, context);

    expect(target.kind).toBe("class");
    expect(target.componentId).toBe(
      "component:angular:widget.component.ts#DocWidgetComponent"
    );
    expect(target.metadata).toMatchObject({
      component: "true",
      componentFramework: "angular",
    });

    const components = store.get("components");
    expect(components).toHaveLength(1);
    expect((components[0] as { selector?: string }).selector).toBe("doc-widget");
    expect(store.get("componentProperties")).toHaveLength(2);
    expect(store.get("componentEvents")).toHaveLength(1);
  });

  it("ignores doclets without the component tag", async () => {
    const store = new GeneratedDocsStore();
    const plugin = new ComponentPlugin({
      store,
      extractors: [new AngularComponentExtractor()],
      resolveTags: () => [],
    });
    await plugin.newDoclet(doclet("Plain"), context);
    expect(store.size()).toBe(0);
  });

  it("reports a missing declaration", async () => {
    const diagnostics: DocsDiagnostics = new DocsDiagnostics();
    const store = new GeneratedDocsStore();
    await componentPlugin(store).newDoclet(doclet("Missing"), {
      ...context,
      diagnostics,
    });
    expect(diagnostics.errors[0]).toMatchObject({
      code: "DOCAF_COMPONENT_DECLARATION_MISSING",
    });
  });

  it("reports a missing extractor", async () => {
    const diagnostics = new DocsDiagnostics();
    const store = new GeneratedDocsStore();
    await componentPlugin(store, []).newDoclet(doclet("DocWidgetComponent"), {
      ...context,
      diagnostics,
    });
    expect(diagnostics.errors[0]).toMatchObject({
      code: "DOCAF_COMPONENT_EXTRACTOR_MISSING",
    });
  });
});
