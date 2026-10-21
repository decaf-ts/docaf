jest.mock("@angular/core", () => {
  const decorator = () => () => undefined;
  class InjectionToken {
    constructor(public readonly description: string) {}
  }
  return {
    Component: decorator,
    Directive: decorator,
    Injectable: decorator,
    Inject: decorator,
    Input: decorator,
    Output: decorator,
    ViewChild: decorator,
    InjectionToken,
  };
});

jest.mock("@angular/common", () => ({
  CommonModule: class CommonModule {},
}));

jest.mock("@angular/router", () => ({
  RouterLink: class RouterLink {},
  Router: class Router {},
  NavigationEnd: class NavigationEnd {},
}));

jest.mock("@decaf-ts/for-angular", () => {
  class LayoutComponent {}
  class ComponentRendererComponent {}
  class NgxRenderingEngine {}
  return { LayoutComponent, ComponentRendererComponent, NgxRenderingEngine };
});

import {
  DocsBlockBase,
  DocsBodyLayoutComponent,
  DocsBrandComponent,
  DocsBreadcrumbsComponent,
  DocsChildrenComponent,
  DocsClassPageComponent,
  DocsCodeComponent,
  DocsComponentMetadataComponent,
  DocsComponentPageComponent,
  DocsExamplesComponent,
  DocsFooterComponent,
  DocsGenericPageComponent,
  DocsHeaderComponent,
  DocsHomePageComponent,
  DocsLinkComponent,
  DocsMembersComponent,
  DocsNavigationItemsComponent,
  DocsNavTreeComponent,
  DocsParametersComponent,
  DocsPreviewComponent,
  DocsRelatedComponent,
  DocsReturnsComponent,
  DocsSearchComponent,
  DocsSectionsComponent,
  DocsSidebarComponent,
  DocsSignatureComponent,
  DocsSiteLayoutComponent,
  DocsSourceComponent,
  DocsSourcePageComponent,
  DocsSymbolComponent,
  DocsTextComponent,
  DocsTocComponent,
  DocsTutorialComponent,
  DocsTutorialPageComponent,
} from "../../src/for-angular/components";
import type { DocsFieldDefinition } from "../../src/for-angular/components";
import { DocsElements, type DocsSectionEntry } from "../../src/ui";

const COMPONENT_CLASSES = {
  DocsBodyLayoutComponent,
  DocsBrandComponent,
  DocsBreadcrumbsComponent,
  DocsChildrenComponent,
  DocsClassPageComponent,
  DocsCodeComponent,
  DocsComponentMetadataComponent,
  DocsComponentPageComponent,
  DocsExamplesComponent,
  DocsFooterComponent,
  DocsGenericPageComponent,
  DocsHeaderComponent,
  DocsHomePageComponent,
  DocsLinkComponent,
  DocsMembersComponent,
  DocsNavigationItemsComponent,
  DocsNavTreeComponent,
  DocsParametersComponent,
  DocsPreviewComponent,
  DocsRelatedComponent,
  DocsReturnsComponent,
  DocsSearchComponent,
  DocsSectionsComponent,
  DocsSidebarComponent,
  DocsSignatureComponent,
  DocsSiteLayoutComponent,
  DocsSourceComponent,
  DocsSourcePageComponent,
  DocsSymbolComponent,
  DocsTextComponent,
  DocsTocComponent,
  DocsTutorialComponent,
  DocsTutorialPageComponent,
};

function field(
  tag: string,
  values: Partial<DocsFieldDefinition> = {}
): DocsFieldDefinition {
  return { tag, ...values };
}

function namedField(
  name: string,
  value: unknown,
  tag = DocsElements.TEXT
): DocsFieldDefinition {
  return { tag, props: { name }, value };
}

class InspectableGenericPage extends DocsGenericPageComponent {
  get resolvedKind(): string {
    return this.pageKind;
  }

  get projectedBlocks(): DocsFieldDefinition[] {
    return this.contentBlocks;
  }
}

