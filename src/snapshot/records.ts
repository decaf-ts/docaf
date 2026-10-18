/**
 * @description Common shape of all portable snapshot records: a stable `uid`.
 * @summary Every record stored in a docs snapshot table extends this interface, so records can be
 * keyed, compared and cross-referenced by id alone. The ids are the same deterministic composite
 * ids used as model primary keys (see {@link DocsIds}).
 */
export interface DocsRecordBase {
  uid: string;
}

/**
 * @description Portable serialization of a {@link DocletModel}.
 * @summary Carries the doclet's identity (`name`, `longname`, `kind`, scoping/membership),
 * descriptive metadata, flags, and the ids of its dependent records (signatures, types,
 * examples, tags, references, tutorials) and inheritance relations. Unlike the model, collection
 * fields are optional so partial records remain valid during export/hydration.
 */
export interface DocletRecord extends DocsRecordBase {
  name?: string;
  longname?: string;
  kind?: string;
  package?: string;
  memberof?: string;
  memberofUid?: string;
  scope?: string;
  description?: string;
  classdesc?: string;
  summary?: string;
  access?: string;
  readonly?: boolean;
  abstract?: boolean;
  async?: boolean;
  virtual?: boolean;
  deprecated?: boolean;
  since?: string;
  version?: string;
  type?: string;
  category?: string;
  subCategory?: string;
  anchor?: string;
  order?: number;
  componentId?: string;
  sourceId?: string;
  linkId?: string;
  signatureIds?: string[];
  typeIds?: string[];
  propertyIds?: string[];
  exampleIds?: string[];
  tagIds?: string[];
  referenceIds?: string[];
  tutorialIds?: string[];
  augments?: string[];
  implements?: string[];
  mixes?: string[];
  overrides?: string[];
  inherits?: string[];
  see?: string[];
  requires?: string[];
  fires?: string[];
  listens?: string[];
  metadata?: Record<string, string>;
}

/**
 * @description Portable serialization of a {@link DocTagModel}.
 * @summary One JSDoc tag of an owning record (`ownerUid`): tag `name`, parsed `value`, raw
 * `originalValue`, optional `kind`, and the surrounding `comment`.
 */
export interface DocTagRecord extends DocsRecordBase {
  ownerUid: string;
  name: string;
  value?: string;
  originalValue?: string;
  kind?: string;
  comment?: string;
}

/**
 * @description Portable serialization of a {@link DocTypeModel}.
 * @summary One typed occurrence under an owning record (`ownerUid`) with its `role`, positional
 * `index`, raw `text`, `normalized` form, optional kind and reference resolution, and nested
 * `arguments` type-expression strings.
 */
export interface DocTypeRecord extends DocsRecordBase {
  ownerUid: string;
  role: string;
  index?: number;
  text: string;
  normalized?: string;
  kind?: string;
  referenceLongname?: string;
  referenceUid?: string;
  arguments?: string[];
  nullable?: boolean;
  optional?: boolean;
  readonly?: boolean;
}

/**
 * @description Portable serialization of a {@link DocParameterModel}.
 * @summary One parameter of a signature (`signatureUid`): `name`, positional `index`,
 * `typeText`/`typeId`, `optional`/`rest` flags, `defaultValue` and `description`.
 */
