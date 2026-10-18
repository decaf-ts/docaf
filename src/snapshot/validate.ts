import { ValidationError } from "@decaf-ts/db-decorators";
import type {
  DocsSnapshotTables,
  DocsSnapshotV1,
  DocsTableName,
} from "./records";
import { DocsTableNames } from "./tables";

/**
 * @description Error raised when a docs snapshot fails schema or reference validation.
 * @summary Extension of `ValidationError` carrying the fixed name
 * `"DocsSnapshotValidationError"`; thrown by `validateDocsSnapshot` (and therefore by snapshot
 * export and hydration) whenever a snapshot's shape, keys, or cross-references are invalid.
 * @class DocsSnapshotValidationError
 */
export class DocsSnapshotValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = "DocsSnapshotValidationError";
  }
}

interface ReferenceRule {
  field: string;
  table: DocsTableName;
  many?: boolean;
}

const REFERENCE_RULES: Record<DocsTableName, readonly ReferenceRule[]> = {
  doclets: [
    { field: "memberofUid", table: "doclets" },
    { field: "componentId", table: "components" },
    { field: "sourceId", table: "sources" },
    { field: "signatureIds", table: "signatures", many: true },
    { field: "typeIds", table: "types", many: true },
    { field: "propertyIds", table: "doclets", many: true },
    { field: "exampleIds", table: "examples", many: true },
    { field: "tagIds", table: "tags", many: true },
    { field: "referenceIds", table: "references", many: true },
    { field: "tutorialIds", table: "tutorials", many: true },
  ],
  tags: [{ field: "ownerUid", table: "doclets" }],
  types: [
    { field: "ownerUid", table: "doclets" },
    { field: "referenceUid", table: "doclets" },
  ],
  parameters: [
    { field: "signatureUid", table: "signatures" },
    { field: "typeId", table: "types" },
  ],
  returns: [
    { field: "signatureUid", table: "signatures" },
    { field: "typeId", table: "types" },
  ],
  signatures: [
    { field: "docletUid", table: "doclets" },
    { field: "parameterIds", table: "parameters", many: true },
    { field: "returnId", table: "returns" },
    { field: "yieldId", table: "returns" },
    { field: "typeIds", table: "types", many: true },
    { field: "referenceIds", table: "references", many: true },
  ],
  examples: [{ field: "ownerUid", table: "doclets" }],
  sources: [],
  references: [
    { field: "ownerUid", table: "doclets" },
    { field: "targetUid", table: "doclets" },
  ],
  components: [
    { field: "docletUid", table: "doclets" },
    { field: "propertyUids", table: "componentProperties", many: true },
    { field: "eventUids", table: "componentEvents", many: true },
    { field: "previewUids", table: "componentPreviews", many: true },
  ],
  componentProperties: [
    { field: "componentUid", table: "components" },
    { field: "typeId", table: "types" },
  ],
  componentEvents: [
    { field: "componentUid", table: "components" },
    { field: "payloadTypeId", table: "types" },
  ],
  componentPreviews: [{ field: "componentUid", table: "components" }],
  tutorials: [
    { field: "parentUid", table: "tutorials" },
    { field: "pageUid", table: "pages" },
    { field: "childUids", table: "tutorials", many: true },
    { field: "docletUids", table: "doclets", many: true },
  ],
  pages: [
    { field: "layoutId", table: "layouts" },
    { field: "routeId", table: "routes" },
    { field: "parentUid", table: "pages" },
    { field: "docletUids", table: "doclets", many: true },
    { field: "sectionUids", table: "sections", many: true },
    { field: "tutorialUids", table: "tutorials", many: true },
  ],
  sections: [
    { field: "pageUid", table: "pages" },
    { field: "docletUids", table: "doclets", many: true },
  ],
  routes: [{ field: "pageUid", table: "pages" }],
  links: [
    { field: "sourceUid", table: "doclets" },
    { field: "targetUid", table: "doclets" },
  ],
  navigation: [
    { field: "parentUid", table: "navigation" },
    { field: "docletUid", table: "doclets" },
    { field: "pageUid", table: "pages" },
    { field: "childUids", table: "navigation", many: true },
  ],
  search: [{ field: "docletUid", table: "doclets" }],
  lookups: [
    { field: "docletUids", table: "doclets", many: true },
    { field: "pageUids", table: "pages", many: true },
  ],
  layouts: [],
  manifests: [],
};

