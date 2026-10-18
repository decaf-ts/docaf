import {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPropertyModel,
  DocExampleModel,
  DocParameterModel,
  DocReferenceModel,
  DocSourceModel,
  DocTagModel,
  DocTutorialModel,
  DocletModel,
  DocsIds,
} from "../../src/models";
import type { PublicationDataset } from "../../src/publisher/dataset";
import { DocletPruner } from "../../src/publisher/DocletPruner";
import { DocletSorter } from "../../src/publisher/DocletSorter";
import {
  SignatureBuilder,
  composeSignature,
  getSignatureAttributes,
  needsSignature,
} from "../../src/publisher/SignatureBuilder";
import { LinkRegistry } from "../../src/publisher/LinkRegistry";
import {
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
  NavigationBuilder,
} from "../../src/publisher/NavigationBuilder";
import { PageBuilder } from "../../src/publisher/PageBuilder";
import { SearchIndexBuilder } from "../../src/publisher/SearchIndexBuilder";
import { SourcePublisher } from "../../src/publisher/SourcePublisher";
import {
  TutorialBuilder,
  tutorialDoclets,
} from "../../src/publisher/TutorialBuilder";
import { ModuleResolver } from "../../src/publisher/ModuleResolver";

const PACKAGE = "pub-fixture";

function doclet(
  name: string,
  kind: string,
  options: Partial<DocletModel> & { uid?: string } = {}
): DocletModel {
  const uid = options.uid ?? DocsIds.doclet(PACKAGE, name);
  return new DocletModel({
    uid,
    name,
    longname: options.longname ?? `${PACKAGE}.${name}`,
    kind,
    package: PACKAGE,
    ...options,
  } as never);
}

function member(
  owner: DocletModel,
  name: string,
  order: number,
  options: Partial<DocletModel> = {}
): DocletModel {
  return new DocletModel({
    uid: `${owner.uid}#${name}:${order}`,
    name,
    longname: `${owner.longname}.${name}`,
    kind: "function",
    package: PACKAGE,
    memberof: owner.longname,
    memberofUid: owner.uid,
    scope: "instance",
    order,
    ...options,
  } as never);
}

