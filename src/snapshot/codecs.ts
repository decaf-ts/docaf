import { ValidationError } from "@decaf-ts/db-decorators";
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
} from "../models";
import type { DocsModel } from "../models";
import type {
  DocComponentEventRecord,
  DocComponentPreviewRecord,
  DocComponentPropertyRecord,
  DocComponentRecord,
  DocExampleRecord,
  DocLayoutRecord,
  DocLinkRecord,
  DocLookupRecord,
  DocManifestRecord,
  DocNavigationItemRecord,
  DocPageRecord,
  DocParameterRecord,
  DocReferenceRecord,
  DocReturnRecord,
  DocRouteRecord,
  DocSearchEntryRecord,
  DocSectionRecord,
  DocSignatureRecord,
  DocSourceRecord,
  DocTagRecord,
  DocTutorialRecord,
  DocTypeRecord,
  DocletRecord,
  DocsRecordBase,
} from "./records";

/**
 * @description Pair of conversions between a Decaf docs model and its portable snapshot record.
 * @summary Encodes a model into the plain-JSON record shape persisted in a snapshot table, and
 * decodes a record back into a live model instance. Codecs are symmetric: `decode(encode(m))`
 * yields an equivalent model, and both directions enforce JSON-safety (no non-finite numbers,
 * non-plain objects, functions, or other unsupported values).
 * @template M - Concrete docs model type being converted.
 * @template D - Snapshot record type produced from (and accepted by) the codec.
 */
export interface DocsModelCodec<M extends DocsModel, D extends DocsRecordBase> {
  encode(model: M): D;
  decode(record: D): M;
}

function toJsonValue(value: unknown, path: string): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") {
    if (!Number.isFinite(value as number))
      throw new ValidationError(`Non-finite number at ${path}`);
    return value;
  }
  if (Array.isArray(value))
    return value.map((item, index) => toJsonValue(item, `${path}[${index}]`));
  if (type === "object") {
    const source = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null)
      throw new ValidationError(`Non-plain object at ${path}`);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      const item = source[key];
      if (item === undefined) continue;
      result[key] = toJsonValue(item, `${path}.${key}`);
    }
    return result;
  }
  throw new ValidationError(`Unsupported JSON value (${type}) at ${path}`);
}

/**
 * @description Builds a codec that converts a docs model to and from its snapshot record.
 * @summary The returned codec copies only the listed fields. `encode` skips `undefined` values
 * and recursively JSON-ifies each field, throwing a `ValidationError` on non-finite numbers or
 * non-plain objects. `decode` re-validates the whole record for JSON-safety and constructs a
 * model instance by passing the record to the model's constructor.
 * @template M - Concrete docs model type being converted.
 * @template D - Snapshot record type produced from the listed fields.
 * @param {Class.<M>} model - Model class whose constructor accepts the record shape.
 * @param {string[]} fields - Field names carried between model and record.
 * @returns {DocsModelCodec<M, D>} A codec encoding only the given fields and decoding into `M`.
 */
export function docsModelCodec<M extends DocsModel, D extends DocsRecordBase>(
  model: new (arg?: any) => M,
  fields: readonly (keyof D & string)[]
): DocsModelCodec<M, D> {
  return {
    encode(source: M): D {
      const target: Record<string, unknown> = {};
      for (const field of fields) {
        const value = (source as unknown as Record<string, unknown>)[field];
        if (value === undefined) continue;
        target[field] = toJsonValue(value, field);
      }
      return target as unknown as D;
    },
    decode(record: D): M {
      const value = toJsonValue(record, "record");
      return new model(value);
    },
  };
}

const DOCLET_FIELDS = [
  "uid",
  "name",
  "longname",
  "kind",
  "package",
  "memberof",
  "memberofUid",
  "scope",
  "description",
  "classdesc",
  "summary",
  "access",
  "readonly",
  "abstract",
  "async",
  "virtual",
  "deprecated",
  "since",
  "version",
  "type",
  "category",
  "subCategory",
  "anchor",
  "order",
  "componentId",
  "sourceId",
  "linkId",
  "signatureIds",
  "typeIds",
  "propertyIds",
  "exampleIds",
  "tagIds",
  "referenceIds",
  "tutorialIds",
  "augments",
  "implements",
  "mixes",
  "overrides",
  "inherits",
  "see",
  "requires",
  "fires",
  "listens",
  "metadata",
] as const satisfies readonly (keyof DocletRecord)[];

const TAG_FIELDS = [
  "uid",
  "ownerUid",
  "name",
  "value",
  "originalValue",
  "kind",
  "comment",
] as const satisfies readonly (keyof DocTagRecord)[];

const TYPE_FIELDS = [
  "uid",
  "ownerUid",
  "role",
  "index",
  "text",
  "normalized",
  "kind",
  "referenceLongname",
  "referenceUid",
  "arguments",
  "nullable",
  "optional",
  "readonly",
] as const satisfies readonly (keyof DocTypeRecord)[];

