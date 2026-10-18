import {
  DocNavigationItemModel,
  DocsIds,
  type DocletModel,
} from "../models";
import type { LinkRegistry } from "./LinkRegistry";

/**
 * @description Canonical ordering of navigation groups.
 * @summary Lists the sidebar group keys in display order: tutorials, modules,
 * externals, namespaces, classes, interfaces, events, mixins, components and
 * globals. Consumed as the default `navTypes` argument of
 * NavigationBuilder.buildNav/buildGroupNav and by DecafPublisher when building
 * the navigation tree.
 */
export const NAV_GROUP_ORDER = [
  "tutorials",
  "modules",
  "externals",
  "namespaces",
  "classes",
  "interfaces",
  "events",
  "mixins",
  "components",
  "globals",
] as const;

/**
 * @description Human-readable headings for navigation groups.
 * @summary Maps each NAV_GROUP_ORDER key (and any other group key) to the
 * sidebar heading label, e.g. "classes" -> "Classes" and "globals" ->
 * "Global". buildGroupNav looks groups up by key, falling back to the raw key
 * when no label is defined.
 */
export const NAV_GROUP_LABELS: Record<string, string> = {
  tutorials: "Tutorials",
  modules: "Modules",
  externals: "Externals",
  namespaces: "Namespaces",
  classes: "Classes",
  interfaces: "Interfaces",
  events: "Events",
  mixins: "Mixins",
  components: "Components",
  globals: "Global",
};

/**
 * @description Construction options for the NavigationBuilder.
 * @summary `links` lets the builder resolve each symbol's route/anchor through
 * the LinkRegistry instead of leaving navigation items unlinked.
 * `useLongnameInNav` renders full longnames rather than bare names, and
 * `includePrivate` keeps private members in the classified groups.
 */
export interface NavigationBuilderOptions {
  links?: LinkRegistry;
  useLongnameInNav?: boolean;
  includePrivate?: boolean;
}

/**
 * @description Slim projection of a published tutorial for navigation.
 * @summary Carries the tutorial's `uid`, machine `name`, display `title` and
 * optional `route`. DecafPublisher maps built tutorials onto this shape so
 * buildNav can inject a "tutorials" group without depending on the full
 * DocTutorialModel.
 */
export interface TutorialNavigationEntry {
  uid: string;
  name: string;
  title: string;
  route?: string;
}

/**
 * @description Doclets grouped by navigation group key.
 * @summary Maps group keys (e.g. "classes", "interfaces", "globals",
 * "components", "tutorials") to the doclets belonging to each group, each list
 * sorted by longname then uid. Produced by NavigationBuilder.classify and
 * consumed by buildGroupNav, optionally split further by doclet category.
 */
export type ClassifiedMembers = Record<string, DocletModel[]>;

interface NavState {
  navigationUid: string;
  navigationId: string;
  items: DocNavigationItemModel[];
  seen: Set<string>;
  order: number;
}

function navigationRoot(navigationUid: string): string {
  const prefix = "navigation:";
  return navigationUid.startsWith(prefix)
    ? navigationUid.slice(prefix.length)
    : navigationUid;
}

function newState(navigationUid: string): NavState {
  const root = navigationRoot(navigationUid);
  return {
    navigationUid: DocsIds.navigation(root),
    navigationId: root,
    items: [],
    seen: new Set<string>(),
    order: 0,
  };
}

/**
 * Port of BetterDocs' `buildNav`, `buildGroupNav` and `buildMemberNav` as
 * data. Ordering, category/subcategory grouping, visibility filtering and
 * deduplication match the original sidebar behavior.
 */
export class NavigationBuilder {
  constructor(private readonly options: NavigationBuilderOptions = {}) {}

  classify(doclets: readonly DocletModel[]): ClassifiedMembers {
    const members: ClassifiedMembers = {};
    const add = (group: string, doclet: DocletModel): void => {
      const list = members[group] ?? [];
      list.push(doclet);
      members[group] = list;
    };
    for (const doclet of doclets) {
      if (doclet.access === "private" && !this.options.includePrivate)
        continue;
      if (doclet.metadata?.undocumented === "true") continue;
      const isComponent =
        Boolean(doclet.componentId) || doclet.metadata?.component === "true";
      if (doclet.kind === "class") {
        add(isComponent ? "components" : "classes", doclet);
        continue;
      }
      if (doclet.kind === "interface") add("interfaces", doclet);
      else if (doclet.kind === "module") add("modules", doclet);
      else if (doclet.kind === "namespace") add("namespaces", doclet);
      else if (doclet.kind === "event") add("events", doclet);
      else if (doclet.kind === "mixin") add("mixins", doclet);
      else if (doclet.kind === "external") add("externals", doclet);
      else if (!doclet.memberof)
        add("globals", doclet);
    }
    for (const group of Object.keys(members))
      members[group].sort(
        (a, b) =>
          a.longname.localeCompare(b.longname) || a.uid.localeCompare(b.uid)
      );
    return members;
  }

