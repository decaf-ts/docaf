import { prop } from "@decaf-ts/decoration";
import { Model, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import { uielement, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "../../models/naming";
import { DocsElements } from "../rendering/DocsSemanticTags";

/**
 * @description Header view model for a documentation page's content area.
 * @summary Binds to the "docs.symbol" element and renders the page title as a
 * level-1 heading plus optional kind, category, and summary text. Built by
 * DocsPageService from the page record and its root doclet.
 * @class DocsPageHeaderView
 * @category UI
 */
@uimodel(DocsElements.SYMBOL)
@model()
@stableName("DocsPageHeaderView")
export class DocsPageHeaderView extends Model {
  @uielement(DocsElements.HEADING, { level: 1 })
  @prop()
  @required()
  title!: string;

  @uielement(DocsElements.TEXT)
  @prop()
  kind?: string;

  @uielement(DocsElements.TEXT)
  @prop()
  category?: string;

  @uielement(DocsElements.TEXT)
  @prop()
  summary?: string;

  constructor(arg?: ModelArg<DocsPageHeaderView>) {
    super(arg);
  }
}
