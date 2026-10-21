import type { DocsDatabase } from "../database/DocsDatabase";
import { DocLookupModel, DocsIds } from "../models";
import type { DocletModel } from "../models";

interface LookupBucket {
  lookupKind: string;
  value: string;
  docletUids: Set<string>;
  pageUids: Set<string>;
}

function bucketKey(lookupKind: string, value: string): string {
  return `${lookupKind}\u0000${value}`;
}

function addDoclet(
  buckets: Map<string, LookupBucket>,
  lookupKind: string,
  value: string | undefined,
  uid: string
): void {
  if (!value) return;
  const key = bucketKey(lookupKind, value);
  const existing = buckets.get(key);
  const bucket =
    existing ??
    ({
      lookupKind,
      value,
      docletUids: new Set<string>(),
      pageUids: new Set<string>(),
    } satisfies LookupBucket);
  bucket.docletUids.add(uid);
  buckets.set(key, bucket);
}

function addPage(
  buckets: Map<string, LookupBucket>,
  lookupKind: string,
  value: string | undefined,
  uid: string
): void {
  if (!value) return;
  const key = bucketKey(lookupKind, value);
  const existing = buckets.get(key);
  const bucket =
    existing ??
    ({
      lookupKind,
      value,
      docletUids: new Set<string>(),
      pageUids: new Set<string>(),
    } satisfies LookupBucket);
  bucket.pageUids.add(uid);
  buckets.set(key, bucket);
}

/**
 * @description Builds indexable lookup models from doclets and pages.
 * @summary Buckets every doclet by `kind`, `memberof`, `longname`, `category`, `subcategory`,
 * and `package`, and every page by `route` and `page-kind`, collecting the owning uids per
 * bucket. Emits one `DocLookupModel` per bucket with a deterministic composite uid via
 * `DocsIds.lookup`, sorted uid lists, and models sorted by uid; empty values are skipped.
 * @example
 * const doclets = await database.doclets.select().execute();
 * const pages = await database.pages.select().execute();
 * const lookups = buildDocLookupModels(doclets, pages);
 * await database.lookups.createAll(lookups);
 * @param {DocletModel[]} doclets - Doclets to index.
 * @param {Array.<{uid: string, route: string, kind: string}>} pages - Pages to index.
 * @returns {DocLookupModel[]} Deterministically ordered lookup models ready for persistence.
 * @memberOf module:docaf
 */
export function buildDocLookupModels(
  doclets: readonly DocletModel[],
  pages: readonly { uid: string; route: string; kind: string }[]
): DocLookupModel[] {
  const buckets = new Map<string, LookupBucket>();
  for (const doclet of doclets) {
    addDoclet(buckets, "kind", doclet.kind, doclet.uid);
    addDoclet(buckets, "memberof", doclet.memberof, doclet.uid);
    addDoclet(buckets, "longname", doclet.longname, doclet.uid);
    addDoclet(buckets, "category", doclet.category, doclet.uid);
    addDoclet(buckets, "subcategory", doclet.subCategory, doclet.uid);
    addDoclet(buckets, "package", doclet.package, doclet.uid);
  }
  for (const page of pages) {
    addPage(buckets, "route", page.route, page.uid);
    addPage(buckets, "page-kind", page.kind, page.uid);
  }

  return [...buckets.values()]
    .map(
      (bucket) =>
        new DocLookupModel({
          uid: DocsIds.lookup(bucket.lookupKind, bucket.value),
          lookupKind: bucket.lookupKind,
          value: bucket.value,
          docletUids: [...bucket.docletUids].sort(),
          pageUids: [...bucket.pageUids].sort(),
        })
    )
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

/**
 * @description Rebuilds the lookup table from the current doclets and pages in the database.
 * @summary Reads all doclets and pages, regenerates the lookup models via
 * `buildDocLookupModels`, deletes every existing lookup entry, and recreates the fresh set, so
 * the `lookups` table always matches the current content. Returns the newly created models.
 * @example
 * await rebuildDocLookups(database);
 * @param {DocsDatabase} database - Docs database whose lookups are rebuilt in place.
 * @returns {Promise<DocLookupModel[]>} The rebuilt lookup models now stored in the database.
 * @memberOf module:docaf
 */
export async function rebuildDocLookups(
  database: DocsDatabase
): Promise<DocLookupModel[]> {
  const [doclets, pages] = await Promise.all([
    database.doclets.select().execute(),
    database.pages.select().execute(),
  ]);
  const lookups = buildDocLookupModels(doclets, pages);
  const existing = await database.lookups.select().execute();
  if (existing.length)
    await database.lookups.deleteAll(existing.map((lookup) => lookup.uid));
  if (lookups.length) await database.lookups.createAll(lookups);
  return lookups;
}