describe("dedicated docs Angular components", () => {
  it.each(Object.entries(COMPONENT_CLASSES))(
    "%s is a concrete DocsBlockBase component",
    (_name, component) => {
      expect(typeof component).toBe("function");
      expect(component.prototype).toBeInstanceOf(DocsBlockBase);
    }
  );

  it("builds site, body and page chrome from semantic child slots", () => {
    const site = new DocsSiteLayoutComponent();
    site.children = [
      field(DocsElements.HEADER),
      field(DocsElements.BODY_LAYOUT),
      field(DocsElements.FOOTER),
    ];
    expect(site.headerBlock?.tag).toBe(DocsElements.HEADER);
    expect(site.bodyBlock?.tag).toBe(DocsElements.BODY_LAYOUT);
    expect(site.footerBlock?.tag).toBe(DocsElements.FOOTER);

    const body = new DocsBodyLayoutComponent();
    body.children = [
      field(DocsElements.SIDEBAR),
      field(DocsElements.PAGE_LAYOUT),
      field(DocsElements.TOC),
    ];
    expect(body.sidebarBlock?.tag).toBe(DocsElements.SIDEBAR);
    expect(body.contentBlock?.tag).toBe(DocsElements.PAGE_LAYOUT);
    expect(body.tocBlock?.tag).toBe(DocsElements.TOC);

    const withoutToc = new DocsBodyLayoutComponent();
    withoutToc.children = [field(DocsElements.PAGE_LAYOUT)];
    expect(withoutToc.tocBlock).toBeUndefined();

    const classPage = new DocsClassPageComponent();
    classPage.children = [
      field(DocsElements.BREADCRUMBS),
      field(DocsElements.SYMBOL),
      field(DocsElements.SECTIONS),
      field(DocsElements.RELATED),
      field(DocsElements.PREVIEW),
      field(DocsElements.TUTORIAL),
      field(DocsElements.SOURCE),
      field(DocsElements.CODE),
    ];
    expect(classPage.breadcrumbsBlock?.tag).toBe(DocsElements.BREADCRUMBS);
    expect(classPage.symbolBlock?.tag).toBe(DocsElements.SYMBOL);
    expect(classPage.sectionsBlock?.tag).toBe(DocsElements.SECTIONS);
    expect(classPage.relatedBlock?.tag).toBe(DocsElements.RELATED);
    expect(classPage.previewBlock?.tag).toBe(DocsElements.PREVIEW);
    expect(classPage.tutorialBlock?.tag).toBe(DocsElements.TUTORIAL);
    expect(classPage.sourceBlock?.tag).toBe(DocsElements.SOURCE);
    expect(classPage.extraBlocks.map((block) => block.tag)).toEqual([
      DocsElements.CODE,
    ]);
  });

  it("reads the scalar page kind and exposes the dispatch slots of the generic page", () => {
    const home = new InspectableGenericPage();
    home.children = [
      namedField("kind", "HOME"),
      field(DocsElements.SYMBOL),
      field(DocsElements.SECTIONS),
    ];
    expect(home.resolvedKind).toBe("home");
    expect(home.breadcrumbsBlock).toBeUndefined();
    expect(home.previewBlock).toBeUndefined();
    expect(home.tutorialBlock).toBeUndefined();
    expect(home.sourceBlock).toBeUndefined();

    for (const kind of ["class", "function", "interface"]) {
      const classLike = new InspectableGenericPage();
      classLike.children = [
        namedField("kind", kind),
        field(DocsElements.BREADCRUMBS),
        field(DocsElements.SYMBOL),
      ];
      expect(classLike.resolvedKind).toBe(kind);
      expect(classLike.breadcrumbsBlock?.tag).toBe(DocsElements.BREADCRUMBS);
      expect(classLike.previewBlock).toBeUndefined();
    }

    const component = new InspectableGenericPage();
    component.children = [
      namedField("kind", "component"),
      field(DocsElements.BREADCRUMBS),
      field(DocsElements.PREVIEW),
    ];
    expect(component.resolvedKind).toBe("component");
    expect(component.previewBlock?.tag).toBe(DocsElements.PREVIEW);
    expect(component.breadcrumbsBlock?.tag).toBe(DocsElements.BREADCRUMBS);

    const tutorial = new InspectableGenericPage();
    tutorial.children = [field(DocsElements.TUTORIAL)];
    expect(tutorial.tutorialBlock?.tag).toBe(DocsElements.TUTORIAL);

    const source = new InspectableGenericPage();
    source.children = [field(DocsElements.SOURCE)];
    expect(source.sourceBlock?.tag).toBe(DocsElements.SOURCE);
  });

  it("keeps the generic fallback blocks and filters the scalar kind pseudo-block", () => {
    const generic = new InspectableGenericPage();
    generic.children = [
      { tag: DocsElements.TEXT, name: "kind", value: "module" },
      { tag: DocsElements.TEXT, props: { name: "kind" }, value: "module" },
      namedField("summary", "Fallback content"),
      field(DocsElements.CODE, { value: "export const value = 1;" }),
    ];

    expect(generic.resolvedKind).toBe("module");
    expect(generic.breadcrumbsBlock).toBeUndefined();
    expect(generic.previewBlock).toBeUndefined();
    expect(generic.tutorialBlock).toBeUndefined();
    expect(generic.sourceBlock).toBeUndefined();
    expect(generic.projectedBlocks.map((block) => block.tag)).toEqual([
      DocsElements.TEXT,
      DocsElements.CODE,
    ]);
    expect(generic.projectedBlocks.map((block) => block.props?.["name"])).toEqual([
      "summary",
      undefined,
    ]);
  });

  it("excludes the scalar kind pseudo-block from page extraBlocks", () => {
    const classPage = new DocsClassPageComponent();
    classPage.children = [
      { tag: DocsElements.TEXT, props: { name: "kind" }, value: "class" },
      field(DocsElements.SYMBOL),
      field(DocsElements.SECTIONS),
      field(DocsElements.CODE),
    ];

    expect(classPage.extraBlocks.map((block) => block.tag)).toEqual([
      DocsElements.CODE,
    ]);
    expect(classPage.symbolBlock?.tag).toBe(DocsElements.SYMBOL);
    expect(classPage.sectionsBlock?.tag).toBe(DocsElements.SECTIONS);
  });

  it("keeps link routes and anchors separate for hash-safe routing", () => {
    const link = new DocsLinkComponent();
    link.value = {
      label: "RamAdapter",
      route: "/docs/classes/RamAdapter",
      anchor: "members",
    };
    expect(link.target).toEqual({
      label: "RamAdapter",
      route: "/docs/classes/RamAdapter",
      anchor: "members",
      href: undefined,
    });

    link.value = { name: "External", href: "https://example.test/docs" };
    expect(link.target).toMatchObject({
      label: "External",
      href: "https://example.test/docs",
    });

    link.value = "Plain text";
    expect(link.target).toEqual({ label: "Plain text" });

    link.value = undefined;
    expect(link.target).toEqual({ label: "" });
  });

  it("defaults the brand route to the docs root and reads overrides", () => {
    const brand = new DocsBrandComponent();
    expect(brand.route).toBe("/");

    brand.children = [
      { tag: DocsElements.LINK, props: { name: "route", route: "/docs" } },
    ];
    expect(brand.route).toBe("/docs");
  });

  it("filters search results case-insensitively and caps them at 20", () => {
    const search = new DocsSearchComponent();
    search.items = [
      { uid: "a", name: "RamAdapter", kind: "class", summary: "Memory adapter" },
      { uid: "b", name: "DocWidgetComponent", kind: "component" },
      {
        uid: "c",
        name: "Renderer",
        kind: "class",
        summary: "Widget renderer",
      },
      null,
      "not-an-entry",
    ];

    expect(search.results).toEqual([]);

    search.update("WIDGET");
    expect(search.results.map((entry) => entry.uid)).toEqual(["b", "c"]);

    search.update("  ram  ");
    expect(search.results.map((entry) => entry.uid)).toEqual(["a"]);

    search.update("missing");
    expect(search.results).toEqual([]);

    const bulk = Array.from({ length: 25 }, (_, index) => ({
      uid: `entry:${index}`,
      name: `Widget ${index}`,
      kind: "component",
    }));
    search.items = bulk;
    search.update("widget");
    expect(search.results).toHaveLength(20);
    expect(search.results[0].uid).toBe("entry:0");
  });

  it("renders the table of contents title and anchored entries", () => {
    const toc = new DocsTocComponent();
    expect(toc.title).toBe("On this page");
    expect(toc.entries).toEqual([]);

    toc.children = [namedField("title", "Contents", DocsElements.HEADING)];
    toc.items = [
      { label: "Install", anchor: "install", level: 2 },
      { label: "Usage", anchor: "usage", level: 3 },
      null,
    ];
    expect(toc.title).toBe("Contents");
    expect(toc.entries).toEqual([
      { label: "Install", anchor: "install", level: 2 },
      { label: "Usage", anchor: "usage", level: 3 },
    ]);
  });

  it("strips code fences and applies syntax treatment in DocsCodeComponent", () => {
    const code = new DocsCodeComponent();
    code.code = "```typescript\nconst answer: number = 42;\n```";
    code.language = "TypeScript";

    expect(code.languageLabel).toBe("typescript");
    expect(code.highlighted).not.toContain("```");
    expect(code.highlighted).toContain(
      '<span class="docs-tok-keyword">const</span>'
    );
    expect(code.highlighted).toContain('<span class="docs-tok-number">42</span>');

    const plain = new DocsCodeComponent();
    plain.code = "read(key: string): unknown";
    expect(plain.languageLabel).toBe("ts");
    expect(plain.highlighted).not.toContain("```");
    expect(plain.highlighted).toContain(
      '<span class="docs-tok-function">read</span>'
    );
  });

  it("copies code through the clipboard and resets the copied flag", async () => {
    const writeText = jest.fn(async () => undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });
    jest.useFakeTimers();
    try {
      const code = new DocsCodeComponent();
      code.code = "const value = 1;";

      await code.copy();
      expect(writeText).toHaveBeenCalledWith("const value = 1;");
      expect(code.copied).toBe(true);

      jest.advanceTimersByTime(1500);
      expect(code.copied).toBe(false);
    } finally {
      jest.useRealTimers();
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  it("is a no-op when the clipboard is unavailable", async () => {
    const code = new DocsCodeComponent();
    code.code = "const value = 1;";
    await expect(code.copy()).resolves.toBeUndefined();
    expect(code.copied).toBe(false);
  });

  it("generates stable, unique TOC anchors from section markdown", () => {
    const sections = new DocsSectionsComponent();
    sections.items = [
      { uid: "s1", key: "intro", kind: "markdown", content: "## Install" },
    ];
    expect(sections.sections.map((section) => section.uid)).toEqual(["s1"]);
    expect(sections.sectionHtml(sections.sections[0])).toBe(
      '<h2 id="install">Install</h2>'
    );

    const duplicate = sections.sectionHtml({
      content: "## Same heading\n\n## Same heading",
    });
    expect(duplicate).toContain('<h2 id="same-heading">');
    expect(duplicate).toContain('<h2 id="same-heading-2">');
    expect(duplicate.match(/id="same-heading"/g)).toHaveLength(1);
  });

  it("exposes symbol metadata and renders the summary as markdown", () => {
    const symbol = new DocsSymbolComponent();
    symbol.children = [
      namedField("title", "RamAdapter"),
      namedField("kind", "class"),
      namedField("category", "Adapters"),
      namedField("summary", "**Memory** adapter"),
      field(DocsElements.CODE, { value: "export class RamAdapter {}" }),
    ];

    expect(symbol.title).toBe("RamAdapter");
    expect(symbol.kind).toBe("class");
    expect(symbol.category).toBe("Adapters");
    expect(symbol.summary).toBe("**Memory** adapter");
    expect(symbol.summaryHtml).toBe(
      "<p><strong>Memory</strong> adapter</p>"
    );
    expect(symbol.extras.map((block) => block.tag)).toEqual([
      DocsElements.CODE,
    ]);
  });

  it("resolves signature details from the section before list values", () => {
    const signature = new DocsSignatureComponent();
    const section = {
      uid: "section:signature",
      key: "signature",
      kind: "signature",
      members: [
        {
          uid: "member:read",
          name: "read",
          kind: "method",
          signature: "read(key: string): unknown",
          description: "Reads a value.",
        },
      ],
      parameters: [{ uid: "parameter:key", name: "key" }],
      returns: [{ uid: "return:value", role: "returns" }],
    } as DocsSectionEntry;
    signature.section = section;

    expect(signature.members).toBe(section.members);
    expect(signature.member?.name).toBe("read");
    expect(signature.signatureText).toBe("read(key: string): unknown");
    expect(signature.description).toBe("Reads a value.");
    expect(signature.parameters).toEqual(section.parameters);
    expect(signature.returns).toEqual(section.returns);

    const fromItems = new DocsSignatureComponent();
    fromItems.items = [
      { uid: "member:write", name: "write", kind: "method", signature: "write()" },
    ];
    expect(fromItems.signatureText).toBe("write()");
  });

  it("groups members by kind with stable labels", () => {
    const members = new DocsMembersComponent();
    members.items = [
      { uid: "m1", name: "read", kind: "method" },
      { uid: "m2", name: "value", kind: "property" },
      { uid: "m3", name: "constructor", kind: "constructor" },
      { uid: "m4", name: "value", kind: "accessor" },
      null,
    ];

    expect(members.members).toHaveLength(4);
    expect(members.groups.map((group) => group.label)).toEqual([
      "Accessors",
      "Constructors",
      "Methods",
      "Properties",
    ]);
    expect(members.groups[2].members.map((member) => member.name)).toEqual([
      "read",
    ]);
  });

  it("filters parameters, returns and examples rows", () => {
    const parameters = new DocsParametersComponent();
    parameters.items = [
      { uid: "p1", name: "key", typeText: "string" },
      null,
    ];
    expect(parameters.parameters.map((entry) => entry.name)).toEqual(["key"]);

    const returns = new DocsReturnsComponent();
    returns.items = [{ uid: "r1", role: "returns", typeText: "unknown" }];
    expect(returns.returns.map((entry) => entry.role)).toEqual(["returns"]);

    const examples = new DocsExamplesComponent();
    examples.items = [
      { uid: "e1", code: "const value = 1;", language: "ts" },
      null,
    ];
    expect(examples.examples.map((entry) => entry.uid)).toEqual(["e1"]);
  });

  it("dispatches source sections to docs-source with the section source entry", () => {
    const sections = new DocsSectionsComponent();
    const source = {
      fileName: "ui/DocsPageService.ts",
      line: 12,
      column: 3,
      repository: "https://example.test/src/ui/DocsPageService.ts",
    };
    sections.items = [
      {
        uid: "section:source",
        key: "source",
        kind: "source",
        title: "Source",
        source,
      },
    ];

    expect(sections.sections).toHaveLength(1);
    expect(sections.sourceValue(sections.sections[0])).toEqual(source);

    expect(
      sections.sourceValue({
        uid: "section:source",
        key: "source",
        kind: "source",
        code: "adapter.ts",
      })
    ).toEqual({ fileName: "adapter.ts" });

    expect(
      sections.sourceValue({
        uid: "section:source",
        key: "source",
        kind: "source",
      })
    ).toEqual({ fileName: "unknown" });
  });

  it("resolves source display paths from value or list fallbacks", () => {
    const source = new DocsSourceComponent();
    source.value = {
      fileName: "adapter.ts",
      line: 10,
      column: 5,
      code: "export const value = 1;",
    };
    expect(source.source.fileName).toBe("adapter.ts");
    expect(source.displayPath).toBe("adapter.ts:10:5");

    const noColumn = new DocsSourceComponent();
    noColumn.items = [{ fileName: "adapter.ts", line: 3 }];
    expect(noColumn.displayPath).toBe("adapter.ts:3");

    expect(new DocsSourceComponent().displayPath).toBe("unknown");
  });

  it("resolves tutorial content and renders it as markdown", () => {
    const tutorial = new DocsTutorialComponent();
    tutorial.value = "# Guide\n\nTutorial content";
    expect(tutorial.content).toBe("# Guide\n\nTutorial content");
    expect(tutorial.html).toContain('<h1 id="guide">Guide</h1>');

    const fromChild = new DocsTutorialComponent();
    fromChild.children = [
      field(DocsElements.TUTORIAL_CONTENT, { value: "## Step" }),
    ];
    expect(fromChild.content).toBe("## Step");
    expect(fromChild.html).toBe('<h2 id="step">Step</h2>');
  });

  it("reads component metadata from a value or a component view child", () => {
    const metadata = new DocsComponentMetadataComponent();
    const component = {
      name: "DocWidgetComponent",
      selector: "doc-widget",
      framework: "angular",
      properties: [{ name: "count", kind: "input" }],
      events: [{ name: "changed" }],
    };
    metadata.value = component;
    expect(metadata.component).toBe(component);

    const fromChild = new DocsComponentMetadataComponent();
    fromChild.children = [
      field(DocsElements.COMPONENT_VIEW, { props: { value: component } }),
    ];
    expect(fromChild.component).toBe(component);

    expect(new DocsComponentMetadataComponent().component).toBeUndefined();
  });

  it("splits header brand, version and extra blocks", () => {
    const header = new DocsHeaderComponent();
    header.children = [
      field(DocsElements.BRAND, { value: "Project" }),
      namedField("version", "1.0.0"),
      namedField("nav", "Docs"),
    ];

    expect(header.brandBlock?.tag).toBe(DocsElements.BRAND);
    expect(header.versionText).toBe("1.0.0");
    expect(header.extraBlocks).toHaveLength(1);
    expect(header.extraBlocks[0].props?.["name"]).toBe("nav");
  });

  it("keeps nav trees, navigation items, breadcrumbs and related lists stable", () => {
    const tree = new DocsNavTreeComponent();
    expect(tree.treeItems).toEqual([]);
    const items = [{ uid: "nav:1", label: "Classes", route: "/docs/classes" }];
    tree.items = items;
    expect(tree.treeItems).toBe(items);

    const navigation = new DocsNavigationItemsComponent();
    navigation.items = [...items, null];
    expect(navigation.navigationItems).toEqual(items);

    const breadcrumbs = new DocsBreadcrumbsComponent();
    breadcrumbs.items = [
      { label: "Home", route: "/" },
      { label: "RamAdapter" },
      null,
    ];
    expect(breadcrumbs.crumbs).toEqual([
      { label: "Home", route: "/" },
      { label: "RamAdapter" },
    ]);

    const related = new DocsRelatedComponent();
    related.items = [
      { uid: "related:1", label: "BaseAdapter", route: "/docs/classes/BaseAdapter" },
      null,
    ];
    expect(related.related.map((entry) => entry.label)).toEqual(["BaseAdapter"]);
  });

  it("keeps text and generic block helpers aligned with semantic inputs", () => {
    const text = new DocsTextComponent();
    text.value = "Heading";
    text.level = "2";
    expect(text.textValue).toBe("Heading");
    expect(text.levelNumber).toBe(2);

    text.children = [field(DocsElements.CODE)];
    expect(text.blocks).toHaveLength(1);

    const children = new DocsChildrenComponent();
    children.children = [field(DocsElements.TEXT)];
    expect(children.blocks).toHaveLength(1);

    const footer = new DocsFooterComponent();
    footer.children = [field(DocsElements.TEXT)];
    expect(footer.blocks).toHaveLength(1);

    const sidebar = new DocsSidebarComponent();
    sidebar.children = [field(DocsElements.NAVIGATION)];
    expect(sidebar.blocks).toHaveLength(1);
  });
});