function dataset(): PublicationDataset {
  const alpha = doclet("Alpha", "class", {
    description: "Alpha class\nSecond line.",
    classdesc: "Alpha class\nSecond line.",
    summary: "Alpha class",
    category: "Core",
    subCategory: "Base",
    order: 0,
    sourceId: DocsIds.source(PACKAGE, "alpha.ts", 10, 1),
    exampleIds: [DocsIds.example(DocsIds.doclet(PACKAGE, "Alpha"), 0)],
  });
  const beta = doclet("Beta", "interface", {
    description: "Beta contract.",
    category: "Core",
    subCategory: "Contracts",
    order: 1,
  });
  const gamma = doclet("Gamma", "function", {
    description: "Gamma function.",
    order: 2,
  });
  const widget = doclet("Widget", "class", {
    description: "Widget component.",
    category: "Widgets",
    subCategory: "Angular",
    componentId: "component:angular:widget.ts#Widget",
    order: 3,
    sourceId: DocsIds.source(PACKAGE, "widget.ts", 5, 1),
  });
  const child = doclet("Child", "class", {
    description: "Child class.",
    category: "Core",
    subCategory: "Base",
    augments: ["Parent"],
    implements: ["Beta"],
    order: 4,
  });
  const parent = doclet("Parent", "class", {
    description: "Parent class.",
    category: "Core",
    subCategory: "Base",
    order: 5,
  });
  const global = doclet("VERSION", "constant", {
    description: "Version constant.",
    order: 6,
    type: "string",
  });
  const moduleSymbol = doclet("kernel", "module", {
    description: "Kernel module.",
    order: 7,
  });
  const alphaRun = member(alpha, "run", 0, {
    description: "Runs Alpha.",
    async: true,
  });
  const alphaRunOverload = member(alpha, "run", 1, {
    description: "Runs Alpha with options.",
  });
  const childRun = member(child, "run", 0, {
    description: "Runs Child.",
  });
  const parentRun = member(parent, "run", 0, {
    description: "Runs Parent.",
  });
  const privateMember = member(alpha, "secret", 2, {
    description: "Secret.",
    access: "private",
  });

  const widgetUid = widget.componentId!;
  const property = new DocComponentPropertyModel({
    uid: DocsIds.componentProperty(widgetUid, "label"),
    componentUid: widgetUid,
    name: "label",
    kind: "input",
  });
  const event = new DocComponentEventModel({
    uid: DocsIds.componentEvent(widgetUid, "changed"),
    componentUid: widgetUid,
    name: "changed",
  });
  const component = new DocComponentModel({
    uid: widgetUid,
    docletUid: widget.uid,
    framework: "angular",
    name: "Widget",
    exportName: "Widget",
    sourceFile: "widget.ts",
    selector: "pub-widget",
    standalone: true,
    propertyUids: [property.uid],
    eventUids: [event.uid],
    previewUids: [],
  });

  const tags = [
    new DocTagModel({
      uid: DocsIds.tag(alphaRun.uid, "param", 0),
      ownerUid: alphaRun.uid,
      name: "param",
      value: "{string} input the input",
      originalValue: "input",
      kind: "param",
    }),
    new DocTagModel({
      uid: DocsIds.tag(alphaRun.uid, "return", 1),
      ownerUid: alphaRun.uid,
      name: "return",
      value: "{number} the result",
      kind: "return",
    }),
    new DocTagModel({
      uid: DocsIds.tag(gamma.uid, "see", 0),
      ownerUid: gamma.uid,
      name: "see",
      value: "Alpha",
      kind: "see",
    }),
  ];

  const tutorial = new DocTutorialModel({
    uid: DocsIds.tutorial("guide"),
    name: "guide",
    title: "Guide",
    description: "A guide.",
    content: "# Guide",
    order: 0,
    childUids: [],
    docletUids: [alpha.uid],
  });

  const sources = [
    new DocSourceModel({
      uid: DocsIds.source(PACKAGE, "alpha.ts", 10, 1),
      package: PACKAGE,
      fileName: "src\\alpha.ts",
    }),
    new DocSourceModel({
      uid: DocsIds.source(PACKAGE, "widget.ts", 5, 1),
      package: PACKAGE,
      fileName: "widget.ts",
    }),
  ];

  const examples = [
    new DocExampleModel({
      uid: DocsIds.example(alpha.uid, 0),
      ownerUid: alpha.uid,
      index: 0,
      code: "new Alpha()",
    }),
  ];

  return {
    doclets: [
      alpha,
      beta,
      gamma,
      widget,
      child,
      parent,
      global,
      moduleSymbol,
      alphaRun,
      alphaRunOverload,
      childRun,
      parentRun,
      privateMember,
    ],
    tags,
    types: [],
    parameters: [],
    returns: [],
    signatures: [],
    examples,
    sources,
    references: [],
    components: [component],
    componentProperties: [property],
    componentEvents: [event],
    componentPreviews: [],
    tutorials: [tutorial],
  };
}

describe("DocletPruner", () => {
  it("drops undocumented, private, ignored and internal doclets by default", () => {
    const base = dataset().doclets[0];
    const candidate = (
      name: string,
      options: Partial<DocletModel>
    ): DocletModel => {
      const model = new DocletModel({
        uid: DocsIds.doclet(PACKAGE, name),
        name,
        longname: `${PACKAGE}.${name}`,
        kind: options.kind ?? "class",
        ...options,
      } as never);
      return model;
    };
    const pruner = new DocletPruner();
    const kept = pruner.prune([
      base,
      candidate("Private", { access: "private" }),
      candidate("Undocumented", { metadata: { undocumented: "true" } }),
      candidate("Ignored", { metadata: { ignore: "true" } }),
      candidate("Internal", { metadata: { internal: "true" } }),
      candidate("Exported", { metadata: { exported: "false" } }),
      candidate("Package", { kind: "package" }),
      candidate("File", { kind: "file" }),
    ]);

    expect(kept.map((doclet) => doclet.name)).toEqual(["Alpha"]);
  });

  it("keeps private, internal and undocumented doclets when configured", () => {
    const pruner = new DocletPruner({
      includePrivate: true,
      includeUndocumented: true,
    });
    const kept = pruner.prune([
      new DocletModel({
        uid: "doclet:pkg:Private",
        name: "Private",
        longname: "pkg.Private",
        kind: "class",
        access: "private",
        metadata: { undocumented: "true", internal: "true" },
      }),
    ]);
    expect(kept).toHaveLength(1);
  });
});

