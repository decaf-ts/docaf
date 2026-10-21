import {
  DocLayoutModel,
  DocPageModel,
  DocSectionModel,
  DocsIds,
  type DocletModel,
} from "../models";
import type { PublicationDataset } from "./dataset";
import type { LinkRegistry } from "./LinkRegistry";

/**
 * @description Construction options for the PageBuilder.
 * @summary `basePath` (trailing slash stripped) prefixes the home, global and
 * tutorial routes, and `navigationUid` names the navigation tree the pages
 * attach to (defaulting to "main").
 */
export interface PageBuilderOptions {
  basePath?: string;
  navigationUid?: string;
}

/**
 * @description Output of PageBuilder.build().
 * @summary `pages` are the top-level DocPageModel records (symbol pages, plus
 * home, global and tutorial pages), `sections` are the ordered semantic
 * DocSectionModel records attached to those pages, and `layouts` are the
 * fixed DocLayoutModel descriptors pages reference by `layoutId`. All
 * collections are sorted deterministically (pages by order then route,
 * sections by pageUid then order).
 */
export interface PagePublication {
  pages: DocPageModel[];
  sections: DocSectionModel[];
  layouts: DocLayoutModel[];
}

const LAYOUTS: Record<string, { name: string; title: string }> = {
  home: { name: "docs.layout.home", title: "Home" },
  class: { name: "docs.layout.class", title: "Class" },
  component: { name: "docs.layout.component", title: "Component" },
  interface: { name: "docs.layout.interface", title: "Interface" },
  tutorial: { name: "docs.layout.tutorial", title: "Tutorial" },
  source: { name: "docs.layout.source", title: "Source" },
  default: { name: "docs.layout.page", title: "Page" },
};

function pageLayout(kind: string): string {
  const layout = LAYOUTS[kind] ?? LAYOUTS.default;
  return DocsIds.layout(layout.name);
}

/**
 * @description Publication of logical pages and ordered semantic sections.
 * @summary The publisher chooses which sections exist and their order; layouts place them and
 * the selected renderer draws them. This class emits models only, never HTML.
 * @class PageBuilder
 */
export class PageBuilder {
  private readonly basePath: string;
  private readonly navigationUid: string;

  constructor(options: PageBuilderOptions = {}) {
    this.basePath = (options.basePath ?? "").replace(/\/$/, "");
    const navigation = options.navigationUid ?? "main";
    this.navigationUid = navigation.startsWith("navigation:")
      ? navigation
      : DocsIds.navigation(navigation);
  }

