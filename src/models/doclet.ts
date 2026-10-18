import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, type ModelArg } from "@decaf-ts/decorator-validation";
import { DocsModel, docsModel } from "./base";

/**
 * @description Decaf model for a single JSDoc doclet (a documented symbol such as a class, method,
 * property or module).
 * @summary Mirrors the relevant subset of a JSDoc doclet: identity fields (`name`, `longname`,
 * `kind`, scoping and membership), descriptive fields (`description`, `classdesc`, `summary`,
 * flags like `deprecated`/`abstract`/`async`), and arrays of ids referencing its dependent records
 * (signatures, types, examples, tags, references, tutorials) plus inheritance relations
 * (`augments`, `implements`, `mixes`, ...). Stored in the `docs_doclets` table; serialized
 * portably as {@link DocletRecord}.
 * @class DocletModel
 */
@table("docs_doclets")
@docsModel("DocletModel")
export class DocletModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

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
  package?: string;

  @column()
  @prop()
  memberof?: string;

  @column()
  @prop()
  memberofUid?: string;

  @column()
  @prop()
  scope?: string;

  @column()
  @prop()
  description?: string;

  @column()
  @prop()
  classdesc?: string;

  @column()
  @prop()
  summary?: string;

  @column()
  @prop()
  access?: string;

  @column()
  @prop()
  readonly?: boolean;

  @column()
  @prop()
  abstract?: boolean;

  @column()
  @prop()
  async?: boolean;

  @column()
  @prop()
  virtual?: boolean;

  @column()
  @prop()
  deprecated?: boolean;

  @column()
  @prop()
  since?: string;

  @column()
  @prop()
  version?: string;

  @column()
  @prop()
  type?: string;

  @column()
  @prop()
  category?: string;

  @column()
  @prop()
  subCategory?: string;

  @column()
  @prop()
  anchor?: string;

  @column()
  @prop()
  order?: number;

  @column()
  @prop()
  componentId?: string;

  @column()
  @prop()
  sourceId?: string;

  @column()
  @prop()
  linkId?: string;

  @column()
  @prop()
  @list(String)
  signatureIds: string[] = [];

  @column()
  @prop()
  @list(String)
  typeIds: string[] = [];

  @column()
  @prop()
  @list(String)
  propertyIds: string[] = [];

  @column()
  @prop()
  @list(String)
  exampleIds: string[] = [];

  @column()
  @prop()
  @list(String)
  tagIds: string[] = [];

  @column()
  @prop()
  @list(String)
  referenceIds: string[] = [];

  @column()
  @prop()
  @list(String)
  tutorialIds: string[] = [];

  @column()
  @prop()
  @list(String)
  augments: string[] = [];

  @column()
  @prop()
  @list(String)
  implements: string[] = [];

  @column()
  @prop()
  @list(String)
  mixes: string[] = [];

  @column()
  @prop()
  @list(String)
  overrides: string[] = [];

  @column()
  @prop()
  @list(String)
  inherits: string[] = [];

  @column()
  @prop()
  @list(String)
  see: string[] = [];

  @column()
  @prop()
  @list(String)
  requires: string[] = [];

  @column()
  @prop()
  @list(String)
  fires: string[] = [];

  @column()
  @prop()
  @list(String)
  listens: string[] = [];

  @column()
  @prop()
  metadata?: Record<string, string>;

  constructor(arg?: ModelArg<DocletModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a JSDoc tag attached to a doclet (e.g. `@param`, `@throws`, `@see`).
 * @summary Stores the tag `name`, its parsed `value`, the raw `originalValue` and the surrounding
 * `comment`, linked back to its owning record through `ownerUid`. Stored in the `docs_tags`
 * table; serialized portably as {@link DocTagRecord}.
 * @class DocTagModel
 */
@table("docs_tags")
@docsModel("DocTagModel")
export class DocTagModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  ownerUid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  value?: string;

  @column()
  @prop()
  originalValue?: string;

  @column()
  @prop()
  kind?: string;

  @column()
  @prop()
  comment?: string;

  constructor(arg?: ModelArg<DocTagModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for one type expression appearing in a doclet or signature, split by role.
 * @summary Each occurrence of a type text (e.g. in a `@param` type, a return type, or a type
 * reference) becomes its own record with a `role` (why it occurs) and positional `index` under its
 * `ownerUid`. Keeps the raw `text`, a `normalized` form, optional kind/reference resolution, and
 * nested type expression strings under `arguments`. Stored in the `docs_types` table; serialized
 * portably as {@link DocTypeRecord}.
 * @class DocTypeModel
 */
@table("docs_types")
@docsModel("DocTypeModel")
export class DocTypeModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  ownerUid!: string;

  @column()
  @prop()
  role!: string;

  @column()
  @prop()
  index: number = 0;

  @column()
  @prop()
  text!: string;

  @column()
  @prop()
  normalized?: string;

  @column()
  @prop()
  kind?: string;

  @column()
  @prop()
  referenceLongname?: string;

  @column()
  @prop()
  referenceUid?: string;

  @column()
  @prop()
  @list(String)
  arguments: string[] = [];

  @column()
  @prop()
  nullable?: boolean;

  @column()
  @prop()
  optional?: boolean;

  @column()
  @prop()
  readonly?: boolean;

  constructor(arg?: ModelArg<DocTypeModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a single function/method parameter of a signature.
 * @summary Belongs to a {@link DocSignatureModel} via `signatureUid` and keeps the parameter `name`,
 * positional `index`, textual and resolved type (`typeText`/`typeId`), and flags such as
 * `optional`, `rest` plus the `defaultValue` and `description`. Stored in the `docs_parameters`
 * table; serialized portably as {@link DocParameterRecord}.
 * @class DocParameterModel
 */
@table("docs_parameters")
@docsModel("DocParameterModel")
export class DocParameterModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  signatureUid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  index: number = 0;

  @column()
  @prop()
  typeText?: string;

  @column()
  @prop()
  typeId?: string;

  @column()
  @prop()
  optional: boolean = false;

  @column()
  @prop()
  rest: boolean = false;

  @column()
  @prop()
  defaultValue?: string;

  @column()
  @prop()
  description?: string;

  constructor(arg?: ModelArg<DocParameterModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for the return/yield declaration of a signature.
 * @summary Belongs to a {@link DocSignatureModel} via `signatureUid` with `role` distinguishing
 * `@returns` from `@yields`. Keeps the declared `typeText`/`typeId`, an optional
 * `elementTypeText` for array/collection element types, `nullable`, and the `description`.
 * Stored in the `docs_returns` table; serialized portably as {@link DocReturnRecord}.
 * @class DocReturnModel
 */
@table("docs_returns")
@docsModel("DocReturnModel")
export class DocReturnModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  signatureUid!: string;

  @column()
  @prop()
  role: "returns" | "yields" = "returns";

  @column()
  @prop()
  typeText?: string;

  @column()
  @prop()
  typeId?: string;

  @column()
  @prop()
  description?: string;

  @column()
  @prop()
  nullable?: boolean;

  @column()
  @prop()
  elementTypeText?: string;

  constructor(arg?: ModelArg<DocReturnModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for one overload/signature of a callable doclet.
 * @summary Represents one way a function, method, constructor or event callback can be invoked:
 * its `signatureText`, rendered `parametersText`, modifiers (`static`, `async`, `abstract`,
 * `virtual`, `inheritedFrom`) and ids referencing its {@link DocParameterModel},
 * {@link DocReturnModel} and {@link DocTypeModel} records. A doclet can own several signatures,
 * disambiguated by `index`. Stored in the `docs_signatures` table; serialized portably as
 * {@link DocSignatureRecord}.
 * @class DocSignatureModel
 */
@table("docs_signatures")
@docsModel("DocSignatureModel")
export class DocSignatureModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  docletUid!: string;

  @column()
  @prop()
  index: number = 0;

  @column()
  @prop()
  kind: string = "function";

  @column()
  @prop()
  name?: string;

  @column()
  @prop()
  signatureText?: string;

  @column()
  @prop()
  parametersText?: string;

  @column()
  @prop()
  access?: string;

  @column()
  @prop()
  description?: string;

  @column()
  @prop()
  static?: boolean;

  @column()
  @prop()
  async?: boolean;

  @column()
  @prop()
  abstract?: boolean;

  @column()
  @prop()
  virtual?: boolean;

  @column()
  @prop()
  inheritedFrom?: string;

  @column()
  @prop()
  @list(String)
  parameterIds: string[] = [];

  @column()
  @prop()
  returnId?: string;

  @column()
  @prop()
  yieldId?: string;

  @column()
  @prop()
  @list(String)
  typeIds: string[] = [];

  @column()
  @prop()
  @list(String)
  referenceIds: string[] = [];

  constructor(arg?: ModelArg<DocSignatureModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a code example attached to a documented symbol.
 * @summary Keeps the example's `code`, optional `caption`, highlighting `language`, and whether the
 * code block was `escaped` in the source comment. Owned by any record via `ownerUid` and
 * ordered by `index`. Stored in the `docs_examples` table; serialized portably as
 * {@link DocExampleRecord}.
 * @class DocExampleModel
 */
@table("docs_examples")
@docsModel("DocExampleModel")
export class DocExampleModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  ownerUid!: string;

  @column()
  @prop()
  index: number = 0;

  @column()
  @prop()
  caption?: string;

  @column()
  @prop()
  code!: string;

  @column()
  @prop()
  language?: string;

  @column()
  @prop()
  escaped?: boolean;

  constructor(arg?: ModelArg<DocExampleModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model describing where a documented symbol lives in the source code.
 * @summary Records the originating `package`, `fileName`, optional `path`, `line`/`column`,
 * repository link (`repository`, `url`, `revision`). Used to render "view source" links and
 * provenance in generated documentation. Stored in the `docs_sources` table; serialized
 * portably as {@link DocSourceRecord}.
 * @class DocSourceModel
 */
@table("docs_sources")
@docsModel("DocSourceModel")
export class DocSourceModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  package?: string;

  @column()
  @prop()
  fileName!: string;

  @column()
  @prop()
  repository?: string;

  @column()
  @prop()
  path?: string;

  @column()
  @prop()
  line?: number;

  @column()
  @prop()
  column?: number;

  @column()
  @prop()
  url?: string;

  @column()
  @prop()
  revision?: string;

  constructor(arg?: ModelArg<DocSourceModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a cross-reference from a documentation record to another symbol.
 * @summary Each `@link`-like relation becomes a record owned by `ownerUid` (ordered by `index`)
 * with a `kind` (e.g. link, augment, override, fires) and a `targetLongname` optionally resolved
 * to a `targetUid`; `anchor`/`route` point into the published output. Stored in the
 * `docs_references` table; serialized portably as {@link DocReferenceRecord}.
 * @class DocReferenceModel
 */
@table("docs_references")
@docsModel("DocReferenceModel")
export class DocReferenceModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  ownerUid!: string;

  @column()
  @prop()
  index: number = 0;

  @column()
  @prop()
  kind!: string;

  @column()
  @prop()
  targetLongname!: string;

  @column()
  @prop()
  targetUid?: string;

  @column()
  @prop()
  anchor?: string;

  @column()
  @prop()
  route?: string;

  constructor(arg?: ModelArg<DocReferenceModel>) {
    super(arg);
  }
}