describe("DocletSorter", () => {
  it("orders by longname, version, since and uid", () => {
    const make = (
      name: string,
      options: Partial<DocletModel>
    ): DocletModel =>
      new DocletModel({
        uid: options.uid ?? `doclet:pkg:${name}`,
        name,
        longname: "pkg.Same",
        kind: "class",
        ...options,
      });
    const sorted = new DocletSorter().sort([
      make("a", { uid: "doclet:pkg:b", version: "2.0.0" }),
      make("b", { uid: "doclet:pkg:a", since: "2.0.0" }),
      make("c", { uid: "doclet:pkg:c", since: "1.0.0" }),
      make("d", { uid: "doclet:pkg:d", version: "1.0.0" }),
      new DocletModel({
        uid: "doclet:pkg:earlier",
        name: "earlier",
        longname: "pkg.Aardvark",
        kind: "class",
      }),
    ]);
    expect(sorted.map((doclet) => doclet.longname)).toEqual([
      "pkg.Aardvark",
      "pkg.Same",
      "pkg.Same",
      "pkg.Same",
      "pkg.Same",
    ]);
    expect(sorted.slice(1).map((doclet) => doclet.uid)).toEqual([
      "doclet:pkg:c",
      "doclet:pkg:a",
      "doclet:pkg:d",
      "doclet:pkg:b",
    ]);
  });
});

describe("SignatureBuilder", () => {
  it("decides which doclets need signatures", () => {
    expect(needsSignature(doclet("Fn", "function"))).toBe(true);
    expect(needsSignature(doclet("Klass", "class"))).toBe(true);
    expect(needsSignature(doclet("Ctor", "constructor"))).toBe(true);
    expect(needsSignature(doclet("Member", "member"))).toBe(false);
    expect(
      needsSignature(
        new DocletModel({
          uid: "doclet:pkg:Callback",
          name: "Callback",
          longname: "pkg.Callback",
          kind: "typedef",
          type: "string | function",
        })
      )
    ).toBe(true);
  });

  it("formats signature attributes", () => {
    expect(getSignatureAttributes({ optional: true, nullable: true })).toEqual([
      "opt",
      "nullable",
    ]);
    expect(getSignatureAttributes({ nullable: false })).toEqual(["non-null"]);
    expect(getSignatureAttributes({})).toEqual([]);
  });

  it("builds parameters, returns and signature text from tags", () => {
    const data = dataset();
    new SignatureBuilder().process(data);
    const alphaRun = data.doclets.find(
      (doclet) => doclet.uid === `${DocsIds.doclet(PACKAGE, "Alpha")}#run:0`
    )!;
    const signatureUid = DocsIds.signature(alphaRun.uid, 0);
    const signature = data.signatures.find(
      (candidate) => candidate.uid === signatureUid
    )!;

    expect(signature).toMatchObject({
      docletUid: alphaRun.uid,
      kind: "function",
      name: "run",
      signatureText: "async run(input: string): number",
      parametersText: "input: string",
      async: true,
    });
    expect(alphaRun.signatureIds).toEqual([signatureUid]);

    const parameters = data.parameters.filter(
      (parameter) => parameter.signatureUid === signatureUid
    );
    expect(parameters).toHaveLength(1);
    expect(parameters[0]).toMatchObject({
      name: "input",
      typeText: "string",
      optional: false,
      rest: false,
      description: "the input",
    });
    const returns = data.returns.find(
      (candidate) => candidate.signatureUid === signatureUid
    )!;
    expect(returns).toMatchObject({
      typeText: "number",
      description: "the result",
    });
    expect(signature.returnId).toBe(returns.uid);
    expect(signature.typeIds).toHaveLength(2);
  });

  it("keeps existing structured parameters and return records", () => {
    const data = dataset();
    const alphaRun = data.doclets.find(
      (doclet) => doclet.uid === `${DocsIds.doclet(PACKAGE, "Alpha")}#run:0`
    )!;
    const signatureUid = DocsIds.signature(alphaRun.uid, 0);
    const parameter = new DocParameterModel({
      uid: DocsIds.parameter(signatureUid, 0),
      signatureUid,
      name: "existing",
      index: 0,
      typeText: "boolean",
      optional: true,
      rest: false,
    });
    data.parameters.push(parameter);
    new SignatureBuilder().process(data);

    const signature = data.signatures.find(
      (candidate) => candidate.uid === signatureUid
    )!;
    expect(signature.parameterIds).toEqual([parameter.uid]);
    expect(signature.signatureText).toBe(
      "async run(existing?: boolean): number"
    );
    expect(data.parameters.filter((entry) => entry.signatureUid === signatureUid)).toHaveLength(
      1
    );
  });

  it("composes signatures with modifiers", () => {
    const parameter = new DocParameterModel({
      uid: "parameter:1",
      signatureUid: "signature:1",
      name: "value",
      index: 0,
      typeText: "string",
      rest: true,
      optional: false,
    });
    expect(
      composeSignature("run", "function", [parameter], "void", [
        "static",
        "async",
      ])
    ).toEqual({
      signatureText: "static async run(...value: string): void",
      parametersText: "...value: string",
    });
    expect(
      composeSignature("Widget", "class", [], undefined, [])
    ).toEqual({ signatureText: "Widget()", parametersText: "" });
  });
});

