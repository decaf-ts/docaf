import { InternalError, NotFoundError } from "@decaf-ts/db-decorators";
import type { DocsDatabase } from "../database/DocsDatabase";
import {
  DocComponentModel,
  DocComponentPreviewModel,
  DocComponentPropertyModel,
  DocComponentEventModel,
  DocExampleModel,
  DocManifestModel,
  DocNavigationItemModel,
  DocPageModel,
  DocSectionModel,
  DocSignatureModel,
  DocSourceModel,
  DocletModel,
} from "../models";
import { DocsQueryService } from "../query/DocsQueryService";
import {
  DocsBreadcrumbsView,
  DocsComponentViewEntry,
  DocsExampleEntry,
  DocsFooterView,
  DocsHeaderView,
  DocsMemberEntry,
  DocsNavigationEntry,
  DocsNavigationView,
  DocsPageSectionsView,
  DocsParameterEntry,
  DocsPreviewControlEntry,
  DocsPreviewEntry,
  DocsPreviewView,
  DocsRelatedSymbolsView,
  DocsReturnEntry,
  DocsSearchEntry,
  DocsSearchView,
  DocsSectionEntry,
  DocsSourceView,
  DocsSourceViewEntry,
  DocsTableOfContentsView,
  DocsTutorialView,
} from "./views/DocsViews";
import { DocsPageHeaderView } from "./views/DocsPageHeaderView";
import {
  DocsClassLayout,
  DocsComponentLayout,
  DocsGenericPageLayout,
  DocsHomeLayout,
  DocsPageLayout,
  DocsSourceLayout,
  DocsTutorialLayout,
} from "./layouts/DocsPageLayouts";
import { DocsBodyLayout, DocsSiteLayout } from "./layouts/DocsSiteLayout";

const CLASS_KINDS = new Set([
  "class",
  "interface",
  "module",
  "namespace",
  "typedef",
  "enum",
  "mixin",
  "external",
  "function",
]);

function normalizeRoute(path: string): string {
  if (!path) return "/";
  let route = path;
  const hash = route.indexOf("#");
  if (hash >= 0) {
    const hashRoute = route.slice(hash + 1);
    route = hashRoute.startsWith("/") ? hashRoute : route.slice(0, hash);
  }
  const fragment = route.indexOf("#");
  if (fragment >= 0) route = route.slice(0, fragment);
  const query = route.indexOf("?");
  if (query >= 0) route = route.slice(0, query);
  if (!route.startsWith("/")) route = `/${route}`;
  if (route.length > 1) route = route.replace(/\/+$/, "");
  return route || "/";
}

function byOrderThenUid(
  a: { order?: number; uid: string },
  b: { order?: number; uid: string }
): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.uid.localeCompare(b.uid);
}

function text(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseDefault(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed.length) return undefined;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1);
  return trimmed;
}

/**
 * @description Configuration options for the documentation page service.
 * @summary Allows callers to override the navigation set used to build the
 * sidebar. When neither a page record nor this option provides a navigation
 * UID, the service falls back to the "navigation:main" navigation record.
 * @interface DocsPageServiceOptions
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsPageServiceOptions {
  navigationUid?: string;
}

/**
 * @description Renderer-neutral service that resolves a documentation route
 * into a complete nested layout model graph.
 * @summary DocsPageService resolves a route to a DocPageModel, then composes
 * the full view/layout graph (site header, footer, sidebar navigation, table
 * of contents, breadcrumbs, and a kind-specific page layout) from the docs
 * database. Every rendering target consumes the same graph, so all renderers
 * produce identical output from the same snapshot.
 * @class DocsPageService
 * @param {DocsDatabase} database - docs database the service reads models from.
 * @param {DocsPageServiceOptions} options - optional service configuration.
 * @example
 * const service = new DocsPageService(database);
 * const layout = await service.resolveLayout("/components/button");
 * @category UI
 */
// Renderer-neutral page service. It resolves a route to a complete nested
// Decaf layout model graph; every rendering target consumes the same graph.
export class DocsPageService {
  private readonly queries: DocsQueryService;

