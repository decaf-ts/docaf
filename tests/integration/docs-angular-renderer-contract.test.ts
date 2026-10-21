import { Metadata } from "@decaf-ts/decoration";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocumentationCompiler } from "../../src/generator/compiler/DocumentationCompiler";
import { DocPageModel, DocSectionModel } from "../../src/models";
import {
  DOCS_ANGULAR_CAPABILITIES,
  AngularDocsRendererAdapter,
} from "../../src/for-angular/rendering/AngularDocsRendererAdapter";
import {
  DOCS_ANGULAR_PRIMITIVES,
  DocsBodyLayoutComponent,
  DocsBrandComponent,
  DocsBreadcrumbsComponent,
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
  DocsListComponent,
  DocsMembersComponent,
  DocsNavChildrenComponent,
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
} from "../../src/for-angular/rendering/DocsAngularComponents";
import {
  DOCS_BASE_CAPABILITIES,
  DOCS_REQUIRED_ELEMENTS,
  DocsBreadcrumbsView,
  DocsBodyLayout,
  DocsClassLayout,
  DocsComponentLayout,
  DocsElements,
  DocsHomeLayout,
  DocsNavigationView,
  DocsPageHeaderView,
  DocsPageLayout,
  DocsPageService,
  DocsPreviewView,
  DocsSiteLayout,
  DocsTableOfContentsView,
  DocsTutorialLayout,
  DocsTutorialView,
  normalizeDocsRoute,
  validateDocsRendererCapabilities,
  type DocsRendererContract,
} from "../../src/ui";
import { VERTICAL_SLICE } from "../unit/support/typescript";

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
  class NgxRenderingEngine {
    static readonly registry = new Map<string, unknown>();

    async initialize(): Promise<void> {
      // The real engine initializes its Angular injector; registration is what
      // the docs adapter depends on, so the stub keeps that observable only.
    }

    static components(selector?: string): unknown {
      if (!selector) return [...this.registry.keys()];
      if (!this.registry.has(selector))
        throw new Error(`Component "${selector}" is not registered`);
      return this.registry.get(selector);
    }

    static registerComponent(name: string, constructor: unknown): void {
      if (this.registry.has(name))
        throw new Error(`Component "${name}" is already registered`);
      this.registry.set(name, constructor);
    }
  }
  return { LayoutComponent, NgxRenderingEngine };
});

import { NgxRenderingEngine } from "@decaf-ts/for-angular";

const PROJECT = { name: "@fixture/adapter", version: "1.0.0" };
const CLASS_ROUTE = "/docs/classes/RamAdapter";
const COMPONENT_ROUTE = "/docs/components/DocWidgetComponent";
const TUTORIAL_ROUTE = "/docs/tutorials/guide";