describe("LinkRegistry", () => {
  it("registers page routes, legacy routes and member anchors", () => {
    const data = dataset();
    const registry = new LinkRegistry();
    const registration = registry.register(data.doclets);

    const alpha = data.doclets.find((doclet) => doclet.name === "Alpha")!;
    const target = registry.resolve(alpha.longname)!;
    expect(target.route).toBe("/docs/classes/Alpha");
    expect(target.pageUid).toBe(DocsIds.page(alpha.uid));
    expect(registry.href(alpha.longname)).toBe("#/docs/classes/Alpha");

    const run = data.doclets.find(
      (doclet) => doclet.uid === `${alpha.uid}#run:0`
    )!;
    const overload = data.doclets.find(
      (doclet) => doclet.uid === `${alpha.uid}#run:1`
    )!;
    expect(run.anchor).toBe("run");
    expect(overload.anchor).toBe("run-1");
    expect(registry.anchorOf(overload.longname)).toBe("run-1");
    expect(registry.href(overload.longname)).toBe(
      "#/docs/classes/Alpha#run-1"
    );

    const route = registration.routes.find(
      (candidate) => candidate.route === "/docs/classes/Alpha"
    )!;
    expect(route.legacyRoutes).toContain("Alpha.html");
    expect(route.legacyRoutes).toContain("/docs/classes/Alpha");
    expect(route.pageUid).toBe(DocsIds.page(alpha.uid));
    expect(registry.resolve("missing.longname")).toBeUndefined();
    expect(registry.href("missing.longname")).toBeUndefined();
  });

  it("supports history routing and base paths", () => {
    const data = dataset();
    const registry = new LinkRegistry({
      routing: "history",
      basePath: "/manual/",
    });
    registry.register(data.doclets);
    expect(registry.href(`${PACKAGE}.Beta`)).toBe(
      "/manual/docs/interfaces/Beta"
    );
  });
});