  constructor(
    private readonly database: DocsDatabase,
    private readonly options: DocsPageServiceOptions = {}
  ) {
    this.queries = new DocsQueryService(database);
  }

  /**
   * @description Exposes the underlying docs database.
   * @summary Convenience accessor for renderers or services that need to query
   * the same snapshot the page service reads from, without a second reference.
   * @returns {DocsDatabase} the database this service was built with.
   */
  get store(): DocsDatabase {
    return this.database;
  }

  /**
   * @description Resolves a raw path to the page record serving it.
   * @summary Normalizes the path with the canonical route rules, then resolves
   * in order: a direct page-route match, a route record mapping, the "home"
   * page, and finally the first page by order. Throws only when the snapshot
   * has no pages at all.
   * @param {string} path - raw route or URL path (hash and query are ignored).
   * @returns {Promise<DocPageModel>} the page record serving the normalized route.
   * @throws {NotFoundError} when the database contains no pages.
   */
  async resolvePage(path: string): Promise<DocPageModel> {
    const route = normalizeRoute(path);
    const direct = await this.queries.findPageByRoute(route);
    if (direct.length) return direct[0];

    const routeRecord = await this.queries.findRoute(route);
    if (routeRecord.length) {
      const page = await this.queries.findPageByUid(routeRecord[0].pageUid);
      if (page.length) return page[0];
    }

    const pages = await this.database.pages.select().execute();
    const home = pages
      .filter((page) => page.kind === "home")
      .sort(byOrderThenUid)[0];
    if (home) return home;
    const fallback = [...pages].sort(byOrderThenUid)[0];
    if (fallback) return fallback;
    throw new NotFoundError(`No documentation page matches route "${route}"`);
  }

  /**
   * @description Resolves a raw path to the full nested layout graph for rendering.
   * @summary Convenience composition of {@link DocsPageService.resolvePage} and
   * {@link DocsPageService.layoutFor}: resolves which page serves the path and
   * then builds the complete site layout for it.
   * @param {string} path - raw route or URL path to resolve.
   * @returns {Promise<DocsSiteLayout>} the complete nested layout for the route.
   */
  async resolveLayout(path: string): Promise<DocsSiteLayout> {
    const page = await this.resolvePage(path);
    return this.layoutFor(page);
  }

  /**
   * @description Composes the complete nested layout graph for a known page.
   * @summary Loads the manifest, sidebar navigation, root doclet, sections and
   * search index from the database, then assembles the site chrome (header,
   * footer, sidebar, table of contents) and the kind-specific content layout
   * chosen by {@link DocsPageService.contentFor}.
   * @mermaid
   * sequenceDiagram
   *   autonumber
   *   participant C as Renderer
   *   participant S as DocsPageService
   *   participant Q as DocsQueryService
   *   participant D as DocsDatabase
   *   C->>S: layoutFor(page)
   *   activate S
   *   S->>D: manifest / navigation / sections / search
   *   activate D
   *   D-->>S: models
   *   deactivate D
   *   S->>Q: findDocletByUid / findNavigation
   *   activate Q
   *   Q-->>S: records
   *   deactivate Q
   *   S-->>C: DocsSiteLayout
   *   deactivate S
   * @param {DocPageModel} page - the page record to compose the layout for.
   * @returns {Promise<DocsSiteLayout>} the complete site layout graph.
   */
  async layoutFor(page: DocPageModel): Promise<DocsSiteLayout> {
    const manifest = await this.manifest();
    const navItems = await this.navigationItems(page);
    const entries = await this.navigationEntries(navItems);
    const rootDoclet = await this.pageRootDoclet(page);
    const sections = await this.sectionEntries(page);
    const toc = sections
      .filter((section) => Boolean(section.title))
      .map((section) => ({
        label: section.title as string,
        anchor: `section-${section.key}`,
        level: 2,
      }));

    const searchEntries = await this.searchIndex();
    const header = new DocsHeaderView({
      brand: text(manifest?.projectName) ?? "Documentation",
      version: text(manifest?.projectVersion),
    });
    const footer = new DocsFooterView({
      text: `${text(manifest?.projectName) ?? "Documentation"} · ${
        text(manifest?.projectVersion) ?? ""
      }`.trim(),
    });
    const sidebar = new DocsNavigationView({
      title: "Documentation",
      items: entries,
      search: new DocsSearchView({ entries: searchEntries }),
    });
    const content = await this.contentFor(page, {
      sections,
      toc,
      rootDoclet,
      entries,
    });

    return new DocsSiteLayout({
      route: page.route,
      title: page.title,
      pageUid: page.uid,
      header,
      footer,
      body: new DocsBodyLayout({
        sidebar,
        toc: new DocsTableOfContentsView({
          title: "On this page",
          items: toc,
        }),
        content,
      }),
    });
  }