const ELEMENT_COMPONENTS: readonly (readonly [string, unknown])[] = [
  [DocsElements.SITE_LAYOUT, DocsSiteLayoutComponent],
  [DocsElements.BODY_LAYOUT, DocsBodyLayoutComponent],
  [DocsElements.PAGE_LAYOUT, DocsGenericPageComponent],
  [DocsElements.CONTENT_LAYOUT, DocsGenericPageComponent],
  [DocsElements.CLASS_LAYOUT, DocsClassPageComponent],
  [DocsElements.COMPONENT_LAYOUT, DocsComponentPageComponent],
  [DocsElements.TUTORIAL_LAYOUT, DocsTutorialPageComponent],
  [DocsElements.SOURCE_LAYOUT, DocsSourcePageComponent],
  [DocsElements.HOME_LAYOUT, DocsHomePageComponent],
  [DocsElements.HEADER, DocsHeaderComponent],
  [DocsElements.FOOTER, DocsFooterComponent],
  [DocsElements.SIDEBAR, DocsSidebarComponent],
  [DocsElements.BREADCRUMBS, DocsBreadcrumbsComponent],
  [DocsElements.SYMBOL, DocsSymbolComponent],
  [DocsElements.SIGNATURE, DocsSignatureComponent],
  [DocsElements.METHOD, DocsMembersComponent],
  [DocsElements.PARAMETERS, DocsParametersComponent],
  [DocsElements.RETURNS, DocsReturnsComponent],
  [DocsElements.MEMBERS, DocsMembersComponent],
  [DocsElements.EXAMPLES, DocsExamplesComponent],
  [DocsElements.CODE, DocsCodeComponent],
  [DocsElements.COMPONENT, DocsComponentMetadataComponent],
  [DocsElements.PREVIEW, DocsPreviewComponent],
  [DocsElements.SEARCH, DocsSearchComponent],
  [DocsElements.SOURCE, DocsSourceComponent],
  [DocsElements.TUTORIAL, DocsTutorialComponent],
  [DocsElements.SECTIONS, DocsSectionsComponent],
  [DocsElements.RELATED, DocsRelatedComponent],
  [DocsElements.TOC, DocsTocComponent],
  [DocsElements.NAVIGATION, DocsNavigationItemsComponent],
  [DocsElements.TEXT, DocsTextComponent],
  [DocsElements.HEADING, DocsTextComponent],
  [DocsElements.LINK, DocsLinkComponent],
  [DocsElements.BRAND, DocsBrandComponent],
  [DocsElements.MARKDOWN, DocsTutorialComponent],
  [DocsElements.SIGNATURE_NAME, DocsTextComponent],
  [DocsElements.SIGNATURE_PARAMETERS, DocsTextComponent],
  [DocsElements.SIGNATURE_RETURNS, DocsTextComponent],
  [DocsElements.SYMBOL_NAME, DocsTextComponent],
  [DocsElements.SYMBOL_KIND, DocsTextComponent],
  [DocsElements.SYMBOL_DESCRIPTION, DocsTextComponent],
  [DocsElements.NAVIGATION_ITEMS, DocsNavigationItemsComponent],
  [DocsElements.BREADCRUMB_ITEMS, DocsBreadcrumbsComponent],
  [DocsElements.TOC_ITEMS, DocsTocComponent],
  [DocsElements.SECTION_LIST, DocsSectionsComponent],
  [DocsElements.MEMBER_LIST, DocsMembersComponent],
  [DocsElements.EXAMPLE_LIST, DocsExamplesComponent],
  [DocsElements.RELATED_LIST, DocsRelatedComponent],
  [DocsElements.SOURCE_VIEW, DocsSourceComponent],
  [DocsElements.COMPONENT_VIEW, DocsComponentMetadataComponent],
  [DocsElements.PREVIEW_VIEW, DocsPreviewComponent],
  [DocsElements.SEARCH_ENTRIES, DocsSearchComponent],
  [DocsElements.TUTORIAL_CONTENT, DocsTutorialComponent],
];

const CONTRACT_METHODS: readonly (keyof DocsRendererContract)[] = [
  "rendersSiteLayout",
  "rendersClassPage",
  "rendersComponentPage",
  "rendersTutorial",
  "rendersNavigation",
  "rendersSignatures",
  "rendersNestedLayouts",
  "supportsRouting",
  "supportsSearch",
];

function engineRegistry(): Map<string, unknown> {
  return (NgxRenderingEngine as unknown as { registry: Map<string, unknown> })
    .registry;
}

function flatten(
  entries: readonly {
    label: string;
    route?: string;
    children?: readonly unknown[];
  }[]
): { label: string; route?: string; depth: number }[] {
  const result: { label: string; route?: string; depth: number }[] = [];
  const visit = (
    items: readonly {
      label: string;
      route?: string;
      children?: readonly unknown[];
    }[],
    depth: number
  ): void => {
    for (const item of items) {
      result.push({ label: item.label, route: item.route, depth });
      if (item.children?.length)
        visit(
          item.children as readonly {
            label: string;
            route?: string;
            children?: readonly unknown[];
          }[],
          depth + 1
        );
    }
  };
  visit(entries, 0);
  return result;
}