describe("NavigationBuilder", () => {
  it("classifies roots, components, modules and globals", () => {
    const builder = new NavigationBuilder();
    const classified = builder.classify(dataset().doclets);

    expect(classified.classes.map((doclet) => doclet.name)).toEqual([
      "Alpha",
      "Child",
      "Parent",
    ]);
    expect(classified.components.map((doclet) => doclet.name)).toEqual([
      "Widget",
    ]);
    expect(classified.interfaces.map((doclet) => doclet.name)).toEqual([
      "Beta",
    ]);
    expect(classified.modules.map((doclet) => doclet.name)).toEqual([
      "kernel",
    ]);
    expect(classified.globals.map((doclet) => doclet.name)).toEqual([
      "Gamma",
      "VERSION",
    ]);
    expect(
      classified.classes.some((doclet) => doclet.name === "secret")
    ).toBe(false);
  });

  it("builds root, category, group and subcategory navigation", () => {
    const data = dataset();
    const links = new LinkRegistry();
    links.register(data.doclets);
    const items = new NavigationBuilder({ links }).buildNav(
      data.doclets,
      NAV_GROUP_ORDER
    );

    const root = items[0];
    expect(root).toMatchObject({
      uid: "navigation-item:main:root",
      label: "Documentation",
      kind: "root",
      parentUid: undefined,
      order: 0,
      navigationUid: DocsIds.navigation("main"),
    });
    for (const item of items) {
      expect(item.navigationUid).toBe(DocsIds.navigation("main"));
      expect(item.uid.startsWith("navigation-item:main:")).toBe(true);
    }
    expect(items.find((item) => item.label === "Core")?.kind).toBe("category");
    expect(items.find((item) => item.label === "Classes")?.kind).toBe("group");
    expect(items.find((item) => item.label === "Components")?.kind).toBe(
      "group"
    );
    expect(items.find((item) => item.label === "Base")?.kind).toBe(
      "subcategory"
    );
    expect(items.find((item) => item.label === "Contracts")?.kind).toBe(
      "subcategory"
    );

    const alphaItem = items.find(
      (item) =>
        item.docletUid === DocsIds.doclet(PACKAGE, "Alpha")
    )!;
    expect(alphaItem).toMatchObject({
      label: "Alpha",
      kind: "class",
      route: "/docs/classes/Alpha",
      anchor: undefined,
      pageUid: undefined,
    });
    for (const item of items) {
      for (const child of item.childUids) {
        expect(items.some((candidate) => candidate.uid === child)).toBe(true);
      }
    }
    expect(new Set(items.map((item) => item.order)).size).toBe(items.length);
  });

  it("normalizes the canonical navigation root to the main root UID", () => {
    const data = dataset();
    const links = new LinkRegistry();
    links.register(data.doclets);
    const builder = new NavigationBuilder({ links });
    const main = builder.buildNav(data.doclets, NAV_GROUP_ORDER, "main");
    const canonical = builder.buildNav(
      data.doclets,
      NAV_GROUP_ORDER,
      "navigation:main"
    );

    expect(canonical[0].uid).toBe(main[0].uid);
    expect(canonical[0].uid).toBe("navigation-item:main:root");
    expect(canonical[0].navigationUid).toBe("navigation:main");
  });

  it("adds tutorials first and honours longname labels", () => {
    const data = dataset();
    const links = new LinkRegistry();
    links.register(data.doclets);
    const items = new NavigationBuilder({
      links,
      useLongnameInNav: true,
    }).buildNav(data.doclets, ["tutorials", "classes"], "docs", [
      {
        uid: DocsIds.tutorial("guide"),
        name: "guide",
        title: "Guide",
        route: "/tutorials/guide",
      },
    ]);

    expect(NAV_GROUP_LABELS.tutorials).toBe("Tutorials");
    const tutorialGroup = items.find((item) => item.label === "Tutorials")!;
    expect(tutorialGroup.kind).toBe("group");
    const tutorialItem = items.find((item) => item.label === "Guide")!;
    expect(tutorialItem).toMatchObject({
      kind: "tutorial",
      route: "/tutorials/guide",
      docletUid: undefined,
    });
    const alpha = items.find(
      (item) => item.docletUid === DocsIds.doclet(PACKAGE, "Alpha")
    )!;
    expect(alpha.label).toBe(`${PACKAGE}.Alpha`);
  });
});