  /**
   * @description Searches the documentation search index for a term.
   * @summary Delegates to the query service's ranked search and maps the raw
   * records into renderer-neutral {@link DocsSearchEntry} view models.
   * @param {string} term - free-text search term.
   * @param {number} [limit] - maximum number of results to return (default 50).
   * @returns {Promise<DocsSearchEntry[]>} ranked search entries matching the term.
   */
  async search(term: string, limit = 50): Promise<DocsSearchEntry[]> {
    const results = await this.queries.search(term, limit);
    return results.map((entry) => this.searchEntry(entry));
  }

  /**
   * @description Returns the pre-built search index entries used by the sidebar.
   * @summary Reads every search record, sorts by descending rank (then uid for
   * determinism) and maps them into {@link DocsSearchEntry} view models. The
   * whole index is returned so client-side filtering can reach every documented
   * symbol; result caps belong to the per-query view, not to the index itself.
   * @param {number} [limit] - optional maximum number of entries to return; when
   * omitted every indexed entry is returned.
   * @returns {Promise<DocsSearchEntry[]>} the ranked search index entries.
   */
  async searchIndex(limit?: number): Promise<DocsSearchEntry[]> {
    const records = await this.database.search.select().execute();
    const ranked = [...records]
      .sort(
        (a, b) =>
          (b.rank ?? 0) - (a.rank ?? 0) || a.uid.localeCompare(b.uid)
      )
      .map((entry) => this.searchEntry(entry));
    return typeof limit === "number"
      ? ranked.slice(0, Math.max(0, limit))
      : ranked;
  }

  private async contentFor(
    page: DocPageModel,
    context: {
      sections: DocsSectionEntry[];
      toc: { label: string; anchor?: string; level?: number }[];
      rootDoclet?: DocletModel;
      entries: DocsNavigationEntry[];
    }
  ): Promise<DocsPageLayout> {
    const breadcrumbs = new DocsBreadcrumbsView({
      items: [
        { label: "Home", route: "/" },
        { label: page.kind },
        { label: page.title },
      ],
    });
    const header = new DocsPageHeaderView({
      title: page.title,
      kind: page.kind,
      category: context.rootDoclet?.category,
      summary: text(context.rootDoclet?.summary),
    });
    const sections = new DocsPageSectionsView({ items: context.sections });
    const related = new DocsRelatedSymbolsView({
      items: context.entries
        .flatMap((entry) => [entry, ...(entry.children ?? [])])
        .filter(
          (entry) =>
            Boolean(entry.route) &&
            entry.route !== page.route &&
            (!entry.kind || entry.kind === page.kind)
        )
        .slice(0, 8),
    });

    if (page.kind === "component") {
      const preview = await this.previewFor(page);
      return new DocsComponentLayout({
        kind: page.kind,
        breadcrumbs,
        header,
        preview: new DocsPreviewView({ preview }),
        sections,
        related,
      });
    }
    if (page.kind === "tutorial")
      return new DocsTutorialLayout({
        kind: page.kind,
        header,
        tutorial: new DocsTutorialView({
          content: context.sections
            .map((section) => section.content)
            .filter((value): value is string => Boolean(value))
            .join("\n\n"),
        }),
      });
    if (page.kind === "source")
      return new DocsSourceLayout({
        kind: page.kind,
        header,
        source: new DocsSourceView({
          source: await this.sourceFor(context.rootDoclet),
        }),
      });
    if (page.kind === "home") {
      const explore = await this.exploreSections();
      return new DocsHomeLayout({
        kind: page.kind,
        header,
        sections: new DocsPageSectionsView({ items: explore }),
      });
    }
    if (CLASS_KINDS.has(page.kind))
      return new DocsClassLayout({
        kind: page.kind,
        breadcrumbs,
        header,
        sections,
        related,
      });
    return new DocsGenericPageLayout({
      kind: page.kind,
      header,
      sections,
    });
  }

