import { DocLinkModel, DocRouteModel, DocsIds, type DocletModel } from "../models";

/**
 * @description Link rendering mode for generated hrefs.
 * @summary `hash` prefixes hrefs with `#` for static deployments that cannot
 * rewrite URLs, while `history` emits bare paths for servers with a docs
 * fallback route. Stored routes stay renderer-independent either way.
 * @memberOf module:docaf
 */
export type LinkRouting = "hash" | "history";

/**
 * @description Construction options for the LinkRegistry.
 * @summary `routing` selects the href prefix mode and defaults to hash routing
 * for static deployments (TDS 8.6). `basePath` is stripped of its trailing
 * slash and prefixes every generated route.
 */
export interface LinkRegistryOptions {
  /** Default hash routing for static deployments (TDS §8.6). */
  routing?: LinkRouting;
  basePath?: string;
}

/**
 * @description Resolved destination of a doclet link.
 * @summary Maps a doclet's `longname` to its publication coordinates: the
 * portable `route` (owner page route for members), the optional `anchor`
 * fragment for member entries, and the stable `pageUid` of the page hosting
 * the target. Consumed by navigation, search and page builders to link
 * symbols without re-deriving routes.
 */
export interface DocLinkTarget {
  uid: string;
  longname: string;
  route: string;
  anchor?: string;
  pageUid: string;
}

/**
 * @description Output of LinkRegistry.register().
 * @summary `routes` and `links` are the persisted DocRouteModel and
 * DocLinkModel records (sorted by route and uid respectively); `targets` maps
 * every registered longname to its DocLinkTarget for later lookups via
 * resolve()/href(). Registering a doclet also stamps its `linkId` and, for
 * members, its `anchor` back onto the doclet models.
 */
export interface LinkRegistration {
  routes: DocRouteModel[];
  links: DocLinkModel[];
  targets: Map<string, DocLinkTarget>;
}

const PLURAL: Record<string, string> = {
  class: "classes",
  interface: "interfaces",
  function: "functions",
  typedef: "typedefs",
  enum: "enums",
  module: "modules",
  namespace: "namespaces",
  event: "events",
  mixin: "mixins",
  external: "externals",
  component: "components",
  tutorial: "tutorials",
};

const PAGE_KINDS = new Set([
  "class",
  "interface",
  "function",
  "typedef",
  "enum",
  "module",
  "namespace",
  "external",
  "mixin",
  "tutorial",
]);

function slug(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w$.-]/g, "");
}

/**
 * @description Resolves the page kind used for routing and layout selection.
 * @summary Component-hosted doclets (those carrying a `componentId`) always
 * map to the "component" kind, constants map to "member", and every other
 * doclet keeps its own `kind`. The result feeds LinkRegistry route pluralization
 * and page/layout kind selection.
 * @param {DocletModel} doclet - The doclet whose page kind is being derived.
 * @returns {string} The normalized page kind ("component", "member", or the
 * doclet's original kind).
 * @memberOf module:docaf
 */
export function pageKindOf(doclet: DocletModel): string {
  if (doclet.componentId) return "component";
  if (doclet.kind === "constant") return "member";
  return doclet.kind;
}

/**
 * @description Port of `helper.createLink()` / `helper.registerLink()` as data.
 * @summary Longnames map to portable routes; members add anchors. The default href
 * format is hash routing, but stored routes stay renderer-independent.
 * @class LinkRegistry
 */
export class LinkRegistry {
  private readonly routing: "hash" | "history";
  private readonly basePath: string;
  private readonly targets = new Map<string, DocLinkTarget>();
  private readonly owners = new Map<string, DocletModel>();

  constructor(options: LinkRegistryOptions = {}) {
    this.routing = options.routing ?? "hash";
    this.basePath = (options.basePath ?? "").replace(/\/$/, "");
  }

