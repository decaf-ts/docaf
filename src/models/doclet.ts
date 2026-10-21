import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import { uielement, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "./naming";
import { DocsModel } from "./base";

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
 * @category Models
 */
@table("docs_doclets")
@model()
@uimodel()
@stableName("DocletModel")
export class DocletModel extends DocsModel {
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
  longname!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  kind!: string;

  @column()
  @uielement("")
  @prop()
  package?: string;

  @column()
  @uielement("")
  @prop()
  memberof?: string;

  @column()
  @uielement("")
  @prop()
  memberofUid?: string;

  @column()
  @uielement("")
  @prop()
  scope?: string;

  @column()
  @uielement("")
  @prop()
  description?: string;

  @column()
  @uielement("")
  @prop()
  classdesc?: string;

  @column()
  @uielement("")
  @prop()
  summary?: string;

  @column()
  @uielement("")
  @prop()
  access?: string;

  @column()
  @uielement("")
  @prop()
  readonly?: boolean;

  @column()
  @uielement("")
  @prop()
  abstract?: boolean;

  @column()
  @uielement("")
  @prop()
  async?: boolean;

  @column()
  @uielement("")
  @prop()
  virtual?: boolean;

  @column()
  @uielement("")
  @prop()
  deprecated?: boolean;

  @column()
  @uielement("")
  @prop()
  since?: string;

  @column()
  @uielement("")
  @prop()
  version?: string;

  @column()
  @uielement("")
  @prop()
  type?: string;

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
  anchor?: string;

  @column()
  @uielement("")
  @prop()
  order?: number;

  @column()
  @uielement("")
  @prop()
  componentId?: string;

  @column()
  @uielement("")
  @prop()
  sourceId?: string;

  @column()
  @uielement("")
  @prop()
  linkId?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  signatureIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  typeIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  propertyIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  exampleIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  tagIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  referenceIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  tutorialIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  augments: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  implements: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  mixes: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  overrides: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  inherits: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  see: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  requires: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  fires: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  listens: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_tags")
@model()
@uimodel()
@stableName("DocTagModel")
export class DocTagModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  ownerUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @prop()
  value?: string;

  @column()
  @uielement("")
  @prop()
  originalValue?: string;

  @column()
  @uielement("")
  @prop()
  kind?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_types")
@model()
@uimodel()
@stableName("DocTypeModel")
export class DocTypeModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  ownerUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  role!: string;

  @column()
  @uielement("")
  @prop()
  index: number = 0;

  @column()
  @uielement("")
  @required()
  @prop()
  text!: string;

  @column()
  @uielement("")
  @prop()
  normalized?: string;

  @column()
  @uielement("")
  @prop()
  kind?: string;

  @column()
  @uielement("")
  @prop()
  referenceLongname?: string;

  @column()
  @uielement("")
  @prop()
  referenceUid?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  arguments: string[] = [];

  @column()
  @uielement("")
  @prop()
  nullable?: boolean;

  @column()
  @uielement("")
  @prop()
  optional?: boolean;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_parameters")
@model()
@uimodel()
@stableName("DocParameterModel")
export class DocParameterModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  signatureUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @prop()
  index: number = 0;

  @column()
  @uielement("")
  @prop()
  typeText?: string;

  @column()
  @uielement("")
  @prop()
  typeId?: string;

  @column()
  @uielement("")
  @prop()
  optional: boolean = false;

  @column()
  @uielement("")
  @prop()
  rest: boolean = false;

  @column()
  @uielement("")
  @prop()
  defaultValue?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_returns")
@model()
@uimodel()
@stableName("DocReturnModel")
export class DocReturnModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  signatureUid!: string;

  @column()
  @uielement("")
  @prop()
  role: "returns" | "yields" = "returns";

  @column()
  @uielement("")
  @prop()
  typeText?: string;

  @column()
  @uielement("")
  @prop()
  typeId?: string;

  @column()
  @uielement("")
  @prop()
  description?: string;

  @column()
  @uielement("")
  @prop()
  nullable?: boolean;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_signatures")
@model()
@uimodel()
@stableName("DocSignatureModel")
export class DocSignatureModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  docletUid!: string;

  @column()
  @uielement("")
  @prop()
  index: number = 0;

  @column()
  @uielement("")
  @prop()
  kind: string = "function";

  @column()
  @uielement("")
  @prop()
  name?: string;

  @column()
  @uielement("")
  @prop()
  signatureText?: string;

  @column()
  @uielement("")
  @prop()
  parametersText?: string;

  @column()
  @uielement("")
  @prop()
  access?: string;

  @column()
  @uielement("")
  @prop()
  description?: string;

  @column()
  @uielement("")
  @prop()
  static?: boolean;

  @column()
  @uielement("")
  @prop()
  async?: boolean;

  @column()
  @uielement("")
  @prop()
  abstract?: boolean;

  @column()
  @uielement("")
  @prop()
  virtual?: boolean;

  @column()
  @uielement("")
  @prop()
  inheritedFrom?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  parameterIds: string[] = [];

  @column()
  @uielement("")
  @prop()
  returnId?: string;

  @column()
  @uielement("")
  @prop()
  yieldId?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  typeIds: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_examples")
@model()
@uimodel()
@stableName("DocExampleModel")
export class DocExampleModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  ownerUid!: string;

  @column()
  @uielement("")
  @prop()
  index: number = 0;

  @column()
  @uielement("")
  @prop()
  caption?: string;

  @column()
  @uielement("")
  @required()
  @prop()
  code!: string;

  @column()
  @uielement("")
  @prop()
  language?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_sources")
@model()
@uimodel()
@stableName("DocSourceModel")
export class DocSourceModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @prop()
  package?: string;

  @column()
  @uielement("")
  @required()
  @prop()
  fileName!: string;

  @column()
  @uielement("")
  @prop()
  repository?: string;

  @column()
  @uielement("")
  @prop()
  path?: string;

  @column()
  @uielement("")
  @prop()
  line?: number;

  @column()
  @uielement("")
  @prop()
  column?: number;

  @column()
  @uielement("")
  @prop()
  url?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_references")
@model()
@uimodel()
@stableName("DocReferenceModel")
export class DocReferenceModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  ownerUid!: string;

  @column()
  @uielement("")
  @prop()
  index: number = 0;

  @column()
  @uielement("")
  @required()
  @prop()
  kind!: string;

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
  anchor?: string;

  @column()
  @uielement("")
  @prop()
  route?: string;

  constructor(arg?: ModelArg<DocReferenceModel>) {
    super(arg);
  }
}
