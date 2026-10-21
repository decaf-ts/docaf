import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import { uielement, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "./naming";
import { DocsModel } from "./base";

/**
 * @description Decaf model for a tutorial document in the published documentation site.
 * @summary Keeps the tutorial `name`, `title`, `description` and rendered `content`, its published
 * `route` and `sourceFile`, and its place in the tutorial hierarchy (`parentUid`, `pageUid`,
 * `order`, `childUids`). `docletUids` links the tutorial to the API symbols it documents.
 * Stored in the `docs_tutorials` table; serialized portably as {@link DocTutorialRecord}.
 * @class DocTutorialModel
 * @category Models
 */
@table("docs_tutorials")
@model()
@uimodel()
@stableName("DocTutorialModel")
export class DocTutorialModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  title!: string;

  @column()
  @uielement("")
  @prop()
  description?: string;

  @column()
  @uielement("")
  @prop()
  content?: string;

  @column()
  @uielement("")
  @prop()
  route?: string;

  @column()
  @uielement("")
  @prop()
  sourceFile?: string;

  @column()
  @uielement("")
  @prop()
  parentUid?: string;

  @column()
  @uielement("")
  @prop()
  pageUid?: string;

  @column()
  @uielement("")
  @prop()
  order?: number;

  @column()
  @uielement("")
  @prop()
  @list(String)
  childUids: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_pages")
@model()
@uimodel()
@stableName("DocPageModel")
export class DocPageModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  title!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  kind!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  route!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  layoutId!: string;

  @column()
  @uielement("")
  @prop()
  routeId?: string;

  @column()
  @uielement("")
  @required()
  @prop()
  navigationUid!: string;

  @column()
  @uielement("")
  @prop()
  parentUid?: string;

  @column()
  @uielement("")
  @prop()
  order?: number;

  @column()
  @uielement("")
  @prop()
  @list(String)
  docletUids: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  sectionUids: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_sections")
@model()
@uimodel()
@stableName("DocSectionModel")
export class DocSectionModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  pageUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  key!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  kind!: string;

  @column()
  @uielement("")
  @prop()
  title?: string;

  @column()
  @uielement("")
  @prop()
  content?: string;

  @column()
  @uielement("")
  @prop()
  order: number = 0;

  @column()
  @uielement("")
  @prop()
  navigationUid?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_routes")
@model()
@uimodel()
@stableName("DocRouteModel")
export class DocRouteModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  route!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  pageUid!: string;

  @column()
  @uielement("")
  @prop()
  kind?: string;

  @column()
  @uielement("")
  @prop()
  name?: string;

  @column()
  @uielement("")
  @prop()
  anchor?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_links")
@model()
@uimodel()
@stableName("DocLinkModel")
export class DocLinkModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  sourceUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  role!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  targetLongname!: string;

  @column()
  @uielement("")
  @prop()
  targetUid?: string;

  @column()
  @uielement("")
  @prop()
  route?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_navigation")
@model()
@uimodel()
@stableName("DocNavigationItemModel")
export class DocNavigationItemModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  navigationUid!: string;

  @column()
  @uielement("")
  @prop()
  parentUid?: string;

  @column()
  @uielement("")
  @required()
  @prop()
  label!: string;

  @column()
  @uielement("")
  @prop()
  kind?: string;

  @column()
  @uielement("")
  @prop()
  route?: string;

  @column()
  @uielement("")
  @prop()
  anchor?: string;

  @column()
  @uielement("")
  @prop()
  docletUid?: string;

  @column()
  @uielement("")
  @prop()
  pageUid?: string;

  @column()
  @uielement("")
  @prop()
  order: number = 0;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_search")
@model()
@uimodel()
@stableName("DocSearchEntryModel")
export class DocSearchEntryModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @prop()
  docletUid?: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  longname!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  kind!: string;

  @column()
  @uielement("")
  @prop()
  category?: string;

  @column()
  @uielement("")
  @prop()
  subCategory?: string;

  @column()
  @uielement("")
  @prop()
  summary?: string;

  @column()
  @uielement("")
  @prop()
  route?: string;

  @column()
  @uielement("")
  @prop()
  anchor?: string;

  @column()
  @uielement("")
  @prop()
  rank: number = 0;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_lookups")
@model()
@uimodel()
@stableName("DocLookupModel")
export class DocLookupModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  lookupKind!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  value!: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  docletUids: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  pageUids: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_layouts")
@model()
@uimodel()
@stableName("DocLayoutModel")
export class DocLayoutModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  tag!: string;

  @column()
  @uielement("")
  @prop()
  title?: string;

  @column()
  @uielement("")
  @prop()
  order?: number;

  @column()
  @uielement("")
  @prop()
  @list(String)
  slots: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  children: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_manifests")
@model()
@uimodel()
@stableName("DocManifestModel")
export class DocManifestModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @prop()
  schemaVersion: number = 1;

  @column()
  @uielement("")
  @required()
  @prop()
  projectName!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  projectVersion!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  buildId!: string;

  @column()
  @uielement("")
  @prop()
  sourceRevision!: string;

  @column()
  @uielement("")
  @prop()
  generator?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  tableNames: string[] = [];

  @column()
  @uielement("")
  @prop()
  counts?: Record<string, number>;

  constructor(arg?: ModelArg<DocManifestModel>) {
    super(arg);
  }
}