  register(doclets: readonly DocletModel[]): LinkRegistration {
    this.targets.clear();
    this.owners.clear();
    const routes: DocRouteModel[] = [];
    const links: DocLinkModel[] = [];
    const byUid = new Map(doclets.map((doclet) => [doclet.uid, doclet]));
    const containerUids = new Set(
      doclets
        .filter(
          (doclet) => doclet.kind === "module" || doclet.kind === "namespace"
        )
        .map((doclet) => doclet.uid)
    );

    for (const doclet of doclets) {
      if (doclet.memberofUid || doclet.memberof) {
        const ownerIsContainer =
          doclet.memberofUid !== undefined &&
          containerUids.has(doclet.memberofUid);
        if (!ownerIsContainer) continue;
      }
      if (!PAGE_KINDS.has(doclet.kind) && !doclet.componentId) continue;
      this.owners.set(doclet.uid, doclet);
      const kind = pageKindOf(doclet);
      const route = this.routeFor(doclet, kind);
      const target: DocLinkTarget = {
        uid: doclet.uid,
        longname: doclet.longname,
        route,
        pageUid: DocsIds.page(doclet.uid),
      };
      this.targets.set(doclet.longname, target);
      routes.push(
        new DocRouteModel({
          uid: DocsIds.route(route),
          route,
          pageUid: target.pageUid,
          kind,
          name: doclet.name,
          anchor: doclet.anchor,
          legacyRoutes: this.legacyRoutes(doclet, route),
        })
      );
      const self = this.link(doclet, doclet, route, undefined, "self");
      links.push(self);
      doclet.linkId = self.uid;
      doclet.anchor = undefined;
    }

    const ordered = [...doclets].sort((a, b) =>
      a.longname.localeCompare(b.longname) || a.uid.localeCompare(b.uid)
    );
    const anchors = new Map<string, number>();
    for (const doclet of ordered) {
      if (!doclet.memberofUid && !doclet.memberof) continue;
      const owner =
        (doclet.memberofUid ? byUid.get(doclet.memberofUid) : undefined) ??
        doclets.find((candidate) => candidate.longname === doclet.memberof);
      if (!owner) continue;
      if (containerUids.has(owner.uid)) continue;
      const ownerTarget = this.targets.get(owner.longname);
      if (!ownerTarget) continue;
      const base = slug(doclet.name) || "member";
      const key = `${ownerTarget.route}#${base}`;
      const seen = anchors.get(key) ?? 0;
      anchors.set(key, seen + 1);
      const anchor = seen === 0 ? base : `${base}-${seen}`;
      doclet.anchor = anchor;
      const target: DocLinkTarget = {
        uid: doclet.uid,
        longname: doclet.longname,
        route: ownerTarget.route,
        anchor,
        pageUid: ownerTarget.pageUid,
      };
      this.targets.set(doclet.longname, target);
      const link = this.link(owner, doclet, ownerTarget.route, anchor, "member");
      links.push(link);
      doclet.linkId = link.uid;
    }

    routes.sort((a, b) => a.route.localeCompare(b.route));
    links.sort((a, b) => a.uid.localeCompare(b.uid));
    return { routes, links, targets: this.targets };
  }

  resolve(longname: string): DocLinkTarget | undefined {
    return this.targets.get(longname);
  }

  href(longname: string): string | undefined {
    const target = this.targets.get(longname);
    if (!target) return undefined;
    const prefix = this.routing === "hash" ? "#" : "";
    return `${prefix}${target.route}${target.anchor ? `#${target.anchor}` : ""}`;
  }

  routeOf(longname: string): string | undefined {
    return this.targets.get(longname)?.route;
  }

  anchorOf(longname: string): string | undefined {
    return this.targets.get(longname)?.anchor;
  }

  private routeFor(doclet: DocletModel, kind: string): string {
    const plural = PLURAL[kind] ?? `${kind}s`;
    return `${this.basePath}/docs/${plural}/${encodeURIComponent(doclet.name)}`;
  }

  private anchorFor(doclet: DocletModel): string {
    const base = slug(doclet.name) || "member";
    const overload = doclet.uid.match(/#[^:]+:(\d+)$/);
    if (!overload || overload[1] === "0") return base;
    return `${base}-${overload[1]}`;
  }

  private link(
    owner: DocletModel,
    target: DocletModel,
    route: string,
    anchor: string | undefined,
    role: string
  ): DocLinkModel {
    return new DocLinkModel({
      uid: DocsIds.link(owner.uid, target.longname, role),
      sourceUid: owner.uid,
      role,
      targetLongname: target.longname,
      targetUid: target.uid,
      route,
      anchor,
    });
  }

  private legacyRoutes(doclet: DocletModel, route: string): string[] {
    const legacy = [`${doclet.name}.html`];
    if (doclet.longname.startsWith("module:"))
      legacy.push(`${doclet.longname.replace("module:", "module-")}.html`);
    if (route !== legacy[0]) legacy.push(route);
    return legacy;
  }
}
