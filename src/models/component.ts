import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, type ModelArg } from "@decaf-ts/decorator-validation";
import { DocsModel, docsModel } from "./base";

/**
 * @description Decaf model describing a documented UI component extracted from source code.
 * @summary Links back to its {@link DocletModel} via `docletUid` and records the component
 * `framework` (e.g. Angular, React), display `name`, `exportName`, `sourceFile`, plus
 * framework-specific metadata such as `selector` and `standalone`. Holds the ids of its
 * dependent {@link DocComponentPropertyModel}, {@link DocComponentEventModel} and
 * {@link DocComponentPreviewModel} records. Stored in the `docs_components` table; serialized
 * portably as {@link DocComponentRecord}.
 * @class DocComponentModel
 */
@table("docs_components")
@docsModel("DocComponentModel")
export class DocComponentModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  docletUid!: string;

  @column()
  @prop()
  framework!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  exportName!: string;

  @column()
  @prop()
  sourceFile!: string;

  @column()
  @prop()
  selector?: string;

  @column()
  @prop()
  standalone?: boolean;

  @column()
  @prop()
  @list(String)
  propertyUids: string[] = [];

  @column()
  @prop()
  @list(String)
  eventUids: string[] = [];

  @column()
  @prop()
  @list(String)
  previewUids: string[] = [];

  constructor(arg?: ModelArg<DocComponentModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for an input/property of a documented component.
 * @summary Belongs to a {@link DocComponentModel} via `componentUid`; `kind` distinguishes
 * directional bindings (defaults to `"input"`). Keeps the property `name`, optional `alias`,
 * declared type (`typeText`/`typeId`), `optional`/`required` flags, `defaultValue` and
 * `description`. Stored in the `docs_component_properties` table; serialized portably as
 * {@link DocComponentPropertyRecord}.
 * @class DocComponentPropertyModel
 */
@table("docs_component_properties")
@docsModel("DocComponentPropertyModel")
export class DocComponentPropertyModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  componentUid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  kind: string = "input";

  @column()
  @prop()
  alias?: string;

  @column()
  @prop()
  typeText?: string;

  @column()
  @prop()
  typeId?: string;

  @column()
  @prop()
  optional?: boolean;

  @column()
  @prop()
  required?: boolean;

  @column()
  @prop()
  defaultValue?: string;

  @column()
  @prop()
  description?: string;

  constructor(arg?: ModelArg<DocComponentPropertyModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for an event emitted by a documented component.
 * @summary Belongs to a {@link DocComponentModel} via `componentUid` and keeps the event `name`,
 * the event value type (`typeText`/`typeId`), the payload type when the event emits a custom
 * object (`payloadTypeText`/`payloadTypeId`), and a `description`. Stored in the
 * `docs_component_events` table; serialized portably as {@link DocComponentEventRecord}.
 * @class DocComponentEventModel
 */
@table("docs_component_events")
@docsModel("DocComponentEventModel")
export class DocComponentEventModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  componentUid!: string;

  @column()
  @prop()
  name!: string;

  @column()
  @prop()
  typeText?: string;

  @column()
  @prop()
  payloadTypeText?: string;

  @column()
  @prop()
  payloadTypeId?: string;

  @column()
  @prop()
  description?: string;

  constructor(arg?: ModelArg<DocComponentEventModel>) {
    super(arg);
  }
}

/**
 * @description Decaf model for a live preview/playground entry of a documented component.
 * @summary Belongs to a {@link DocComponentModel} via `componentUid`; `name` selects among
 * multiple previews (default `"default"`) and `kind` flags the preview mechanism (`"native"` or
 * framework-rendered). Points at the preview implementation through `framework`, `entry`,
 * `moduleId` and `sourceFile`, lists interactive control names in `controls`, and stores default
 * values for the component's inputs in `inputDefaults`. Stored in the
 * `docs_component_previews` table; serialized portably as {@link DocComponentPreviewRecord}.
 * @class DocComponentPreviewModel
 */
@table("docs_component_previews")
@docsModel("DocComponentPreviewModel")
export class DocComponentPreviewModel extends DocsModel {
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @prop()
  componentUid!: string;

  @column()
  @prop()
  name: string = "default";

  @column()
  @prop()
  kind: string = "native";

  @column()
  @prop()
  framework?: string;

  @column()
  @prop()
  entry?: string;

  @column()
  @prop()
  moduleId?: string;

  @column()
  @prop()
  sourceFile?: string;

  @column()
  @prop()
  @list(String)
  controls: string[] = [];

  @column()
  @prop()
  inputDefaults?: Record<string, string | number | boolean>;

  constructor(arg?: ModelArg<DocComponentPreviewModel>) {
    super(arg);
  }
}