  private async manifest(): Promise<DocManifestModel | undefined> {
    const manifests = await this.database.manifests.select().execute();
    return manifests.sort(byOrderThenUid)[0];
  }

  private async pageRootDoclet(
    page: DocPageModel
  ): Promise<DocletModel | undefined> {
    for (const uid of page.docletUids) {
      const found = await this.queries.findDocletByUid(uid);
      const doclet = found[0];
      if (doclet && !doclet.memberofUid) return doclet;
    }
    const first = page.docletUids[0];
    if (!first) return undefined;
    const found = await this.queries.findDocletByUid(first);
    return found[0];
  }

  private async navigationItems(
    page: DocPageModel
  ): Promise<DocNavigationItemModel[]> {
    const uid = page.navigationUid ?? this.options.navigationUid ?? "navigation:main";
    return this.queries.findNavigation(uid);
  }

  private async navigationEntries(
    items: DocNavigationItemModel[]
  ): Promise<DocsNavigationEntry[]> {
    const byUid = new Map(items.map((item) => [item.uid, item]));
    const build = (item: DocNavigationItemModel, seen: Set<string>): DocsNavigationEntry => {
      const children = (item.childUids ?? [])
        .map((uid) => byUid.get(uid))
        .filter((child): child is DocNavigationItemModel => Boolean(child))
        .filter((child) => !seen.has(child.uid))
        .sort(byOrderThenUid)
        .map((child) => build(child, new Set([...seen, child.uid])));
      return {
        uid: item.uid,
        label: item.label,
        route: item.route,
        anchor: item.anchor,
        kind: item.kind,
        children: children.length ? children : undefined,
      };
    };
    const roots = items
      .filter((item) => !item.parentUid)
      .sort(byOrderThenUid);
    const root = roots.find((item) => item.kind === "root");
    const selected = root ? (root.childUids ?? []).map((uid) => byUid.get(uid)).filter((item): item is DocNavigationItemModel => Boolean(item)) : roots;
    return selected.sort(byOrderThenUid).map((item) => build(item, new Set([item.uid])));
  }

  private async sectionEntries(
    page: DocPageModel
  ): Promise<DocsSectionEntry[]> {
    const models = await this.sections(page);
    const entries: DocsSectionEntry[] = [];
    for (const section of models) {
      const entry: DocsSectionEntry = {
        uid: section.uid,
        key: section.key,
        kind: section.kind,
        title: section.title,
        content: section.content,
      };
      if (section.kind === "signature") {
        const doclet = await this.firstDoclet(section.docletUids);
        if (doclet) {
          const signature = await this.signatureFor(doclet);
          entry.members = signature
            ? [
                {
                  uid: signature.uid,
                  name: signature.name ?? doclet.name,
                  kind: "signature",
                  signature: signature.signatureText,
                  description: signature.description ?? doclet.summary,
                  anchor: doclet.anchor,
                },
              ]
            : undefined;
          entry.parameters = await this.parametersFor(signature);
          entry.returns = await this.returnsFor(signature);
        }
      } else if (section.kind === "members") {
        entry.members = await this.members(section.docletUids);
      } else if (section.kind === "examples") {
        entry.examples = await this.examples(section.docletUids);
      } else if (
        section.kind === "component-properties" ||
        section.kind === "component-events"
      ) {
        entry.content = undefined;
        const component = await this.componentForPage(page);
        if (component)
          entry.members = await this.componentRows(
            component,
            section.kind === "component-properties"
          );
      } else if (section.kind === "source") {
        const doclet = await this.firstDoclet(section.docletUids);
        const source = await this.sourceFor(doclet);
        if (source) {
          entry.source = source;
          entry.code = source.fileName;
        }
      }
      entries.push(entry);
    }
    return entries;
  }