describe("PageBuilder", () => {
  it("publishes home, symbol, component, global and tutorial pages", () => {
    const data = dataset();
    new SignatureBuilder().process(data);
    const links = new LinkRegistry();
    links.register(data.doclets);

    const publication = new PageBuilder().build(data, links);
    const pageFor = (name: string) =>
      publication.pages.find(
        (page) => page.uid === DocsIds.page(DocsIds.doclet(PACKAGE, name))
      );

    const home = publication.pages[0];
    expect(home).toMatchObject({
      uid: "page:home",
      kind: "home",
      route: "/",
      order: -1,
      layoutId: DocsIds.layout("docs.layout.home"),
    });
    expect(publication.pages.map((page) => page.uid)).toContain("page:home");
    expect(pageFor("Alpha")).toMatchObject({
      kind: "class",
      route: "/docs/classes/Alpha",
      layoutId: DocsIds.layout("docs.layout.class"),
      routeId: DocsIds.route("/docs/classes/Alpha"),
      navigationUid: "navigation:main",
      order: 0,
    });

    const alphaSections = publication.sections
      .filter((section) => section.pageUid === pageFor("Alpha")!.uid)
      .sort((a, b) => a.order - b.order);
    expect(alphaSections.map((section) => section.key)).toEqual([
      "description",
      "signature",
      "members",
      "examples",
      "source",
    ]);
    expect(alphaSections[0].content).toContain("Alpha class");

    const widget = pageFor("Widget")!;
    expect(widget).toMatchObject({
      kind: "component",
      layoutId: DocsIds.layout("docs.layout.component"),
    });
    const widgetSections = publication.sections
      .filter((section) => section.pageUid === widget.uid)
      .sort((a, b) => a.order - b.order);
    expect(widgetSections.map((section) => section.kind)).toEqual([
      "markdown",
      "signature",
      "component-properties",
      "component-events",
      "source",
    ]);

    const global = publication.pages.find(
      (page) => page.uid === "page:global"
    )!;
    expect(global).toMatchObject({ kind: "global", route: "/docs/global" });
    expect(
      publication.sections.some(
        (section) => section.uid === DocsIds.section("page:global", "globals")
      )
    ).toBe(true);

    const tutorial = publication.pages.find(
      (page) => page.uid === DocsIds.page(DocsIds.tutorial("guide"))
    )!;
    expect(tutorial).toMatchObject({
      kind: "tutorial",
      layoutId: DocsIds.layout("docs.layout.tutorial"),
      route: "/tutorials/guide",
      tutorialUids: [DocsIds.tutorial("guide")],
    });
    expect(
      publication.sections.some(
        (section) =>
          section.pageUid === tutorial.uid && section.key === "content"
      )
    ).toBe(true);

    expect(publication.layouts).toHaveLength(7);
    expect(publication.layouts.map((layout) => layout.name)).toEqual([
      "docs.layout.home",
      "docs.layout.class",
      "docs.layout.component",
      "docs.layout.interface",
      "docs.layout.tutorial",
      "docs.layout.source",
      "docs.layout.page",
    ]);
    expect(publication.pages.map((page) => page.order)).toEqual(
      [...publication.pages.map((page) => page.order)].sort(
        (a, b) => (a ?? 0) - (b ?? 0)
      )
    );
  });
});