describe("Angular docs renderer contract", () => {
  let database: DocsDatabase;
  let service: DocsPageService;
  let adapter: AngularDocsRendererAdapter;

  beforeAll(async () => {
    database = new DocsDatabase();
    const compiler = new DocumentationCompiler({
      project: PROJECT,
      rootNames: [VERTICAL_SLICE],
      database,
      snapshot: { id: "contract-slice", sourceRevision: "local" },
    });
    await compiler.build(database);
    service = new DocsPageService(database);
    adapter = new AngularDocsRendererAdapter();
    await adapter.initialize();
    const layouts = await database.layouts.select().execute();
    const layoutId = layouts[0]?.uid ?? "layout:default";
    await database.sections.create(
      new DocSectionModel({
        uid: "section:tutorial:intro",
        pageUid: "page:tutorial:guide",
        key: "intro",
        kind: "markdown",
        title: "Introduction",
        content: "Tutorial fixture content",
        order: 0,
      })
    );
    await database.pages.create(
      new DocPageModel({
        uid: "page:tutorial:guide",
        title: "Guide",
        kind: "tutorial",
        route: TUTORIAL_ROUTE,
        layoutId,
        navigationUid: "navigation:main",
        order: 99,
        docletUids: [],
        sectionUids: ["section:tutorial:intro"],
      })
    );
  });

  it("covers every method advertised by the shared renderer contract", () => {
    expect(CONTRACT_METHODS).toHaveLength(9);
    expect(new Set(CONTRACT_METHODS).size).toBe(CONTRACT_METHODS.length);
  });

  it("initializes the adapter with the required capabilities", () => {
    expect(adapter.id).toBe("angular");
    expect(adapter.flavour).toBe("angular");
    expect(DOCS_ANGULAR_CAPABILITIES).toEqual(
      expect.arrayContaining([...DOCS_BASE_CAPABILITIES, "component.native-preview"])
    );
    const report = validateDocsRendererCapabilities(
      DOCS_BASE_CAPABILITIES,
      adapter.capabilities
    );
    expect(report.missing).toEqual([]);
    expect(adapter.capabilities.has("component.native-preview")).toBe(true);
  });

  it("registers every required semantic element", () => {
    for (const element of DOCS_REQUIRED_ELEMENTS)
      expect(engineRegistry().has(element)).toBe(true);
  });

  it.each(ELEMENT_COMPONENTS)(
    "maps %s to its dedicated component",
    (tag, component) => {
      expect(engineRegistry().get(tag)).toBe(component);
    }
  );

  it("registers the complete page-block map with no stale slots", () => {
    expect(engineRegistry().size).toBe(ELEMENT_COMPONENTS.length);
    expect([...engineRegistry().keys()].sort()).toEqual(
      ELEMENT_COMPONENTS.map(([tag]) => tag).sort()
    );
  });

  it("keeps the legacy list and nav aliases on the dedicated components", () => {
    expect(DocsListComponent).toBe(DocsSectionsComponent);
    expect(DocsNavChildrenComponent).toBe(DocsNavTreeComponent);
    expect(engineRegistry().get(DocsElements.NAVIGATION_ITEMS)).toBe(
      DocsNavigationItemsComponent
    );
    expect(engineRegistry().get(DocsElements.SECTIONS)).toBe(
      DocsSectionsComponent
    );
  });

  it("exposes every dedicated component through DOCS_ANGULAR_PRIMITIVES", () => {
    const primitives = new Set<unknown>(DOCS_ANGULAR_PRIMITIVES);
    for (const [tag, component] of ELEMENT_COMPONENTS) {
      expect(primitives.has(component)).toBe(true);
      expect(engineRegistry().get(tag)).toBe(component);
    }
    expect(primitives.has(DocsListComponent)).toBe(true);
    expect(primitives.has(DocsNavChildrenComponent)).toBe(true);
  });

  it("rendersSiteLayout: resolves the site chrome and the 3-column body", async () => {
    const layout = await service.resolveLayout("/");
    expect(layout).toBeInstanceOf(DocsSiteLayout);
    expect(layout.route).toBe("/");
    expect(layout.header.brand).toBe(PROJECT.name);
    expect(layout.header.version).toBe(PROJECT.version);
    expect(layout.footer.text).toContain(PROJECT.name);
    expect(layout.body.sidebar).toBeInstanceOf(DocsNavigationView);
    expect(layout.body.toc).toBeInstanceOf(DocsTableOfContentsView);
  });

  it("rendersClassPage: resolves the class layout, heading, sections and signatures", async () => {
    const layout = await service.resolveLayout(CLASS_ROUTE);
    expect(layout).toBeInstanceOf(DocsSiteLayout);
    expect(layout.body).toBeInstanceOf(DocsBodyLayout);
    const page = layout.body.content;
    expect(page).toBeInstanceOf(DocsClassLayout);
    expect((page as DocsClassLayout).header).toBeInstanceOf(
      DocsPageHeaderView
    );
    expect((page as DocsClassLayout).header.title).toBe("RamAdapter");
    expect((page as DocsClassLayout).header.kind).toBe("class");
    expect((page as DocsClassLayout).breadcrumbs).toBeInstanceOf(
      DocsBreadcrumbsView
    );
    expect((page as DocsClassLayout).breadcrumbs.items.map((item) => item.label)).toEqual([
      "Home",
      "class",
      "RamAdapter",
    ]);

    const sections = (page as DocsClassLayout).sections.items;
    expect(sections.map((section) => section.kind)).toEqual([
      "markdown",
      "signature",
      "members",
      "source",
    ]);
    expect(sections.map((section) => section.title)).toEqual([
      "Description",
      "Signature",
      "Methods",
      "Source",
    ]);
    const members = sections.find((section) => section.kind === "members");
    expect(members?.members?.map((member) => member.name)).toEqual(
      expect.arrayContaining(["constructor", "read"])
    );
    const read = members?.members?.find((member) => member.name === "read");
    expect(read?.signature).toBe("read(key: string): unknown");
    expect(layout.body.toc.items.map((item) => item.label)).toEqual([
      "Description",
      "Signature",
      "Methods",
      "Source",
    ]);
  });

  it("rendersComponentPage: resolves component metadata and native preview controls", async () => {
    const layout = await service.resolveLayout(COMPONENT_ROUTE);
    const page = layout.body.content;
    expect(page).toBeInstanceOf(DocsComponentLayout);
    const componentPage = page as DocsComponentLayout;
    expect(componentPage.header.title).toBe("DocWidgetComponent");
    expect(componentPage.preview).toBeInstanceOf(DocsPreviewView);
    expect(componentPage.preview.preview.framework).toBe("angular");
    expect(componentPage.preview.preview.kind).toBe("native");
    expect(componentPage.preview.preview.controls.map((control) => control.name)).toEqual([
      "count",
      "label",
    ]);
    expect(
      componentPage.preview.preview.controls.find(
        (control) => control.name === "count"
      )?.alias
    ).toBe("itemCount");
    expect(componentPage.preview.preview.events).toEqual(["changed"]);
    expect(
      componentPage.sections.items.map((section) => section.kind)
    ).toEqual([
      "markdown",
      "signature",
      "component-properties",
      "component-events",
      "members",
      "source",
    ]);
    expect(
      componentPage.sections.items.find(
        (section) => section.kind === "members"
      )?.title
    ).toBe("Members");
  });

  it("rendersTutorial: resolves tutorial content into the tutorial layout", async () => {
    const layout = await service.resolveLayout(TUTORIAL_ROUTE);
    const page = layout.body.content;
    expect(page).toBeInstanceOf(DocsTutorialLayout);
    expect((page as DocsTutorialLayout).tutorial).toBeInstanceOf(
      DocsTutorialView
    );
    expect((page as DocsTutorialLayout).tutorial.content).toContain(
      "Tutorial fixture content"
    );
  });

  it("rendersNavigation: exposes nested sidebar navigation with resolvable routes", async () => {
    const layout = await service.resolveLayout(CLASS_ROUTE);
    const items = layout.body.sidebar.items;
    expect(items.length).toBeGreaterThan(0);
    const flattened = flatten(items);
    expect(flattened.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Adapters",
        "Classes",
        "Memory",
        "RamAdapter",
        "Interfaces",
        "Configuration",
        "AdapterConfig",
        "Contracts",
        "BaseAdapter",
        "Components",
        "Widgets",
        "DocWidgetComponent",
      ])
    );
    expect(Math.max(...flattened.map((item) => item.depth))).toBeGreaterThanOrEqual(3);
    const routes = flattened
      .map((item) => item.route)
      .filter((route): route is string => Boolean(route));
    expect(routes).toEqual(
      expect.arrayContaining([CLASS_ROUTE, COMPONENT_ROUTE])
    );
    expect(routes).toHaveLength(new Set(routes).size);
    for (const route of routes)
      expect((await service.resolvePage(route)).route).toBe(route);
  });

  it("rendersSignatures: exposes signature text for class and component pages", async () => {
    const classLayout = await service.resolveLayout(CLASS_ROUTE);
    const signature = (classLayout.body.content as DocsClassLayout).sections.items.find(
      (section) => section.kind === "signature"
    );
    expect(signature?.members?.[0]?.signature).toBe("RamAdapter()");

    const componentLayout = await service.resolveLayout(COMPONENT_ROUTE);
    const componentSignature = (
      componentLayout.body.content as DocsComponentLayout
    ).sections.items.find((section) => section.kind === "signature");
    expect(componentSignature?.members?.[0]?.signature).toBe(
      "DocWidgetComponent()"
    );
  });

  it("rendersNestedLayouts: keeps site -> body -> page metadata and column structure", async () => {
    const layout = await service.resolveLayout(CLASS_ROUTE);
    expect(layout.body.content).toBeInstanceOf(DocsPageLayout);
    expect(layout.body.content).toBeInstanceOf(DocsClassLayout);

    const site = Metadata.get(DocsSiteLayout) as {
      ui: {
        uilayout: { cols: number; rows: number };
        properties: Record<
          string,
          { uichild: { tag: string; props: Record<string, unknown> } }
        >;
      };
    };
    const body = Metadata.get(DocsBodyLayout) as {
      ui: {
        uilayout: { cols: number; rows: number; gap?: string };
        properties: Record<
          string,
          { uichild: { tag: string; props: Record<string, unknown> } }
        >;
      };
    };
    const classLayout = Metadata.get(DocsClassLayout) as {
      ui: {
        uilayout: { cols: number; rows: number };
        properties: Record<string, { uichild: { tag: string } }>;
      };
    };

    expect(site.ui.uilayout).toMatchObject({ cols: 1, rows: 3 });
    expect(site.ui.properties.body.uichild.tag).toBe(DocsElements.BODY_LAYOUT);
    expect(site.ui.properties.body.uichild.props).toMatchObject({
      cols: 3,
      rows: 1,
    });
    expect(body.ui.uilayout).toMatchObject({ cols: 3, rows: 1, gap: "small" });
    expect(body.ui.properties.sidebar.uichild.tag).toBe(DocsElements.SIDEBAR);
    expect(body.ui.properties.content.uichild.tag).toBe(
      DocsElements.PAGE_LAYOUT
    );
    expect(body.ui.properties.toc.uichild.tag).toBe(DocsElements.TOC);
    expect(classLayout.ui.uilayout).toMatchObject({ cols: 1, rows: 5 });
    expect(classLayout.ui.properties.header.uichild.tag).toBe(
      DocsElements.SYMBOL
    );
    expect(classLayout.ui.properties.sections.uichild.tag).toBe(
      DocsElements.SECTIONS
    );
  });

  it("supportsRouting: normalizes hash routes, query strings and trailing slashes", async () => {
    expect(normalizeDocsRoute("#/docs/classes/RamAdapter")).toBe(CLASS_ROUTE);
    expect(normalizeDocsRoute("/docs/classes/RamAdapter/")).toBe(CLASS_ROUTE);
    expect(normalizeDocsRoute("#/docs/classes/RamAdapter?tab=methods")).toBe(
      CLASS_ROUTE
    );
    expect(normalizeDocsRoute("")).toBe("/");

    const page = await service.resolvePage("#/docs/classes/RamAdapter?tab=methods");
    expect(page.route).toBe(CLASS_ROUTE);
    expect(page.kind).toBe("class");

    const routes = await database.routes.select().execute();
    const route = routes.find((candidate) => candidate.route === CLASS_ROUTE);
    expect(route).toBeDefined();
    expect((await service.resolvePage(CLASS_ROUTE)).uid).toBe(route?.pageUid);

    const fallback = await service.resolvePage("/docs/does-not-exist");
    expect(fallback.kind).toBe("home");
    expect(fallback).toBeInstanceOf(DocPageModel);
  });

  it("supportsSearch: filters by term and returns navigable results", async () => {
    const ram = await service.search("ram");
    expect(ram.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["RamAdapter", "read", "constructor"])
    );
    const ramAdapter = ram.find((entry) => entry.name === "RamAdapter");
    expect(ramAdapter).toMatchObject({
      route: CLASS_ROUTE,
      kind: "class",
    });

    const widget = await service.search("widget");
    expect(widget.map((entry) => entry.name)).toContain("DocWidgetComponent");
    expect(
      widget.find((entry) => entry.name === "DocWidgetComponent")?.route
    ).toBe(COMPONENT_ROUTE);

    const index = await service.searchIndex();
    expect(index.length).toBeGreaterThan(0);
    for (const entry of index) {
      if (!entry.route) continue;
      const page = await service.resolvePage(entry.route);
      expect(page.route).toBe(entry.route);
    }
  });

  it("resolves the home layout through the same site shell", async () => {
    const layout = await service.resolveLayout("/");
    expect(layout.body.content).toBeInstanceOf(DocsHomeLayout);
    expect(
      (layout.body.content as DocsHomeLayout).sections.items.map(
        (section) => section.title
      )
    ).toEqual(expect.arrayContaining(["API", "Components"]));
    expect(layout.route).toBe("/");
  });
});