  build(
    dataset: PublicationDataset,
    links: LinkRegistry
  ): PagePublication {
    const pages: DocPageModel[] = [];
    const sections: DocSectionModel[] = [];
    const layouts = this.layouts();
    const byOwner = new Map<string, DocletModel[]>();
    for (const doclet of dataset.doclets) {
      if (!doclet.memberofUid) continue;
      const list = byOwner.get(doclet.memberofUid) ?? [];
      list.push(doclet);
      byOwner.set(doclet.memberofUid, list);
    }
    const containerUids = new Set(
      dataset.doclets
        .filter(
          (doclet) => doclet.kind === "module" || doclet.kind === "namespace"
        )
        .map((doclet) => doclet.uid)
    );

    for (const doclet of dataset.doclets) {
      if (doclet.memberofUid || doclet.memberof) {
        const ownerIsContainer =
          doclet.memberofUid !== undefined &&
          containerUids.has(doclet.memberofUid);
        if (!ownerIsContainer) continue;
      }
      const target = links.resolve(doclet.longname);
      if (!target) continue;
      const kind = doclet.componentId ? "component" : doclet.kind;
      const pageUid = DocsIds.page(doclet.uid);
      const members = (byOwner.get(doclet.uid) ?? []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.uid.localeCompare(b.uid)
      );
      const pageSections = this.sectionsFor(
        pageUid,
        doclet,
        kind,
        members,
        dataset
      );
      pages.push(
        new DocPageModel({
          uid: pageUid,
          title: doclet.name,
          kind,
          route: target.route,
          layoutId: pageLayout(kind),
          routeId: DocsIds.route(target.route),
          navigationUid: this.navigationUid,
          order: doclet.order,
          docletUids: [
            doclet.uid,
            ...members.map((member) => member.uid),
          ],
          sectionUids: pageSections.map((section) => section.uid),
          tutorialUids: [],
        })
      );
      sections.push(...pageSections);
    }

    const home = new DocPageModel({
      uid: DocsIds.page("home"),
      title: "Home",
      kind: "home",
      route: `${this.basePath}/`,
      layoutId: pageLayout("home"),
      routeId: DocsIds.route(`${this.basePath}/`),
      navigationUid: this.navigationUid,
      order: -1,
      docletUids: [],
      sectionUids: [],
      tutorialUids: [],
    });
    pages.push(home);

    const globals = dataset.doclets.filter(
      (doclet) =>
        !doclet.memberofUid &&
        !doclet.memberof &&
        doclet.kind !== "class" &&
        doclet.kind !== "interface" &&
        doclet.kind !== "module" &&
        doclet.kind !== "namespace" &&
        doclet.kind !== "typedef" &&
        doclet.kind !== "enum" &&
        doclet.kind !== "function"
    );
    if (globals.length) {
      const globalUid = DocsIds.page("global");
      const route = `${this.basePath}/docs/global`;
      const section = new DocSectionModel({
        uid: DocsIds.section(globalUid, "globals"),
        pageUid: globalUid,
        key: "globals",
        kind: "globals",
        title: "Global",
        order: 0,
        navigationUid: this.navigationUid,
        docletUids: globals.map((doclet) => doclet.uid),
      });
      sections.push(section);
      pages.push(
        new DocPageModel({
          uid: globalUid,
          title: "Global",
          kind: "global",
          route,
          layoutId: pageLayout("default"),
          routeId: DocsIds.route(route),
          navigationUid: this.navigationUid,
          order: 0,
          docletUids: globals.map((doclet) => doclet.uid),
          sectionUids: [section.uid],
          tutorialUids: [],
        })
      );
    }

    for (const tutorial of dataset.tutorials) {
      const pageUid = DocsIds.page(tutorial.uid);
      const route =
        tutorial.route ??
        `${this.basePath}/tutorials/${encodeURIComponent(tutorial.name)}`;
      tutorial.route = route;
      tutorial.pageUid = pageUid;
      const tutorialSections: DocSectionModel[] = [];
      if (tutorial.content) {
        const section = new DocSectionModel({
          uid: DocsIds.section(pageUid, "content"),
          pageUid,
          key: "content",
          kind: "markdown",
          title: tutorial.title,
          content: tutorial.content,
          order: 0,
          navigationUid: this.navigationUid,
          docletUids: tutorial.docletUids,
        });
        tutorialSections.push(section);
      }
      sections.push(...tutorialSections);
      pages.push(
        new DocPageModel({
          uid: pageUid,
          title: tutorial.title,
          kind: "tutorial",
          route,
          layoutId: pageLayout("tutorial"),
          routeId: DocsIds.route(route),
          navigationUid: this.navigationUid,
          order: tutorial.order ?? 0,
          docletUids: tutorial.docletUids,
          sectionUids: tutorialSections.map((section) => section.uid),
          tutorialUids: [tutorial.uid],
        })
      );
    }

    pages.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.route.localeCompare(b.route)
    );
    sections.sort(
      (a, b) =>
        (a.pageUid.localeCompare(b.pageUid)) || a.order - b.order
    );
    return { pages, sections, layouts };
  }

  private sectionsFor(
    pageUid: string,
    doclet: DocletModel,
    kind: string,
    members: readonly DocletModel[],
    dataset: PublicationDataset
  ): DocSectionModel[] {
    const sections: DocSectionModel[] = [];
    let order = 0;
    const add = (key: string, sectionKind: string, title: string, input: {
      content?: string;
      docletUids?: string[];
    } = {}): void => {
      sections.push(
        new DocSectionModel({
          uid: DocsIds.section(pageUid, key),
          pageUid,
          key,
          kind: sectionKind,
          title,
          content: input.content,
          order,
          navigationUid: this.navigationUid,
          docletUids: input.docletUids ?? [],
        })
      );
      order += 1;
    };

    const description = doclet.classdesc ?? doclet.description;
    if (description) add("description", "markdown", "Description", { content: description });
    if (doclet.signatureIds.length)
      add("signature", "signature", "Signature", {
        docletUids: [doclet.uid],
      });
    if (kind === "component") {
      const componentId = doclet.componentId;
      const properties = dataset.componentProperties.filter(
        (property) => property.componentUid === componentId
      );
      const events = dataset.componentEvents.filter(
        (event) => event.componentUid === componentId
      );
      if (properties.length)
        add("properties", "component-properties", "Properties", {
          docletUids: [doclet.uid],
        });
      if (events.length)
        add("events", "component-events", "Events", {
          docletUids: [doclet.uid],
        });
    }
    if (members.length)
      add("members", "members", kind === "class" ? "Methods" : "Members", {
        docletUids: members.map((member) => member.uid),
      });
    if (doclet.exampleIds.length)
      add("examples", "examples", "Examples", {
        docletUids: [doclet.uid],
      });
    if (doclet.sourceId)
      add("source", "source", "Source", { docletUids: [doclet.uid] });
    return sections;
  }

  private layouts(): DocLayoutModel[] {
    return Object.values(LAYOUTS).map(
      (layout, index) =>
        new DocLayoutModel({
          uid: DocsIds.layout(layout.name),
          name: layout.name,
          tag: "docs.layout.page",
          title: layout.title,
          order: index,
          slots: ["main"],
          children: [],
        })
    );
  }
}