export interface DocParameterRecord extends DocsRecordBase {
  signatureUid: string;
  name: string;
  index?: number;
  typeText?: string;
  typeId?: string;
  optional?: boolean;
  rest?: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description Portable serialization of a {@link DocReturnModel}.
 * @summary The return/yield declaration of a signature (`signatureUid`), with `role` distinguishing
 * `@returns` from `@yields`, the declared `typeText`/`typeId`, optional `elementTypeText` for
 * collection element types, `nullable`, and the `description`.
 */
export interface DocReturnRecord extends DocsRecordBase {
  signatureUid: string;
  role?: "returns" | "yields";
  typeText?: string;
  typeId?: string;
  description?: string;
  nullable?: boolean;
  elementTypeText?: string;
}

/**
 * @description Portable serialization of a {@link DocSignatureModel}.
 * @summary One overload/signature of a callable doclet (`docletUid`): rendered signature and
 * parameters text, modifiers, and ids referencing its parameter, return and type records.
 */
export interface DocSignatureRecord extends DocsRecordBase {
  docletUid: string;
  index?: number;
  kind?: string;
  name?: string;
  signatureText?: string;
  parametersText?: string;
  access?: string;
  description?: string;
  static?: boolean;
  async?: boolean;
  abstract?: boolean;
  virtual?: boolean;
  inheritedFrom?: string;
  parameterIds?: string[];
  returnId?: string;
  yieldId?: string;
  typeIds?: string[];
  referenceIds?: string[];
}

/**
 * @description Portable serialization of a {@link DocExampleModel}.
 * @summary One code example owned by any record (`ownerUid`), with its `code`, optional
 * `caption`, highlighting `language`, whether it was `escaped`, and positional `index`.
 */
export interface DocExampleRecord extends DocsRecordBase {
  ownerUid: string;
  index?: number;
  caption?: string;
  code: string;
  language?: string;
  escaped?: boolean;
}

/**
 * @description Portable serialization of a {@link DocSourceModel}.
 * @summary Source provenance of a documented symbol: `package`, `fileName`, optional `path`,
 * `line`/`column`, repository link (`repository`, `url`, `revision`).
 */
export interface DocSourceRecord extends DocsRecordBase {
  package?: string;
  fileName: string;
  repository?: string;
  path?: string;
  line?: number;
  column?: number;
  url?: string;
  revision?: string;
}

/**
 * @description Portable serialization of a {@link DocReferenceModel}.
 * @summary One cross-reference owned by a record (`ownerUid`, ordered by `index`): a `kind` for
 * why the relation exists, the `targetLongname` (optionally resolved to `targetUid`), and the
 * published `anchor`/`route` to follow.
 */
export interface DocReferenceRecord extends DocsRecordBase {
  ownerUid: string;
  index?: number;
  kind: string;
  targetLongname: string;
  targetUid?: string;
  anchor?: string;
  route?: string;
}

/**
 * @description Portable serialization of a {@link DocComponentModel}.
 * @summary One documented UI component: its owning doclet (`docletUid`), the `framework`,
 * display `name`, `exportName`, `sourceFile`, framework metadata (`selector`, `standalone`),
 * and the ids of its property, event and preview records.
 */
export interface DocComponentRecord extends DocsRecordBase {
  docletUid: string;
  framework: string;
  name: string;
  exportName: string;
  sourceFile: string;
  selector?: string;
  standalone?: boolean;
  propertyUids?: string[];
  eventUids?: string[];
  previewUids?: string[];
}

/**
 * @description Portable serialization of a {@link DocComponentPropertyModel}.
 * @summary One input/property of a component (`componentUid`): `name`, optional `alias`, binding
 * `kind`, declared type (`typeText`/`typeId`), `optional`/`required` flags, `defaultValue` and
 * `description`.
 */
export interface DocComponentPropertyRecord extends DocsRecordBase {
  componentUid: string;
  name: string;
  kind?: string;
  alias?: string;
  typeText?: string;
  typeId?: string;
  optional?: boolean;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description Portable serialization of a {@link DocComponentEventModel}.
 * @summary One event emitted by a component (`componentUid`): the event `name`, its value type
 * (`typeText`/`typeId`), the payload type when applicable (`payloadTypeText`/`payloadTypeId`),
 * and a `description`.
 */
export interface DocComponentEventRecord extends DocsRecordBase {
  componentUid: string;
  name: string;
  typeText?: string;
  payloadTypeText?: string;
  payloadTypeId?: string;
  description?: string;
}

/**
 * @description Portable serialization of a {@link DocComponentPreviewModel}.
 * @summary One live preview entry of a component (`componentUid`): preview `name` and `kind`, the
 * implementation pointers (`framework`, `entry`, `moduleId`, `sourceFile`), interactive
 * `controls`, and default input values (`inputDefaults`).
 */
export interface DocComponentPreviewRecord extends DocsRecordBase {
  componentUid: string;
  name?: string;
  kind?: string;
  framework?: string;
  entry?: string;
  moduleId?: string;
  sourceFile?: string;
  controls?: string[];
  inputDefaults?: Record<string, string | number | boolean>;
}

/**
 * @description Portable serialization of a {@link DocTutorialModel}.
 * @summary One tutorial document: `name`, `title`, `description`, rendered `content`, published
 * `route` and `sourceFile`, hierarchy placement (`parentUid`, `pageUid`, `order`, `childUids`),
 * and the linked `docletUids`.
 */
export interface DocTutorialRecord extends DocsRecordBase {
  name: string;
  title: string;
  description?: string;
  content?: string;
  route?: string;
  sourceFile?: string;
  parentUid?: string;
  pageUid?: string;
  order?: number;
  childUids?: string[];
  docletUids?: string[];
}

/**
 * @description Portable serialization of a {@link DocPageModel}.
 * @summary One page of the published site: `title`, `kind`, `route`, and references to its layout,
 * route and navigation records plus hierarchy placement, and the ids of the doclets, sections
 * and tutorials it presents.
 */
export interface DocPageRecord extends DocsRecordBase {
  title: string;
  kind: string;
  route: string;
  layoutId: string;
  routeId?: string;
  navigationUid: string;
  parentUid?: string;
  order?: number;
  docletUids?: string[];
  sectionUids?: string[];
  tutorialUids?: string[];
}

/**
 * @description Portable serialization of a {@link DocSectionModel}.
 * @summary One content section of a page (`pageUid`): stable `key` within the page, section
 * `kind`, rendered `title`/`content`, `order`, optional dedicated `navigationUid`, and the
 * linked `docletUids`.
 */
export interface DocSectionRecord extends DocsRecordBase {
  pageUid: string;
  key: string;
  kind: string;
  title?: string;
  content?: string;
  order?: number;
  navigationUid?: string;
  docletUids?: string[];
}

/**
 * @description Portable serialization of a {@link DocRouteModel}.
 * @summary One published route: the `route` path, the serving page (`pageUid`), optional `kind`,
 * display `name` and `anchor`, and the `legacyRoutes` that redirect to it.
 */
export interface DocRouteRecord extends DocsRecordBase {
  route: string;
  pageUid: string;
  kind?: string;
  name?: string;
  anchor?: string;
  legacyRoutes?: string[];
}

/**
 * @description Portable serialization of a {@link DocLinkModel}.
 * @summary One typed link owned by a record (`sourceUid`, labeled by `role`): the
 * `targetLongname` (optionally resolved to `targetUid`) and the published `route`/`anchor`.
 */
export interface DocLinkRecord extends DocsRecordBase {
  sourceUid: string;
  role: string;
  targetLongname: string;
  targetUid?: string;
  route?: string;
  anchor?: string;
}

/**
 * @description Portable serialization of a {@link DocNavigationItemModel}.
 * @summary One item of a navigation tree (`navigationUid`, optional `parentUid`): display `label`,
 * optional `kind`, target (`route`/`anchor`), resolved `docletUid` or `pageUid`, `order`, and
 * nested `childUids`.
 */
export interface DocNavigationItemRecord extends DocsRecordBase {
  navigationUid: string;
  parentUid?: string;
  label: string;
  kind?: string;
  route?: string;
  anchor?: string;
  docletUid?: string;
  pageUid?: string;
  order?: number;
  childUids?: string[];
}

/**
 * @description Portable serialization of a {@link DocSearchEntryModel}.
 * @summary One row of the search index: referenced `docletUid`, display `name` and `longname`,
 * `kind`, optional `category`/`subCategory`, `summary`, published target (`route`/`anchor`),
 * relevance `rank`, and pre-tokenized `tokens`.
 */
export interface DocSearchEntryRecord extends DocsRecordBase {
  docletUid?: string;
  name: string;
  longname: string;
  kind: string;
  category?: string;
  subCategory?: string;
  summary?: string;
  route?: string;
  anchor?: string;
  rank?: number;
  tokens?: string[];
}

/**
 * @description Portable serialization of a {@link DocLookupModel}.
 * @summary One precomputed key/value index entry: `lookupKind` names the facet and `value` its
 * value; `docletUids` and `pageUids` list the matching records, ordered by `order`.
 */
export interface DocLookupRecord extends DocsRecordBase {
  lookupKind: string;
  value: string;
  docletUids?: string[];
  pageUids?: string[];
  order?: number;
}

/**
 * @description Portable serialization of a {@link DocLayoutModel}.
 * @summary One named layout template: `name` and component `tag`, optional `title` and `order`,
 * available `slots`, nested `children`, and layout-specific `config` settings.
 */
export interface DocLayoutRecord extends DocsRecordBase {
  name: string;
  tag: string;
  title?: string;
  order?: number;
  slots?: string[];
  children?: string[];
  config?: Record<string, string | number | boolean>;
}

/**
 * @description Portable serialization of a {@link DocManifestModel}.
 * @summary One build manifest describing a publication: `schemaVersion`, the documented project
 * (`projectName`, `projectVersion`), provenance (`buildId`, `sourceRevision`), optional
 * `generator`, the `tableNames` present in the snapshot, and per-table `counts`.
 */
export interface DocManifestRecord extends DocsRecordBase {
  schemaVersion?: number;
  projectName: string;
  projectVersion: string;
  buildId: string;
  sourceRevision: string;
  generator?: string;
  tableNames?: string[];
  counts?: Record<string, number>;
}

/**
 * @description The complete set of record collections held by a docs snapshot, one per docs table.
 * @summary Property names are the {@link DocsTableName} keys and each holds the serialized records
 * of the corresponding model (e.g. `doclets` holds {@link DocletRecord} entries for
 * {@link DocletModel}). Used as the payload of {@link DocsSnapshotV1}.
 */
export interface DocsSnapshotTables {
  doclets: DocletRecord[];
  tags: DocTagRecord[];
  types: DocTypeRecord[];
  parameters: DocParameterRecord[];
  returns: DocReturnRecord[];
  signatures: DocSignatureRecord[];
  examples: DocExampleRecord[];
  sources: DocSourceRecord[];
  references: DocReferenceRecord[];
  components: DocComponentRecord[];
  componentProperties: DocComponentPropertyRecord[];
  componentEvents: DocComponentEventRecord[];
  componentPreviews: DocComponentPreviewRecord[];
  tutorials: DocTutorialRecord[];
  pages: DocPageRecord[];
  sections: DocSectionRecord[];
  routes: DocRouteRecord[];
  links: DocLinkRecord[];
  navigation: DocNavigationItemRecord[];
  search: DocSearchEntryRecord[];
  lookups: DocLookupRecord[];
  layouts: DocLayoutRecord[];
  manifests: DocManifestRecord[];
}

/**
 * @description Name of one table inside a docs snapshot, i.e. a property key of
 * {@link DocsSnapshotTables}.
 * @summary One literal per table (e.g. `"doclets"`, `"componentProperties"`, `"manifests"`);
 * used to address tables when exporting, hydrating, or looking up definitions via
 * {@link docsTable}.
 */
export type DocsTableName = keyof DocsSnapshotTables;

/**
 * @description A versioned docs snapshot file: project and build identity plus all record tables.
 * @summary The on-disk/deliverable shape of an exported documentation snapshot: `schemaVersion` is
 * fixed to `1`, `project` names the documented project and version, `build` carries the build id
 * and source revision, and `tables` holds every record collection. The version literal allows
 * future formats to be introduced without breaking existing consumers.
 */
export interface DocsSnapshotV1 {
  schemaVersion: 1;
  project: {
    name: string;
    version: string;
  };
  build: {
    id: string;
    sourceRevision: string;
  };
  tables: DocsSnapshotTables;
}

/**
 * @description Alias for the current docs snapshot format ({@link DocsSnapshotV1}).
 * @summary Lets consumers refer to "the" snapshot type without hard-coding the version; when a new
 * schema version is added, this alias can be updated or turned into a union.
 */
export type DocsSnapshot = DocsSnapshotV1;