function fail(message: string): never {
  throw new DocsSnapshotValidationError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonSafe(value: unknown, path: string): void {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value as number))
      fail(`Non-finite number at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (value[key] === undefined)
        fail(`Undefined value at ${path}.${key}`);
      assertJsonSafe(value[key], `${path}.${key}`);
    }
    return;
  }
  fail(`Unsupported JSON value (${type}) at ${path}`);
}

function assertRecord(
  table: DocsTableName,
  index: number,
  record: unknown,
  seen: Set<string>
): string {
  const path = `tables.${table}[${index}]`;
  if (!isPlainObject(record)) fail(`Expected object at ${path}`);
  assertJsonSafe(record, path);
  const uid = record.uid;
  if (typeof uid !== "string" || uid.trim().length === 0)
    fail(`Missing string uid at ${path}`);
  if (seen.has(uid)) fail(`Duplicate key "${uid}" in tables.${table}`);
  seen.add(uid);
  return uid;
}

function assertReferences(
  tables: DocsSnapshotTables,
  keys: Record<DocsTableName, Set<string>>
): void {
  for (const table of DocsTableNames) {
    const records = (tables[table] ?? []) as unknown as Array<
      Record<string, unknown>
    >;
    for (const rule of REFERENCE_RULES[table]) {
      const targetKeys = keys[rule.table];
      records.forEach((record, index) => {
        const value = record[rule.field];
        if (value === undefined || value === null) return;
        const values = rule.many
          ? Array.isArray(value)
            ? value
            : fail(
                `Expected array at tables.${table}[${index}].${rule.field}`
              )
          : [value];
        for (const reference of values) {
          if (typeof reference !== "string")
            fail(
              `Expected string reference at tables.${table}[${index}].${rule.field}`
            );
          if (!targetKeys.has(reference))
            fail(
              `Unresolved reference "${reference}" at tables.${table}[${index}].${rule.field}`
            );
        }
      });
    }
  }
}

/**
 * @description Validates an unknown value against the V1 docs snapshot contract.
 * @summary Checks the top-level shape (`schemaVersion` 1, non-empty `project.name`/`version`,
 * non-empty `build.id`, string `build.sourceRevision`, known table names mapped to arrays), then
 * verifies every record is a plain JSON-safe object with a unique non-empty string `uid`, and
 * finally resolves all cross-table reference rules (e.g. `tagIds`, `docletUid`, `pageUids`)
 * against the collected keys. Acts as a type assertion, so a successful call narrows the input
 * to `DocsSnapshotV1`; it mutates nothing.
 * @example
 * const snapshot = JSON.parse(raw);
 * validateDocsSnapshot(snapshot); // throws if invalid; snapshot is now DocsSnapshotV1
 * @param {unknown} snapshot - Value to validate; typically a parsed snapshot file or response.
 * @returns {void} Nothing; pass/fail is expressed by throwing or asserting the type.
 * @throws {DocsSnapshotValidationError} On any shape, JSON-safety, duplicate-key, or
 * unresolved-reference violation, with a message naming the offending path.
 */
export function validateDocsSnapshot(
  snapshot: unknown
): asserts snapshot is DocsSnapshotV1 {
  if (!isPlainObject(snapshot)) fail("Docs snapshot must be an object");
  const version = snapshot.schemaVersion;
  if (version !== 1)
    fail(`Unsupported docs snapshot schema version: ${String(version)}`);
  const project = snapshot.project;
  if (!isPlainObject(project)) fail("Missing docs snapshot project");
  if (typeof project.name !== "string" || project.name.trim().length === 0)
    fail("Missing docs snapshot project.name");
  if (
    typeof project.version !== "string" ||
    project.version.trim().length === 0
  )
    fail("Missing docs snapshot project.version");
  const build = snapshot.build;
  if (!isPlainObject(build)) fail("Missing docs snapshot build");
  if (typeof build.id !== "string" || build.id.trim().length === 0)
    fail("Missing docs snapshot build.id");
  if (typeof build.sourceRevision !== "string")
    fail("Missing docs snapshot build.sourceRevision");
  const tables = snapshot.tables;
  if (!isPlainObject(tables)) fail("Missing docs snapshot tables");

  for (const name of Object.keys(tables)) {
    if (!(DocsTableNames as readonly string[]).includes(name))
      fail(`Unknown docs snapshot table "${name}"`);
    if (!Array.isArray(tables[name]))
      fail(`Expected array for docs snapshot table "${name}"`);
  }

  const keys = {} as Record<DocsTableName, Set<string>>;
  for (const table of DocsTableNames) {
    const records = (tables[table] ?? []) as unknown[];
    if (!Array.isArray(records))
      fail(`Expected array for docs snapshot table "${table}"`);
    const seen = new Set<string>();
    records.forEach((record, index) => assertRecord(table, index, record, seen));
    keys[table] = seen;
  }

  assertJsonSafe(tables, "tables");
  assertReferences(
    tables as unknown as DocsSnapshotTables,
    keys
  );
}