describe("SearchIndexBuilder", () => {
  it("builds ranked, deduplicated entries and tutorial entries", () => {
    const data = dataset();
    data.tutorials[0].route = "/tutorials/guide";
    const links = new LinkRegistry();
    links.register(data.doclets);
    const entries = new SearchIndexBuilder().build(data, links);

    const widget = entries.find(
      (entry) => entry.docletUid === DocsIds.doclet(PACKAGE, "Widget")
    )!;
    expect(widget).toMatchObject({
      kind: "component",
      rank: 9,
      route: "/docs/components/Widget",
      category: "Widgets",
      subCategory: "Angular",
    });
    expect(widget.tokens).toEqual(
      expect.arrayContaining(["widget", "component", "widgets", "angular"])
    );

    const alpha = entries.find(
      (entry) => entry.docletUid === DocsIds.doclet(PACKAGE, "Alpha")
    )!;
    expect(alpha.rank).toBe(8);
    expect(alpha.tokens).toEqual(
      expect.arrayContaining(["alpha", "class", "core", "base"])
    );

    const run = entries.find(
      (entry) => entry.docletUid === `${DocsIds.doclet(PACKAGE, "Alpha")}#run:0`
    )!;
    expect(run).toMatchObject({ rank: 6, anchor: "run-1" });
    expect(run.tokens).toEqual(
      expect.arrayContaining(["run", "input", "string", "number", "result"])
    );
    expect(new Set(run.tokens).size).toBe(run.tokens.length);

    const tutorial = entries.find(
      (entry) => entry.uid === DocsIds.search(DocsIds.tutorial("guide"))
    )!;
    expect(tutorial).toMatchObject({
      kind: "tutorial",
      rank: 6,
      route: "/tutorials/guide",
    });
    expect(tutorial.tokens).toEqual(expect.arrayContaining(["guide"]));

    expect(entries.map((entry) => entry.rank)).toEqual(
      [...entries.map((entry) => entry.rank)].sort((a, b) => b - a)
    );

    const orphanTutorial = new DocTutorialModel({
      uid: DocsIds.tutorial("orphan"),
      name: "orphan",
      title: "Orphan Guide",
      description: "No doclet references this tutorial.",
      content: "# Orphan",
      route: "/tutorials/orphan",
      order: 1,
      childUids: [],
      docletUids: [],
    });
    data.tutorials.push(orphanTutorial);
    const withOrphan = new SearchIndexBuilder().build(data, links);
    const orphanEntry = withOrphan.find(
      (entry) => entry.uid === DocsIds.search(orphanTutorial.uid)
    )!;
    expect(orphanEntry).toBeDefined();
    expect(orphanEntry.docletUid).toBeUndefined();
    expect(orphanEntry).toMatchObject({
      kind: "tutorial",
      name: "orphan",
      rank: 6,
      route: "/tutorials/orphan",
    });
  });
});

describe("SourcePublisher", () => {
  it("normalizes source paths and example defaults", () => {
    const data = dataset();
    new SourcePublisher().process(data);

    const alphaSource = data.sources.find(
      (source) => source.uid === DocsIds.source(PACKAGE, "alpha.ts", 10, 1)
    )!;
    expect(alphaSource.fileName).toBe("src/alpha.ts");
    expect(alphaSource.path).toBe("src/alpha.ts");
    expect(data.examples[0]).toMatchObject({
      caption: "",
      language: "ts",
      escaped: false,
    });
    expect(data.sources.map((source) => source.uid)).toEqual(
      [...data.sources.map((source) => source.uid)].sort()
    );
  });
});