const PARAMETER_FIELDS = [
  "uid",
  "signatureUid",
  "name",
  "index",
  "typeText",
  "typeId",
  "optional",
  "rest",
  "defaultValue",
  "description",
] as const satisfies readonly (keyof DocParameterRecord)[];

const RETURN_FIELDS = [
  "uid",
  "signatureUid",
  "role",
  "typeText",
  "typeId",
  "description",
  "nullable",
  "elementTypeText",
] as const satisfies readonly (keyof DocReturnRecord)[];

const SIGNATURE_FIELDS = [
  "uid",
  "docletUid",
  "index",
  "kind",
  "name",
  "signatureText",
  "parametersText",
  "access",
  "description",
  "static",
  "async",
  "abstract",
  "virtual",
  "inheritedFrom",
  "parameterIds",
  "returnId",
  "yieldId",
  "typeIds",
  "referenceIds",
] as const satisfies readonly (keyof DocSignatureRecord)[];

const EXAMPLE_FIELDS = [
  "uid",
  "ownerUid",
  "index",
  "caption",
  "code",
  "language",
  "escaped",
] as const satisfies readonly (keyof DocExampleRecord)[];

const SOURCE_FIELDS = [
  "uid",
  "package",
  "fileName",
  "repository",
  "path",
  "line",
  "column",
  "url",
  "revision",
] as const satisfies readonly (keyof DocSourceRecord)[];

const REFERENCE_FIELDS = [
  "uid",
  "ownerUid",
  "index",
  "kind",
  "targetLongname",
  "targetUid",
  "anchor",
  "route",
] as const satisfies readonly (keyof DocReferenceRecord)[];

const COMPONENT_FIELDS = [
  "uid",
  "docletUid",
  "framework",
  "name",
  "exportName",
  "sourceFile",
  "selector",
  "standalone",
  "propertyUids",
  "eventUids",
  "previewUids",
] as const satisfies readonly (keyof DocComponentRecord)[];

const COMPONENT_PROPERTY_FIELDS = [
  "uid",
  "componentUid",
  "name",
  "kind",
  "alias",
  "typeText",
  "typeId",
  "optional",
  "required",
  "defaultValue",
  "description",
] as const satisfies readonly (keyof DocComponentPropertyRecord)[];

const COMPONENT_EVENT_FIELDS = [
  "uid",
  "componentUid",
  "name",
  "typeText",
  "payloadTypeText",
  "payloadTypeId",
  "description",
] as const satisfies readonly (keyof DocComponentEventRecord)[];

const COMPONENT_PREVIEW_FIELDS = [
  "uid",
  "componentUid",
  "name",
  "kind",
  "framework",
  "entry",
  "moduleId",
  "sourceFile",
  "controls",
  "inputDefaults",
] as const satisfies readonly (keyof DocComponentPreviewRecord)[];

const TUTORIAL_FIELDS = [
  "uid",
  "name",
  "title",
  "description",
  "content",
  "route",
  "sourceFile",
  "parentUid",
  "pageUid",
  "order",
  "childUids",
  "docletUids",
] as const satisfies readonly (keyof DocTutorialRecord)[];

const PAGE_FIELDS = [
  "uid",
  "title",
  "kind",
  "route",
  "layoutId",
  "routeId",
  "navigationUid",
  "parentUid",
  "order",
  "docletUids",
  "sectionUids",
  "tutorialUids",
] as const satisfies readonly (keyof DocPageRecord)[];

const SECTION_FIELDS = [
  "uid",
  "pageUid",
  "key",
  "kind",
  "title",
  "content",
  "order",
  "navigationUid",
  "docletUids",
] as const satisfies readonly (keyof DocSectionRecord)[];

const ROUTE_FIELDS = [
  "uid",
  "route",
  "pageUid",
  "kind",
  "name",
  "anchor",
  "legacyRoutes",
] as const satisfies readonly (keyof DocRouteRecord)[];

const LINK_FIELDS = [
  "uid",
  "sourceUid",
  "role",
  "targetLongname",
  "targetUid",
  "route",
  "anchor",
] as const satisfies readonly (keyof DocLinkRecord)[];

const NAVIGATION_FIELDS = [
  "uid",
  "navigationUid",
  "parentUid",
  "label",
  "kind",
  "route",
  "anchor",
  "docletUid",
  "pageUid",
  "order",
  "childUids",
] as const satisfies readonly (keyof DocNavigationItemRecord)[];

const SEARCH_FIELDS = [
  "uid",
  "docletUid",
  "name",
  "longname",
  "kind",
  "category",
  "subCategory",
  "summary",
  "route",
  "anchor",
  "rank",
  "tokens",
] as const satisfies readonly (keyof DocSearchEntryRecord)[];

const LOOKUP_FIELDS = [
  "uid",
  "lookupKind",
  "value",
  "docletUids",
  "pageUids",
  "order",
] as const satisfies readonly (keyof DocLookupRecord)[];

const LAYOUT_FIELDS = [
  "uid",
  "name",
  "tag",
  "title",
  "order",
  "slots",
  "children",
  "config",
] as const satisfies readonly (keyof DocLayoutRecord)[];

