import { Condition, Repository } from "@decaf-ts/core";
import { RamAdapter } from "@decaf-ts/core/ram";
import type { Model } from "@decaf-ts/decorator-validation";
import type { DocsDatabase } from "../database/DocsDatabase";
import {
  DocComponentModel,
  DocLayoutModel,
  DocLinkModel,
  DocLookupModel,
  DocNavigationItemModel,
  DocPageModel,
  DocRouteModel,
  DocSearchEntryModel,
  DocTutorialModel,
  DocletModel,
} from "../models";

function byUid(a: { uid: string }, b: { uid: string }): number {
  return a.uid.localeCompare(b.uid);
}

function byOrderThenUid(
  a: { uid: string; order?: number },
  b: { uid: string; order?: number }
): number {
  return (a.order ?? 0) - (b.order ?? 0) || byUid(a, b);
}

/**
 * @description Read-only query facade over the docs database repositories.
 * @summary Wraps a `DocsDatabase` with typed selectors for doclets (by uid, longname, kind,
 * membership, category, package), lookups, pages, routes, links, navigation trees, tutorials,
 * components, layouts, and search entries. List-returning methods sort deterministically (by
 * `uid`, or by `order` then `uid`), and `search` performs a case-insensitive substring scan over
 * entry names, summaries, and tokens ranked by entry rank with a configurable limit. The
 * underlying database must be initialized before querying.
 * @example
 * const query = new DocsQueryService(database);
 * const doclets = await query.findByKind("class");
 * const entries = await query.search("adapter", 10);
 * @class DocsQueryService
 */
export class DocsQueryService {
  constructor(private readonly db: DocsDatabase) {}

  private async select<M extends Model>(
    repository: Repository<M, RamAdapter>,
    condition: Condition<M>
  ): Promise<M[]> {
    return repository.select().where(condition).execute();
  }

  async allDoclets(): Promise<DocletModel[]> {
    const doclets = await this.db.doclets.select().execute();
    return doclets.sort(byUid);
  }

  async findDocletByUid(uid: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("uid").eq(uid)
    );
  }

  async findByLongname(longname: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("longname").eq(longname)
    );
  }

  async findByKind(kind: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("kind").eq(kind)
    );
  }

  async findMembers(memberof: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("memberof").eq(memberof)
    );
  }

  async findMemberOfUid(memberofUid: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("memberofUid").eq(memberofUid)
    );
  }

  async findByCategory(
    category: string,
    subCategory?: string
  ): Promise<DocletModel[]> {
    const condition = subCategory
      ? Condition.attr<DocletModel>("category")
          .eq(category)
          .and(Condition.attr<DocletModel>("subCategory").eq(subCategory))
      : Condition.attr<DocletModel>("category").eq(category);
    return this.select(this.db.doclets, condition);
  }

  async findByPackage(packageName: string): Promise<DocletModel[]> {
    return this.select(
      this.db.doclets,
      Condition.attr<DocletModel>("package").eq(packageName)
    );
  }

  async findLookups(
    lookupKind: string,
    value?: string
  ): Promise<DocLookupModel[]> {
    const condition = value
      ? Condition.attr<DocLookupModel>("lookupKind")
          .eq(lookupKind)
          .and(Condition.attr<DocLookupModel>("value").eq(value))
      : Condition.attr<DocLookupModel>("lookupKind").eq(lookupKind);
    const lookups = await this.select(this.db.lookups, condition);
    return lookups.sort(byOrderThenUid);
  }

  async findLookupDoclets(
    lookupKind: string,
    value: string
  ): Promise<DocletModel[]> {
    const lookups = await this.findLookups(lookupKind, value);
    const uids = new Set<string>();
    for (const lookup of lookups)
      for (const uid of lookup.docletUids ?? []) uids.add(uid);
    const doclets: DocletModel[] = [];
    for (const uid of [...uids].sort()) {
      const found = await this.findDocletByUid(uid);
      doclets.push(...found);
    }
    return doclets;
  }

  async findPageByUid(uid: string): Promise<DocPageModel[]> {
    return this.select(
      this.db.pages,
      Condition.attr<DocPageModel>("uid").eq(uid)
    );
  }

  async findPageByRoute(route: string): Promise<DocPageModel[]> {
    return this.select(
      this.db.pages,
      Condition.attr<DocPageModel>("route").eq(route)
    );
  }

  async findRoute(route: string): Promise<DocRouteModel[]> {
    return this.select(
      this.db.routes,
      Condition.attr<DocRouteModel>("route").eq(route)
    );
  }

  async findLinksFor(targetLongname: string): Promise<DocLinkModel[]> {
    const links = await this.select(
      this.db.links,
      Condition.attr<DocLinkModel>("targetLongname").eq(targetLongname)
    );
    return links.sort(byUid);
  }

  async findNavigation(navigationUid: string): Promise<DocNavigationItemModel[]> {
    const items = await this.select(
      this.db.navigation,
      Condition.attr<DocNavigationItemModel>("navigationUid").eq(
        navigationUid
      )
    );
    return items.sort(byOrderThenUid);
  }

  async findNavigationChildren(
    navigationUid: string,
    parentUid?: string
  ): Promise<DocNavigationItemModel[]> {
    const condition = parentUid
      ? Condition.attr<DocNavigationItemModel>("navigationUid")
          .eq(navigationUid)
          .and(
            Condition.attr<DocNavigationItemModel>("parentUid").eq(parentUid)
          )
      : Condition.attr<DocNavigationItemModel>("navigationUid").eq(
          navigationUid
        );
    const items = await this.select(this.db.navigation, condition);
    return items.sort(byOrderThenUid);
  }

  async findTutorialByUid(uid: string): Promise<DocTutorialModel[]> {
    return this.select(
      this.db.tutorials,
      Condition.attr<DocTutorialModel>("uid").eq(uid)
    );
  }

  async findTutorialByName(name: string): Promise<DocTutorialModel[]> {
    return this.select(
      this.db.tutorials,
      Condition.attr<DocTutorialModel>("name").eq(name)
    );
  }

  async findComponentsByFramework(
    framework: string
  ): Promise<DocComponentModel[]> {
    return this.select(
      this.db.components,
      Condition.attr<DocComponentModel>("framework").eq(framework)
    );
  }

  async findComponentByUid(uid: string): Promise<DocComponentModel[]> {
    return this.select(
      this.db.components,
      Condition.attr<DocComponentModel>("uid").eq(uid)
    );
  }

  async findLayoutByUid(uid: string): Promise<DocLayoutModel[]> {
    return this.select(
      this.db.layouts,
      Condition.attr<DocLayoutModel>("uid").eq(uid)
    );
  }

  async findSearchEntryByDocletUid(
    docletUid: string
  ): Promise<DocSearchEntryModel[]> {
    return this.select(
      this.db.search,
      Condition.attr<DocSearchEntryModel>("docletUid").eq(docletUid)
    );
  }

  async search(term: string, limit = 50): Promise<DocSearchEntryModel[]> {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return [];
    const entries = await this.db.search.select().execute();
    const matches = entries.filter((entry) => {
      const haystack = [
        entry.name,
        entry.longname,
        entry.kind,
        entry.category,
        entry.subCategory,
        entry.summary,
        ...(entry.tokens ?? []),
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
    return matches
      .sort((a, b) => b.rank - a.rank || byUid(a, b))
      .slice(0, limit);
  }
}
