import {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPreviewModel,
  DocComponentPropertyModel,
  DocExampleModel,
  DocLayoutModel,
  DocLinkModel,
  DocLookupModel,
  DocManifestModel,
  DocNavigationItemModel,
  DocPageModel,
  DocParameterModel,
  DocReferenceModel,
  DocReturnModel,
  DocRouteModel,
  DocSearchEntryModel,
  DocSectionModel,
  DocSignatureModel,
  DocSourceModel,
  DocTagModel,
  DocTutorialModel,
  DocTypeModel,
  DocletModel,
  type DocsModel,
} from "../models";
import { InternalError } from "@decaf-ts/db-decorators";
import {
  DocsCodecs,
  type DocsModelCodec,
} from "./codecs";
import type {
  DocsRecordBase,
  DocsTableName,
} from "./records";

/**
 * @description Definition of one docs snapshot table: its name, the model class backing it, and
 * the codec converting between model and portable record.
 * @summary The table `name` is a {@link DocsTableName} key matching the property name used in
 * {@link DocsSnapshotTables}; `model` is the constructor of the corresponding {@link DocsModel}
 * subclass; `codec` is the {@link DocsModelCodec} used by snapshot export/hydration to serialize
 * that model's records.
 */
export interface DocsTableDefinition {
  readonly name: DocsTableName;
  readonly model: new (arg?: any) => DocsModel;
  readonly codec: DocsModelCodec<DocsModel, DocsRecordBase>;
}

function defineTable(
  name: DocsTableName,
  model: new (arg?: any) => DocsModel,
  codec: unknown
): DocsTableDefinition {
  return {
    name,
    model,
    codec: codec as DocsModelCodec<DocsModel, DocsRecordBase>,
  };
}

/**
 * @description Registry of every docs snapshot table, pairing each table name with its Decaf model
 * class and record codec.
 * @summary An immutable, ordered list of {@link DocsTableDefinition} entries covering all docs
 * models (doclets and their dependent records, component metadata, publication artifacts, and
 * the manifest). Drives schema creation, snapshot export and hydration; consumers should access
 * entries by name via {@link docsTable} rather than by index.
 */
export const DocsTables: readonly DocsTableDefinition[] = [
  defineTable("doclets", DocletModel, DocsCodecs.doclets),
  defineTable("tags", DocTagModel, DocsCodecs.tags),
  defineTable("types", DocTypeModel, DocsCodecs.types),
  defineTable("parameters", DocParameterModel, DocsCodecs.parameters),
  defineTable("returns", DocReturnModel, DocsCodecs.returns),
  defineTable("signatures", DocSignatureModel, DocsCodecs.signatures),
  defineTable("examples", DocExampleModel, DocsCodecs.examples),
  defineTable("sources", DocSourceModel, DocsCodecs.sources),
  defineTable("references", DocReferenceModel, DocsCodecs.references),
  defineTable("components", DocComponentModel, DocsCodecs.components),
  defineTable(
    "componentProperties",
    DocComponentPropertyModel,
    DocsCodecs.componentProperties
  ),
  defineTable(
    "componentEvents",
    DocComponentEventModel,
    DocsCodecs.componentEvents
  ),
  defineTable(
    "componentPreviews",
    DocComponentPreviewModel,
    DocsCodecs.componentPreviews
  ),
  defineTable("tutorials", DocTutorialModel, DocsCodecs.tutorials),
  defineTable("pages", DocPageModel, DocsCodecs.pages),
  defineTable("sections", DocSectionModel, DocsCodecs.sections),
  defineTable("routes", DocRouteModel, DocsCodecs.routes),
  defineTable("links", DocLinkModel, DocsCodecs.links),
  defineTable("navigation", DocNavigationItemModel, DocsCodecs.navigation),
  defineTable("search", DocSearchEntryModel, DocsCodecs.search),
  defineTable("lookups", DocLookupModel, DocsCodecs.lookups),
  defineTable("layouts", DocLayoutModel, DocsCodecs.layouts),
  defineTable("manifests", DocManifestModel, DocsCodecs.manifests),
];

/**
 * @description Ordered list of all docs table names, derived from {@link DocsTables}.
 * @summary A read-only array of every {@link DocsTableName} literal in registration order; useful
 * for iterating tables generically (schema setup, per-table export/import, validations).
 */
export const DocsTableNames: readonly DocsTableName[] = DocsTables.map(
  (table) => table.name
);

/**
 * @description Looks up a docs table definition by its table name.
 * @summary Linear search over {@link DocsTables} for the definition whose `name` matches; the
 * returned definition exposes the backing model constructor and codec for the table.
 * @param {DocsTableName} name - Table name to resolve (a key of {@link DocsSnapshotTables}).
 * @returns {DocsTableDefinition} The definition registered for that table name.
 * @throws {InternalError} When no table with the given name is registered.
 * @memberOf module:docaf
 */
export function docsTable(name: DocsTableName): DocsTableDefinition {
  const table = DocsTables.find((entry) => entry.name === name);
  if (!table) throw new InternalError(`Unknown docs table ${name}`);
  return table;
}
