import type { Repository } from "@decaf-ts/core";
import type { RamAdapter } from "@decaf-ts/core/ram";
import { NotFoundError } from "@decaf-ts/db-decorators";
import type { DocsDatabase } from "../database/DocsDatabase";
import type { DocsModel } from "../models";
import type { DocsSnapshotV1, DocsTableName } from "./records";
import { DocsTables } from "./tables";
import { validateDocsSnapshot } from "./validate";

async function upsertAll(
  repository: Repository<DocsModel, RamAdapter>,
  models: DocsModel[]
): Promise<void> {
  if (!models.length) return;
  const creates: DocsModel[] = [];
  const updates: DocsModel[] = [];
  for (const model of models) {
    const id = (model as unknown as Record<string, string>).uid;
    try {
      await repository.read(id);
      updates.push(model);
    } catch (error) {
      if (error instanceof NotFoundError) creates.push(model);
      else throw error;
    }
  }
  if (creates.length) await repository.createAll(creates);
  if (updates.length) await repository.updateAll(updates);
}

/**
 * @description Loads a `DocsSnapshotV1` into an initialized docs database.
 * @summary First validates the snapshot, then initializes the database and, for every docs table
 * with records, decodes each record into its model via the table's codec (sorted by `uid`) and
 * upserts it: existing `uid`s are updated, missing ones created. Table contents not present in
 * the snapshot are left untouched, and an invalid snapshot aborts before any write.
 * @example
 * const snapshot = JSON.parse(await fs.readFile("docs-snapshot.json", "utf8"));
 * const database = new DocsDatabase({ alias: "docs" });
 * await hydrateDocsDatabase(database, snapshot);
 * @param {DocsDatabase} database - Docs database whose repositories receive the snapshot models.
 * @param {DocsSnapshotV1} snapshot - Validated snapshot containing one record array per table.
 * @returns {Promise<void>} Resolves once every snapshot record has been written.
 * @throws {DocsSnapshotValidationError} When the snapshot fails schema or reference validation.
 * @memberOf module:docaf
 */
export async function hydrateDocsDatabase(
  database: DocsDatabase,
  snapshot: DocsSnapshotV1
): Promise<void> {
  validateDocsSnapshot(snapshot);
  await database.initialize();
  for (const table of DocsTables) {
    const records = (snapshot.tables as Record<DocsTableName, unknown[]>)[
      table.name
    ];
    if (!records || records.length === 0) continue;
    const models = records
      .map((record) => table.codec.decode(record as never))
      .sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
    const repository = database[table.name] as unknown as Repository<
      DocsModel,
      RamAdapter
    >;
    await upsertAll(repository, models);
  }
}