describe("ModuleResolver", () => {
  it("resolves inheritance, implements and overrides", () => {
    const data = dataset();
    new SignatureBuilder().process(data);
    const resolver = new ModuleResolver({ packageName: PACKAGE });
    resolver.resolve(data);

    const child = data.doclets.find((doclet) => doclet.name === "Child")!;
    const parent = data.doclets.find((doclet) => doclet.name === "Parent")!;
    const beta = data.doclets.find((doclet) => doclet.name === "Beta")!;

    expect(child.inherits).toEqual([parent.longname]);
    expect(
      data.references.some(
        (reference) =>
          reference.ownerUid === child.uid &&
          reference.kind === "augments" &&
          reference.targetUid === parent.uid
      )
    ).toBe(true);
    expect(
      data.references.some(
        (reference) =>
          reference.ownerUid === child.uid &&
          reference.kind === "implements" &&
          reference.targetUid === beta.uid
      )
    ).toBe(true);

    const childRun = data.doclets.find(
      (doclet) => doclet.uid === `${child.uid}#run:0`
    )!;
    expect(childRun.overrides).toEqual([`${parent.longname}.run`]);
    expect(
      data.references.some(
        (reference) =>
          reference.ownerUid === childRun.uid &&
          reference.kind === "overrides"
      )
    ).toBe(true);
    expect(child.referenceIds).toEqual(
      expect.arrayContaining(
        data.references
          .filter((reference) => reference.ownerUid === child.uid)
          .map((reference) => reference.uid)
      )
    );
  });

  it("reuses an existing implements reference and upgrades it to the resolved target", () => {
    const data = dataset();
    new SignatureBuilder().process(data);
    const child = data.doclets.find((doclet) => doclet.name === "Child")!;
    const beta = data.doclets.find((doclet) => doclet.name === "Beta")!;

    data.references.push(
      new DocReferenceModel({
        uid: DocsIds.reference(child.uid, "Beta", "implements", 0),
        ownerUid: child.uid,
        index: 0,
        kind: "implements",
        targetLongname: "Beta",
      })
    );

    new ModuleResolver({ packageName: PACKAGE }).resolve(data);

    const implementsReferences = data.references.filter(
      (reference) =>
        reference.ownerUid === child.uid &&
        reference.kind === "implements"
    );
    expect(implementsReferences).toHaveLength(1);
    expect(implementsReferences[0]).toMatchObject({
      targetLongname: beta.longname,
      targetUid: beta.uid,
    });
    expect(
      child.referenceIds.filter(
        (uid) => uid === implementsReferences[0].uid
      )
    ).toHaveLength(1);
  });

  it("flags unresolved ancestors and resolves short names", () => {
    const data = dataset();
    const orphan = doclet("Orphan", "class", { augments: ["Missing"] });
    data.doclets.push(orphan);
    data.references.push(
      new DocReferenceModel({
        uid: DocsIds.reference(orphan.uid, "Beta", "see", 0),
        ownerUid: orphan.uid,
        index: 0,
        kind: "see",
        targetLongname: "Beta",
      })
    );

    new ModuleResolver({ packageName: PACKAGE }).resolve(data);

    expect(orphan.metadata).toMatchObject({ "unresolved:Missing": "true" });
    const see = data.references.find(
      (reference) => reference.ownerUid === orphan.uid && reference.kind === "see"
    )!;
    const beta = data.doclets.find((doclet) => doclet.name === "Beta")!;
    expect(see.targetUid).toBe(beta.uid);
  });

  it("attaches module symbols and resolves reference routes through links", () => {
    const data = dataset();
    const moduleDoclet = data.doclets.find(
      (doclet) => doclet.kind === "module"
    )!;
    const resolver = new ModuleResolver({ packageName: PACKAGE });
    resolver.resolve(data);
    expect(moduleDoclet.propertyIds).toEqual([]);

    const links = new LinkRegistry();
    links.register(data.doclets);
    resolver.resolveLinks(data, links);

    const beta = data.doclets.find((doclet) => doclet.name === "Beta")!;
    const routed = data.references.find(
      (reference) => reference.targetUid === beta.uid && reference.route
    )!;
    expect(routed.route).toBe("/docs/interfaces/Beta");
    expect(routed.anchor).toBeUndefined();
  });
});

describe("TutorialBuilder", () => {
  it("builds tutorial hierarchy, routes and doclet links", () => {
    const data = dataset();
    const alpha = data.doclets.find((doclet) => doclet.name === "Alpha")!;
    data.tags.push(
      new DocTagModel({
        uid: DocsIds.tag(alpha.uid, "tutorial", 0),
        ownerUid: alpha.uid,
        name: "tutorial",
        value: "guide",
      })
    );

    const tutorials = new TutorialBuilder({
      basePath: "/manual",
      tutorials: [
        {
          name: "advanced",
          title: "Advanced Guide",
          description: "Advanced topics.",
          content: "# Advanced",
          parentName: "guide",
          order: 2,
        },
      ],
    }).build(data);

    const guide = tutorials.find((tutorial) => tutorial.name === "guide")!;
    const advanced = tutorials.find(
      (tutorial) => tutorial.name === "advanced"
    )!;
    expect(guide.route).toBeUndefined();
    expect(advanced).toMatchObject({
      title: "Advanced Guide",
      route: "/manual/tutorials/advanced",
      parentUid: guide.uid,
      order: 2,
    });
    expect(guide.childUids).toEqual([advanced.uid]);
    expect(guide.docletUids).toContain(alpha.uid);
    expect(alpha.tutorialIds).toContain(guide.uid);
    expect(tutorials.map((tutorial) => tutorial.name)).toEqual([
      "advanced",
      "guide",
    ]);
    expect(tutorialDoclets(data.doclets)).toEqual([]);
  });
});