  buildNav(
    doclets: readonly DocletModel[],
    navTypes?: readonly string[],
    navigationUid = "main",
    tutorials: readonly TutorialNavigationEntry[] = []
  ): DocNavigationItemModel[] {
    const state = newState(navigationUid);
    const root = this.createItem(state, {
      label: "Documentation",
      kind: "root",
      parentUid: undefined,
      path: "root",
    });
    const classified = this.classify(doclets);
    if (tutorials.length) {
      classified.tutorials = tutorials.map(
        (tutorial) =>
          ({
            uid: tutorial.uid,
            name: tutorial.name,
            longname: tutorial.name,
            kind: "tutorial",
            name2: tutorial.title,
            route: tutorial.route,
          }) as unknown as DocletModel
      );
    }
    const types = navTypes ?? NAV_GROUP_ORDER;
    const rootScope: ClassifiedMembers = {};
    const categorised = new Map<string, ClassifiedMembers>();
    for (const type of types) {
      for (const doclet of classified[type] ?? []) {
        if (doclet.category) {
          const group = categorised.get(doclet.category) ?? {};
          group[type] = group[type] ?? [];
          group[type].push(doclet);
          categorised.set(doclet.category, group);
        } else {
          rootScope[type] = rootScope[type] ?? [];
          rootScope[type].push(doclet);
        }
      }
    }

    this.buildGroupNav(rootScope, undefined, root.uid, state, types);
    for (const category of [...categorised.keys()].sort())
      this.buildGroupNav(
        categorised.get(category)!,
        category,
        root.uid,
        state,
        types
      );

    return state.items;
  }

  buildGroupNav(
    members: ClassifiedMembers,
    title: string | undefined,
    parentUid: string,
    state: NavState = newState("main"),
    navTypes: readonly string[] = NAV_GROUP_ORDER
  ): DocNavigationItemModel[] {
    const category = title
      ? this.createItem(state, {
          label: title,
          kind: "category",
          parentUid,
          path: `category:${title}`,
        })
      : undefined;
    const groupParent = category?.uid ?? parentUid;
    for (const type of navTypes) {
      const items = members[type] ?? [];
      if (!items.length) continue;
      this.buildMemberNav(
        items,
        NAV_GROUP_LABELS[type] ?? type,
        groupParent,
        state,
        type
      );
    }
    return state.items;
  }

  buildMemberNav(
    items: readonly DocletModel[],
    heading: string,
    parentUid: string,
    state: NavState = newState("main"),
    group = heading.toLowerCase()
  ): DocNavigationItemModel[] {
    const groupItem = this.createItem(state, {
      label: heading,
      kind: "group",
      parentUid,
      path: `group:${parentUid}:${group}`,
    });
    const subCategories = new Map<string, DocletModel[]>();
    for (const item of items) {
      const key = item.subCategory ?? "";
      const list = subCategories.get(key) ?? [];
      list.push(item);
      subCategories.set(key, list);
    }
    for (const [subCategory, subCategoryItems] of subCategories) {
      const parent = subCategory
        ? this.createItem(state, {
            label: subCategory,
            kind: "subcategory",
            parentUid: groupItem.uid,
            path: `subcategory:${groupItem.uid}:${subCategory}`,
          })
        : groupItem;
      for (const item of subCategoryItems) {
        if (state.seen.has(item.longname)) continue;
        state.seen.add(item.longname);
        const displayName = this.options.useLongnameInNav
          ? item.longname
          : item.name;
        const link = this.options.links?.resolve(item.longname);
        const tutorial = item.kind === "tutorial";
        this.createItem(state, {
          label: tutorial
            ? (item as unknown as { name2?: string }).name2 ?? displayName
            : displayName.replace(/\b(module|event):/g, ""),
          kind: item.kind,
          parentUid: parent.uid,
          route: tutorial
            ? (item as unknown as { route?: string }).route
            : link?.route,
          anchor: tutorial ? undefined : link?.anchor,
          docletUid: tutorial ? undefined : item.uid,
          path: `symbol:${parent.uid}:${item.longname}`,
        });
      }
    }
    return state.items;
  }

  private createItem(
    state: NavState,
    input: {
      label: string;
      kind: string;
      parentUid?: string;
      route?: string;
      anchor?: string;
      docletUid?: string;
      path: string;
    }
  ): DocNavigationItemModel {
    const item = new DocNavigationItemModel({
      uid: DocsIds.navigationItem(
        state.navigationId,
        input.path
      ),
      navigationUid: state.navigationUid,
      parentUid: input.parentUid,
      label: input.label,
      kind: input.kind,
      route: input.route,
      anchor: input.anchor,
      docletUid: input.docletUid,
      order: state.order,
      childUids: [],
    });
    state.order += 1;
    state.items.push(item);
    if (input.parentUid) {
      const parent = state.items.find(
        (candidate) => candidate.uid === input.parentUid
      );
      if (parent) parent.childUids = [...parent.childUids, item.uid];
    }
    return item;
  }
}

export type { NavState };