const MANIFEST_FIELDS = [
  "uid",
  "schemaVersion",
  "projectName",
  "projectVersion",
  "buildId",
  "sourceRevision",
  "generator",
  "tableNames",
  "counts",
] as const satisfies readonly (keyof DocManifestRecord)[];

/**
 * @description Registry mapping every docs snapshot table to its model codec.
 * @summary Exposes one {@link DocsModelCodec} entry per table name (doclets, tags, pages, ...),
 * keyed by the same names used in `DocsSnapshotV1.tables`. Snapshot export and hydration iterate
 * this registry to convert models to records and back.
 */
export interface DocsCodecRegistry {
  doclets: DocsModelCodec<DocletModel, DocletRecord>;
  tags: DocsModelCodec<DocTagModel, DocTagRecord>;
  types: DocsModelCodec<DocTypeModel, DocTypeRecord>;
  parameters: DocsModelCodec<DocParameterModel, DocParameterRecord>;
  returns: DocsModelCodec<DocReturnModel, DocReturnRecord>;
  signatures: DocsModelCodec<DocSignatureModel, DocSignatureRecord>;
  examples: DocsModelCodec<DocExampleModel, DocExampleRecord>;
  sources: DocsModelCodec<DocSourceModel, DocSourceRecord>;
  references: DocsModelCodec<DocReferenceModel, DocReferenceRecord>;
  components: DocsModelCodec<DocComponentModel, DocComponentRecord>;
  componentProperties: DocsModelCodec<
    DocComponentPropertyModel,
    DocComponentPropertyRecord
  >;
  componentEvents: DocsModelCodec<
    DocComponentEventModel,
    DocComponentEventRecord
  >;
  componentPreviews: DocsModelCodec<
    DocComponentPreviewModel,
    DocComponentPreviewRecord
  >;
  tutorials: DocsModelCodec<DocTutorialModel, DocTutorialRecord>;
  pages: DocsModelCodec<DocPageModel, DocPageRecord>;
  sections: DocsModelCodec<DocSectionModel, DocSectionRecord>;
  routes: DocsModelCodec<DocRouteModel, DocRouteRecord>;
  links: DocsModelCodec<DocLinkModel, DocLinkRecord>;
  navigation: DocsModelCodec<DocNavigationItemModel, DocNavigationItemRecord>;
  search: DocsModelCodec<DocSearchEntryModel, DocSearchEntryRecord>;
  lookups: DocsModelCodec<DocLookupModel, DocLookupRecord>;
  layouts: DocsModelCodec<DocLayoutModel, DocLayoutRecord>;
  manifests: DocsModelCodec<DocManifestModel, DocManifestRecord>;
}

/**
 * @description Default codec registry covering every docs table.
 * @summary Instantiates {@link docsModelCodec} for each docs model with its fixed field list,
 * producing the canonical model <-> record conversions used by snapshot export, hydration, and
 * the per-table entries in `DocsTables`. Keys mirror the snapshot table names.
 */
export const DocsCodecs: DocsCodecRegistry = {
  doclets: docsModelCodec(DocletModel, DOCLET_FIELDS),
  tags: docsModelCodec(DocTagModel, TAG_FIELDS),
  types: docsModelCodec(DocTypeModel, TYPE_FIELDS),
  parameters: docsModelCodec(DocParameterModel, PARAMETER_FIELDS),
  returns: docsModelCodec(DocReturnModel, RETURN_FIELDS),
  signatures: docsModelCodec(DocSignatureModel, SIGNATURE_FIELDS),
  examples: docsModelCodec(DocExampleModel, EXAMPLE_FIELDS),
  sources: docsModelCodec(DocSourceModel, SOURCE_FIELDS),
  references: docsModelCodec(DocReferenceModel, REFERENCE_FIELDS),
  components: docsModelCodec(DocComponentModel, COMPONENT_FIELDS),
  componentProperties: docsModelCodec(
    DocComponentPropertyModel,
    COMPONENT_PROPERTY_FIELDS
  ),
  componentEvents: docsModelCodec(
    DocComponentEventModel,
    COMPONENT_EVENT_FIELDS
  ),
  componentPreviews: docsModelCodec(
    DocComponentPreviewModel,
    COMPONENT_PREVIEW_FIELDS
  ),
  tutorials: docsModelCodec(DocTutorialModel, TUTORIAL_FIELDS),
  pages: docsModelCodec(DocPageModel, PAGE_FIELDS),
  sections: docsModelCodec(DocSectionModel, SECTION_FIELDS),
  routes: docsModelCodec(DocRouteModel, ROUTE_FIELDS),
  links: docsModelCodec(DocLinkModel, LINK_FIELDS),
  navigation: docsModelCodec(DocNavigationItemModel, NAVIGATION_FIELDS),
  search: docsModelCodec(DocSearchEntryModel, SEARCH_FIELDS),
  lookups: docsModelCodec(DocLookupModel, LOOKUP_FIELDS),
  layouts: docsModelCodec(DocLayoutModel, LAYOUT_FIELDS),
  manifests: docsModelCodec(DocManifestModel, MANIFEST_FIELDS),
};