  private async sections(page: DocPageModel): Promise<DocSectionModel[]> {
    const sections: DocSectionModel[] = [];
    for (const uid of page.sectionUids) {
      try {
        sections.push(await this.database.sections.read(uid));
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return sections.sort(byOrderThenUid);
  }

  private async firstDoclet(uids: string[]): Promise<DocletModel | undefined> {
    for (const uid of uids) {
      const found = await this.queries.findDocletByUid(uid);
      if (found[0]) return found[0];
    }
    return undefined;
  }

  private async members(uids: string[]): Promise<DocsMemberEntry[]> {
    const members: DocsMemberEntry[] = [];
    for (const uid of uids) {
      const found = await this.queries.findDocletByUid(uid);
      const doclet = found[0];
      if (!doclet) continue;
      const signature = await this.signatureFor(doclet);
      members.push({
        uid: doclet.uid,
        name: doclet.name,
        kind: doclet.kind,
        signature: signature?.signatureText,
        description: text(doclet.description) ?? text(doclet.summary),
        route: undefined,
        anchor: doclet.anchor,
        access: doclet.access,
        static: Boolean(doclet.metadata?.static === "true"),
      });
    }
    return members.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async signatureFor(
    doclet: DocletModel
  ): Promise<DocSignatureModel | undefined> {
    for (const uid of doclet.signatureIds ?? []) {
      try {
        return await this.database.signatures.read(uid);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return undefined;
  }

  private async parametersFor(
    signature: DocSignatureModel | undefined
  ): Promise<DocsParameterEntry[]> {
    if (!signature) return [];
    const entries: DocsParameterEntry[] = [];
    for (const uid of signature.parameterIds ?? []) {
      try {
        const parameter = await this.database.parameters.read(uid);
        entries.push({
          uid: parameter.uid,
          name: parameter.name,
          typeText: parameter.typeText,
          optional: parameter.optional,
          rest: parameter.rest,
          defaultValue: parameter.defaultValue,
          description: parameter.description,
        });
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return entries;
  }

  private async returnsFor(
    signature: DocSignatureModel | undefined
  ): Promise<DocsReturnEntry[]> {
    if (!signature) return [];
    const entries: DocsReturnEntry[] = [];
    for (const uid of [signature.returnId, signature.yieldId]) {
      if (!uid) continue;
      try {
        const returned = await this.database.returns.read(uid);
        entries.push({
          uid: returned.uid,
          role: returned.role,
          typeText: returned.typeText,
          description: returned.description,
          nullable: returned.nullable,
          elementTypeText: returned.elementTypeText,
        });
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return entries;
  }

  private async examples(uids: string[]): Promise<DocsExampleEntry[]> {
    const examples: DocsExampleEntry[] = [];
    for (const uid of uids) {
      const found = await this.queries.findDocletByUid(uid);
      const doclet = found[0];
      if (!doclet) continue;
      for (const exampleUid of doclet.exampleIds ?? []) {
        try {
          const example = await this.database.examples.read(exampleUid);
          examples.push(this.exampleEntry(example));
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
      }
    }
    return examples;
  }

  private exampleEntry(example: DocExampleModel): DocsExampleEntry {
    return {
      uid: example.uid,
      caption: example.caption,
      code: example.code,
      language: example.language,
    };
  }

  private async componentForPage(
    page: DocPageModel
  ): Promise<DocComponentModel | undefined> {
    const root = await this.pageRootDoclet(page);
    if (!root?.componentId) return undefined;
    const found = await this.queries.findComponentByUid(root.componentId);
    return found[0];
  }

  private async componentRows(
    component: DocComponentModel,
    inputs: boolean
  ): Promise<DocsMemberEntry[]> {
    if (inputs) {
      const properties = await this.database.componentProperties.select().execute();
      return properties
        .filter((property) => property.componentUid === component.uid)
        .sort(byOrderThenUid)
        .map((property) => ({
          uid: property.uid,
          name: property.alias
            ? `${property.name} (${property.alias})`
            : property.name,
          kind: property.kind,
          signature: property.typeText,
          description: property.description,
          access: property.required ? "required" : undefined,
        }));
    }
    const events = await this.database.componentEvents.select().execute();
    return events
      .filter((event) => event.componentUid === component.uid)
      .sort(byOrderThenUid)
      .map((event) => ({
        uid: event.uid,
        name: event.name,
        kind: "output",
        signature: event.payloadTypeText,
        description: event.description,
      }));
  }

  private async previewFor(page: DocPageModel): Promise<DocsPreviewEntry> {
    const component = await this.componentForPage(page);
    if (!component)
      return {
        uid: `preview:${page.uid}`,
        title: page.title,
        framework: "unknown",
        entry: page.uid,
        kind: "native",
        initialProps: {},
        controls: [],
        events: [],
      };

    const previews = await this.database.componentPreviews.select().execute();
    const preview = previews
      .filter((candidate) => candidate.componentUid === component.uid)
      .sort(byOrderThenUid)[0];
    const properties = (
      await this.database.componentProperties.select().execute()
    )
      .filter((property) => property.componentUid === component.uid)
      .sort(byOrderThenUid);
    const events = (
      await this.database.componentEvents.select().execute()
    ).filter((event) => event.componentUid === component.uid);

    return this.previewEntry(component, preview, properties, events);
  }

  private previewEntry(
    component: DocComponentModel,
    preview: DocComponentPreviewModel | undefined,
    properties: DocComponentPropertyModel[],
    events: DocComponentEventModel[]
  ): DocsPreviewEntry {
    const defaults =
      (preview?.inputDefaults as Record<string, unknown> | undefined) ?? {};
    const controls: DocsPreviewControlEntry[] = properties.map((property) => ({
      name: property.name,
      alias: property.alias,
      kind: "input",
      typeText: property.typeText,
      required: property.required,
      optional: property.optional,
      defaultValue: property.defaultValue,
      description: property.description,
      value:
        property.name in defaults
          ? defaults[property.name]
          : parseDefault(property.defaultValue),
    }));
    const initialProps: Record<string, unknown> = {};
    for (const control of controls)
      if (control.value !== undefined)
        initialProps[control.name] = control.value;
    return {
      uid: preview?.uid ?? `preview:${component.uid}`,
      title:
        text(preview?.name) ??
        `${component.name} preview`,
      framework: preview?.framework ?? component.framework,
      entry: preview?.entry ?? component.uid,
      kind: preview?.kind ?? "native",
      initialProps,
      controls,
      events: events.map((event) => event.name),
    };
  }

  private async sourceFor(
    doclet: DocletModel | undefined
  ): Promise<DocsSourceViewEntry> {
    if (!doclet?.sourceId)
      return {
        fileName: "unknown",
      };
    try {
      const source = await this.database.sources.read(doclet.sourceId);
      return this.sourceEntry(source);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      return { fileName: "unknown" };
    }
  }

  private sourceEntry(source: DocSourceModel): DocsSourceViewEntry {
    return {
      fileName: source.fileName,
      line: source.line,
      column: source.column,
      repository: source.repository,
    };
  }

  private async exploreSections(): Promise<DocsSectionEntry[]> {
    const entries: DocsSectionEntry[] = [];
    const pages = await this.database.pages.select().execute();
    const groups: Record<string, DocsMemberEntry[]> = {};
    for (const page of pages) {
      if (page.kind === "home") continue;
      const group = page.kind === "component" ? "Components" : page.kind === "tutorial" ? "Tutorials" : "API";
      groups[group] = groups[group] ?? [];
      groups[group].push({
        uid: page.uid,
        name: page.title,
        kind: page.kind,
        route: page.route,
      });
    }
    for (const [title, members] of Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      entries.push({
        uid: `home:${title}`,
        key: title.toLowerCase(),
        kind: "members",
        title,
        members: members.sort((a, b) => a.name.localeCompare(b.name)),
        content: `Browse the ${title.toLowerCase()} in this documentation set.`,
      });
    }
    return entries;
  }

  private searchEntry(entry: {
    uid: string;
    name: string;
    longname: string;
    kind: string;
    summary?: string;
    route?: string;
    anchor?: string;
    rank?: number;
  }): DocsSearchEntry {
    return {
      uid: entry.uid,
      name: entry.name,
      longname: entry.longname,
      kind: entry.kind,
      summary: entry.summary,
      route: entry.route,
      anchor: entry.anchor,
      rank: entry.rank,
    };
  }
}

/**
 * @description Wraps search index entries in a DocsSearchView model.
 * @summary Convenience factory for the search view embedded in the sidebar
 * navigation; the given entries are passed through unchanged.
 * @param {DocsSearchEntry[]} entries - ranked search index entries to expose.
 * @returns {DocsSearchView} a search view model carrying the given entries.
 * @function buildSearchView
 * @category UI
 * @memberOf module:docaf
 */
export function buildSearchView(entries: DocsSearchEntry[]): DocsSearchView {
  return new DocsSearchView({ entries });
}

/**
 * @description Builds the plain, serializable view record for a documented component.
 * @summary Maps a DocComponentModel together with its property and event models
 * into a DocsComponentViewEntry: properties become "input" rows and events carry
 * their payload type text. Used to feed the DocsComponentView model.
 * @param {DocComponentModel} component - the component record to describe.
 * @param {DocComponentPropertyModel[]} properties - input properties of the component.
 * @param {DocComponentEventModel[]} events - output events of the component.
 * @returns {DocsComponentViewEntry} the renderer-independent component view record.
 * @function componentView
 * @category UI
 * @memberOf module:docaf
 */
export function componentView(
  component: DocComponentModel,
  properties: DocComponentPropertyModel[],
  events: DocComponentEventModel[]
): DocsComponentViewEntry {
  return {
    uid: component.uid,
    name: component.name,
    selector: component.selector,
    framework: component.framework,
    properties: properties.map((property) => ({
      name: property.name,
      alias: property.alias,
      kind: "input",
      typeText: property.typeText,
      required: property.required,
      optional: property.optional,
      defaultValue: property.defaultValue,
      description: property.description,
    })),
    events: events.map((event) => ({
      name: event.name,
      payloadTypeText: event.payloadTypeText,
      description: event.description,
    })),
  };
}

/**
 * @description Normalizes an arbitrary path into a canonical documentation route.
 * @summary Keeps only the fragment after the last "#" (route records store
 * their anchor as a fragment), then strips any query string, prefixes a
 * leading "/" and removes trailing slashes. An empty or falsy path normalizes
 * to "/".
 * @param {string} path - raw route or URL path to normalize.
 * @returns {string} the canonical documentation route.
 * @function normalizeDocsRoute
 * @category UI
 * @memberOf module:docaf
 */
export function normalizeDocsRoute(path: string): string {
  return normalizeRoute(path);
}

/**
 * @description Asserts that a path normalizes to a rooted documentation route.
 * @summary Normalizes the given path with normalizeDocsRoute and returns the
 * resulting route. If the normalized route is not rooted at "/", an
 * InternalError is thrown; this serves as a defensive guard for callers that
 * require a guaranteed absolute route.
 * @param {string} path - raw route to validate and normalize.
 * @returns {string} the normalized, "/"-rooted documentation route.
 * @throws {InternalError} when the normalized route is not rooted at "/".
 * @function assertDocsPageRoute
 * @category UI
 * @memberOf module:docaf
 */
export function assertDocsPageRoute(path: string): string {
  const route = normalizeRoute(path);
  if (!route.startsWith("/"))
    throw new InternalError(`Invalid documentation route: ${path}`);
  return route;
}

