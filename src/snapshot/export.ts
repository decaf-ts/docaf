import type { Repository } from "@decaf-ts/core";
import type { RamAdapter } from "@decaf-ts/core/ram";
import type { DocsDatabase } from "../database/DocsDatabase";
import type { DocsModel } from "../models";
import { stableHash, stableStringify } from "./canonical";
import type {
  DocsSnapshotTables,
  DocsSnapshotV1,
  DocsTableName,
} from "./records";
import { DocsTables } from "./tables";
import { validateDocsSnapshot } from "./validate";

/**
 * @description Project identity carried in a docs snapshot.
 * @summary Populates the `project` block of a `DocsSnapshotV1` with the documented project's
 * name and version; when not supplied at export time, values fall back to the stored manifest.
 */
export interface DocsSnapshotProject {
  name: string;
  version: string;
}

/**
 * @description Build metadata carried in a docs snapshot.
 * @summary Populates the `build` block of a `DocsSnapshotV1`; both fields are optional and fall
 * back to the stored manifest (or, for `id`, to a stable content hash) when omitted.
 */
export interface DocsSnapshotBuild {
  id?: string;
  sourceRevision?: string;
}

/**
 * @description Optional overrides applied while exporting a docs snapshot.
 * @summary Lets callers supply the project identity and build metadata instead of relying on the
 * manifest stored in the database; every field is optional.
 */
export interface ExportDocsSnapshotOptions {
  project?: DocsSnapshotProject;
  build?: DocsSnapshotBuild;
}

/**
 * @description Exports a `DocsSnapshotV1` from an initialized docs database.
 * @summary Reads every docs table through its repository, encodes all models with the table's
 * codec, and sorts records by `uid` for deterministic output. Project/build metadata comes from
 * `options` when given, otherwise from the first manifest record (with `"docaf"`/`"0.0.0"` and an
 * empty revision as final fallbacks); the build id defaults to a stable content hash of the
 * table records. The resulting snapshot is validated before being returned, so any malformed
 * content raises a validation error rather than a bad snapshot.
 * @example
 * const snapshot = await exportDocsSnapshot(database, {
 *   project: { name: "my-app", version: "1.2.3" },
 *   build: { id: "42", sourceRevision: "abc123" },
 * });
 * await fs.writeFile("docs-snapshot.json", JSON.stringify(snapshot));
 * @param {DocsDatabase} database - Initialized docs database to read all tables from.
 * @param {ExportDocsSnapshotOptions} options - Optional project and build metadata overrides.
 * @returns {Promise<DocsSnapshotV1>} A validated, JSON-safe snapshot of every docs table.
 * @throws {DocsSnapshotValidationError} When the assembled snapshot fails validation.
 */
export async function exportDocsSnapshot(
  database: DocsDatabase,
  options: ExportDocsSnapshotOptions = {}
): Promise<DocsSnapshotV1> {
  const tableRecords = {} as DocsSnapshotTables;
  for (const table of DocsTables) {
    const repository = database[table.name] as unknown as Repository<
      DocsModel,
      RamAdapter
    >;
    const models = await repository.select().execute();
    models.sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
    (tableRecords as unknown as Record<DocsTableName, unknown>)[table.name] =
      models.map((model) => table.codec.encode(model));
  }

  const manifests = tableRecords.manifests;
  const manifest = manifests[0];
  const project: DocsSnapshotProject = options.project ?? {
    name: manifest?.projectName ?? "docaf",
    version: manifest?.projectVersion ?? "0.0.0",
  };
  const sourceRevision =
    options.build?.sourceRevision ?? manifest?.sourceRevision ?? "";
  const id =
    options.build?.id ??
    manifest?.buildId ??
    stableHash(stableStringify(tableRecords));

  const snapshot: DocsSnapshotV1 = {
    schemaVersion: 1,
    project,
    build: { id, sourceRevision },
    tables: tableRecords,
  };
  validateDocsSnapshot(snapshot);
  return snapshot;
}
