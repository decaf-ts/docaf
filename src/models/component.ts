import { column, pk, table } from "@decaf-ts/core";
import { prop } from "@decaf-ts/decoration";
import { list, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import { uielement, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "./naming";
import { DocsModel } from "./base";

/**
 * @description Decaf model describing a documented UI component extracted from source code.
 * @summary Links back to its {@link DocletModel} via `docletUid` and records the component
 * `framework` (e.g. Angular, React), display `name`, `exportName`, `sourceFile`, plus
 * framework-specific metadata such as `selector` and `standalone`. Holds the ids of its
 * dependent {@link DocComponentPropertyModel}, {@link DocComponentEventModel} and
 * {@link DocComponentPreviewModel} records. Stored in the `docs_components` table; serialized
 * portably as {@link DocComponentRecord}.
 * @class DocComponentModel
 * @category Models
 */
@table("docs_components")
@model()
@uimodel()
@stableName("DocComponentModel")
export class DocComponentModel extends DocsModel {
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
  @required()
  @prop()
  framework!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  exportName!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  sourceFile!: string;

  @column()
  @uielement("")
  @prop()
  selector?: string;

  @column()
  @uielement("")
  @prop()
  standalone?: boolean;

  @column()
  @uielement("")
  @prop()
  @list(String)
  propertyUids: string[] = [];

  @column()
  @uielement("")
  @prop()
  @list(String)
  eventUids: string[] = [];

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_component_properties")
@model()
@uimodel()
@stableName("DocComponentPropertyModel")
export class DocComponentPropertyModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  componentUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @prop()
  kind: string = "input";

  @column()
  @uielement("")
  @prop()
  alias?: string;

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
  optional?: boolean;

  @column()
  @uielement("")
  @prop()
  required?: boolean;

  @column()
  @uielement("")
  @prop()
  defaultValue?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_component_events")
@model()
@uimodel()
@stableName("DocComponentEventModel")
export class DocComponentEventModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  componentUid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  name!: string;

  @column()
  @uielement("")
  @prop()
  typeText?: string;

  @column()
  @uielement("")
  @prop()
  payloadTypeText?: string;

  @column()
  @uielement("")
  @prop()
  payloadTypeId?: string;

  @column()
  @uielement("")
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
 * @category Models
 */
@table("docs_component_previews")
@model()
@uimodel()
@stableName("DocComponentPreviewModel")
export class DocComponentPreviewModel extends DocsModel {
  @uielement("")
  @required()
  @pk({ type: String, generated: false })
  uid!: string;

  @column()
  @uielement("")
  @required()
  @prop()
  componentUid!: string;

  @column()
  @uielement("")
  @prop()
  name: string = "default";

  @column()
  @uielement("")
  @prop()
  kind: string = "native";

  @column()
  @uielement("")
  @prop()
  framework?: string;

  @column()
  @uielement("")
  @prop()
  entry?: string;

  @column()
  @uielement("")
  @prop()
  moduleId?: string;

  @column()
  @uielement("")
  @prop()
  sourceFile?: string;

  @column()
  @uielement("")
  @prop()
  @list(String)
  controls: string[] = [];

  @column()
  @uielement("")
  @prop()
  inputDefaults?: Record<string, string | number | boolean>;

  constructor(arg?: ModelArg<DocComponentPreviewModel>) {
    super(arg);
  }
}
