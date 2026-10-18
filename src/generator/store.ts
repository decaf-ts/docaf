import type { Repository } from "@decaf-ts/core";
import type { RamAdapter } from "@decaf-ts/core/ram";
import type { DocsDatabase } from "../database/DocsDatabase";
import type { DocsModel } from "../models";
import { DocsTableNames, type DocsTableName } from "../snapshot";

/**
 * Extraction tables are fully owned by the generator. Publication tables are
 * written by the publisher.
 */
export const EXTRACTION_TABLES: readonly DocsTableName[] = [
  "components",
  "componentProperties",
  "componentEvents",
  "componentPreviews",
  "sources",
  "examples",
  "tags",
  "types",
  "parameters",
  "returns",
  "signatures",
  "references",
  "doclets",
];

const CHILD_FIRST: readonly DocsTableName[] = [
  "componentPreviews",
  "componentProperties",
  "componentEvents",
  "components",
  "sources",
  "examples",
  "tags",
  "returns",
  "parameters",
  "signatures",
  "types",
  "references",
  "doclets",
];

/**
 * @description In-memory staging store for generated documentation models.
 * @summary Keeps one `Map` per known docs table (doclets, components, tags,
 * types, signatures, ...), keyed by each model's `uid`; re-adding a uid is a
 * no-op. Tables are queried through `get`, which returns the records sorted by
 * uid for deterministic output, and are persisted into a `DocsDatabase` through
 * `persist`, which replaces prior extraction-table rows child-first. The
 * pipeline writes into a single instance shared by all plugins of a build.
 * @class GeneratedDocsStore
 */
export class GeneratedDocsStore {
  private readonly tables = new Map<DocsTableName, Map<string, DocsModel>>();

  constructor() {
    for (const table of DocsTableNames)
      this.tables.set(table, new Map<string, DocsModel>());
  }

  add<M extends DocsModel>(table: DocsTableName, model: M): M {
    const bucket = this.tables.get(table);
    if (!bucket)
      throw new Error(`Unknown docs table "${table}"`);
    const uid = String((model as unknown as { uid: string }).uid);
    if (!uid) throw new Error(`Cannot add a ${table} model without a uid`);
    if (bucket.has(uid)) return bucket.get(uid) as M;
    bucket.set(uid, model);
    return model;
  }

  addAll<M extends DocsModel>(table: DocsTableName, models: readonly M[]): M[] {
    return models.map((model) => this.add(table, model));
  }

  get<M extends DocsModel>(table: DocsTableName): M[] {
    const bucket = this.tables.get(table);
    if (!bucket) return [];
    return [...bucket.values()].sort((a, b) =>
      String(a.uid).localeCompare(String(b.uid))
    ) as M[];
  }

  has(table: DocsTableName, uid: string): boolean {
    return this.tables.get(table)?.has(uid) ?? false;
  }

  size(table?: DocsTableName): number {
    if (table) return this.tables.get(table)?.size ?? 0;
    let total = 0;
    for (const bucket of this.tables.values()) total += bucket.size;
    return total;
  }

  counts(): Record<string, number> {
    return Object.fromEntries(
      DocsTableNames.map((table) => [table, this.size(table)])
    );
  }

  /**
   * Persists the extraction tables. Only called after the pipeline discovered
   * no errors, so a failed build never leaves a partial dataset behind.
   */
  async persist(database: DocsDatabase): Promise<void> {
    await database.initialize();
    const repositories = database.repositories();
    for (const table of CHILD_FIRST) {
      const repository = repositories[table] as Repository<
        DocsModel,
        RamAdapter
      >;
      const existing = await repository.select().execute();
      if (existing.length)
        await repository.deleteAll(
          existing.map((model) => String((model as DocsModel).uid))
        );
    }
    for (const table of EXTRACTION_TABLES) {
      const models = this.get(table);
      if (!models.length) continue;
      const repository = repositories[table] as Repository<
        DocsModel,
        RamAdapter
      >;
      await repository.createAll(models);
    }
  }
}
