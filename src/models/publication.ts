import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, type ModelArg } from "@decaf-ts/decorator-validation";
import { DocsModel, docsModel } from "./base";

/**
 * @description Decaf model for a tutorial document in the published documentation site.
 * @summary Keeps the tutorial `name`, `title`, `description` and rendered `content`, its published
 * `route` and `sourceFile`, and its place in the tutorial hierarchy (`parentUid`, `pageUid`,
 * `order`, `childUids`). `docletUids` links the tutorial to the API symbols it documents.
 * Stored in the `docs_tutorials` table; serialized portably as {@link DocTutorialRecord}.
 * @class DocTutorialModel
 */
@table("docs_tutorials")
@docsModel("DocTutorialModel")
export class DocTutorialModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  title!: string;

  @column()
  @prop()
  description?: string;

  @column()
  @prop()
  content?: string;

  @column()
  @prop()
  route?: string;

  @column()
  @prop()
  sourceFile?: string;

  @column()
  @prop()
  parentUid?: string;

  @column()
  @prop()
  pageUid?: string;

  @column()
  @prop()
  order?: number;

  @column()
  @prop()
  @list(String)
  childUids: string[] = [];

  @column()
  @prop()
  @list(String)
  docletUids: string[] = [];

  constructor(arg?: ModelArg<DocTutorialModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a page of the published documentation site.
 * @summary A page is the routing/grouping unit of the publication: `title`, `kind` (e.g. api,
 * tutorial, guide), `route`, and references to the rendering pieces it depends on (`layoutId`,
 * `routeId`, `navigationUid`) plus hierarchy placement (`parentUid`, `order`). `docletUids`,
 * `sectionUids` and `tutorialUids` list the content shown on the page. Stored in the
 * `docs_pages` table; serialized portably as {@link DocPageRecord}.
 * @class DocPageModel
 */
@table("docs_pages")
@docsModel("DocPageModel")
export class DocPageModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  title!: string;

  @column()
  @prop()
  kind!: string;

  @column()
  @prop()
  route!: string;

  @column()
  @prop()
  layoutId!: string;

  @column()
  @prop()
  routeId?: string;

  @column()
  @prop()
  navigationUid!: string;

  @column()
  @prop()
  parentUid?: string;

  @column()
  @prop()
  order?: number;

  @column()
  @prop()
  @list(String)
  docletUids: string[] = [];

  @column()
  @prop()
  @list(String)
  sectionUids: string[] = [];

  @column()
  @prop()
  @list(String)
  tutorialUids: string[] = [];

  constructor(arg?: ModelArg<DocPageModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a content section inside a published page.
 * @summary Belongs to a {@link DocPageModel} via `pageUid` with a stable `key` within the page and
 * a `kind` describing the section type (text, code, table, ...). Carries the rendered `title`
 * and `content`, its `order`, an optional dedicated `navigationUid`, and the `docletUids`
 * rendered in the section. Stored in the `docs_sections` table; serialized portably as
 * {@link DocSectionRecord}.
 * @class DocSectionModel
 */
@table("docs_sections")
@docsModel("DocSectionModel")
export class DocSectionModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  pageUid!: string;

  @column()
  @prop()
  key!: string;

  @column()
  @prop()
  kind!: string;

  @column()
  @prop()
  title?: string;

  @column()
  @prop()
  content?: string;

  @column()
  @prop()
  order: number = 0;

  @column()
  @prop()
  navigationUid?: string;

  @column()
  @prop()
  @list(String)
  docletUids: string[] = [];

  constructor(arg?: ModelArg<DocSectionModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a public route of the published documentation site.
 * @summary Maps a `route` path to the {@link DocPageModel} serving it via `pageUid`, with optional
 * `kind`, display `name` and `anchor` for in-page targets. `legacyRoutes` keeps older path
 * aliases that should redirect to the current route. Stored in the `docs_routes` table;
 * serialized portably as {@link DocRouteRecord}.
 * @class DocRouteModel
 */
@table("docs_routes")
@docsModel("DocRouteModel")
export class DocRouteModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  route!: string;

  @column()
  @prop()
  pageUid!: string;

  @column()
  @prop()
  kind?: string;

  @column()
  @prop()
  name?: string;

  @column()
  @prop()
  anchor?: string;

  @column()
  @prop()
  @list(String)
  legacyRoutes: string[] = [];

  constructor(arg?: ModelArg<DocRouteModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a typed link between two documentation records in the publication.
 * @summary Owned by the source record via `sourceUid` and labeled by `role` (e.g. member-of,
 * implements, next/prev). Targets another symbol by `targetLongname` (optionally resolved to
 * `targetUid`) and carries the published `route`/`anchor` to follow. Stored in the
 * `docs_links` table; serialized portably as {@link DocLinkRecord}.
 * @class DocLinkModel
 */
@table("docs_links")
@docsModel("DocLinkModel")
export class DocLinkModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  sourceUid!: string;

  @column()
  @prop()
  role!: string;

  @column()
  @prop()
  targetLongname!: string;

  @column()
  @prop()
  targetUid?: string;

  @column()
  @prop()
  route?: string;

  @column()
  @prop()
  anchor?: string;

  constructor(arg?: ModelArg<DocLinkModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for an item in the published documentation navigation tree.
 * @summary Belongs to a navigation root via `navigationUid` (and an optional `parentUid` for
 * nesting), holding the display `label`, an optional `kind`, its target (`route`/`anchor`), the
 * resolved `docletUid` or `pageUid` it points at, its `order`, and `childUids` for nested
 * items. Stored in the `docs_navigation` table; serialized portably as
 * {@link DocNavigationItemRecord}.
 * @class DocNavigationItemModel
 */
@table("docs_navigation")
@docsModel("DocNavigationItemModel")
export class DocNavigationItemModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  navigationUid!: string;

  @column()
  @prop()
  parentUid?: string;

  @column()
  @prop()
  label!: string;

  @column()
  @prop()
  kind?: string;

  @column()
  @prop()
  route?: string;

  @column()
  @prop()
  anchor?: string;

  @column()
  @prop()
  docletUid?: string;

  @column()
  @prop()
  pageUid?: string;

  @column()
  @prop()
  order: number = 0;

  @column()
  @prop()
  @list(String)
  childUids: string[] = [];

  constructor(arg?: ModelArg<DocNavigationItemModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for one entry of the documentation site search index.
 * @summary Flattens a documented symbol into a searchable row: the referenced `docletUid`, display
 * `name`, fully qualified `longname`, `kind`, optional `category`/`subCategory`, `summary`, the
 * published target (`route`/`anchor`), a relevance `rank`, and the pre-tokenized `tokens` used
 * by client-side search. Stored in the `docs_search` table; serialized portably as
 * {@link DocSearchEntryRecord}.
 * @class DocSearchEntryModel
 */
@table("docs_search")
@docsModel("DocSearchEntryModel")
export class DocSearchEntryModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  docletUid?: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  longname!: string;

  @column()
  @prop()
  kind!: string;

  @column()
  @prop()
  category?: string;

  @column()
  @prop()
  subCategory?: string;

  @column()
  @prop()
  summary?: string;

  @column()
  @prop()
  route?: string;

  @column()
  @prop()
  anchor?: string;

  @column()
  @prop()
  rank: number = 0;

  @column()
  @prop()
  @list(String)
  tokens: string[] = [];

  constructor(arg?: ModelArg<DocSearchEntryModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a precomputed lookup/index entry of the publication.
 * @summary A key/value index row: `lookupKind` names the lookup facet (e.g. package, member,
 * category) and `value` the facet value; `docletUids` and `pageUids` list everything matching
 * that key, ordered by `order`. Used to resolve cross-references and build filters without
 * scanning all records. Stored in the `docs_lookups` table; serialized portably as
 * {@link DocLookupRecord}.
 * @class DocLookupModel
 */
@table("docs_lookups")
@docsModel("DocLookupModel")
export class DocLookupModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  lookupKind!: string;

  @column()
  @prop()
  value!: string;

  @column()
  @prop()
  @list(String)
  docletUids: string[] = [];

  @column()
  @prop()
  @list(String)
  pageUids: string[] = [];

  @column()
  @prop()
  order?: number;

  constructor(arg?: ModelArg<DocLookupModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model describing a named layout template of the published documentation site.
 * @summary Identifies the layout by `name` and its component `tag`, with optional display `title`
 * and `order`. `slots` names the available content slots and `children` the nested layout
 * pieces; `config` carries layout-specific rendering settings. Stored in the `docs_layouts`
 * table; serialized portably as {@link DocLayoutRecord}.
 * @class DocLayoutModel
 */
@table("docs_layouts")
@docsModel("DocLayoutModel")
export class DocLayoutModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  tag!: string;

  @column()
  @prop()
  title?: string;

  @column()
  @prop()
  order?: number;

  @column()
  @prop()
  @list(String)
  slots: string[] = [];

  @column()
  @prop()
  @list(String)
  children: string[] = [];

  @column()
  @prop()
  config?: Record<string, string | number | boolean>;

  constructor(arg?: ModelArg<DocLayoutModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a build manifest describing one publication of the documentation.
 * @summary One record per publication: the snapshot `schemaVersion`, the documented project
 * (`projectName`, `projectVersion`), the `buildId` and `sourceRevision` it was generated from,
 * the optional `generator` identifier, the list of `tableNames` included in the snapshot, and
 * per-table record `counts`. Stored in the `docs_manifests` table; serialized portably as
 * {@link DocManifestRecord}.
 * @class DocManifestModel
 */
@table("docs_manifests")
@docsModel("DocManifestModel")
export class DocManifestModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  schemaVersion: number = 1;

  @column()
  @prop()
  projectName!: string;

  @column()
  @prop()
  projectVersion!: string;

  @column()
  @prop()
  buildId!: string;

  @column()
  @prop()
  sourceRevision!: string;

  @column()
  @prop()
  generator?: string;

  @column()
  @prop()
  @list(String)
  tableNames: string[] = [];

  @column()
  @prop()
  counts?: Record<string, number>;

  constructor(arg?: ModelArg<DocManifestModel>) {
    super(arg);
  }
}
