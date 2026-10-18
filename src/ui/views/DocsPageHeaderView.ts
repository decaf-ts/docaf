import { prop } from "@decaf-ts/decoration";
import { Model, type ModelArg } from "@decaf-ts/decorator-validation";
import { docsModel } from "../../models/base";
import { uielement, uimodel } from "@decaf-ts/ui-decorators";
import { DocsElements } from "../rendering/DocsSemanticTags";

/**
 * @description Header view model for a documentation page's content area.
 * @summary Binds to the "docs.symbol" element and renders the page title as a
 * level-1 heading plus optional kind, category, and summary text. Built by
 * DocsPageService from the page record and its root doclet.
 * @class DocsPageHeaderView
 */
@uimodel(DocsElements.SYMBOL)
@docsModel("DocsPageHeaderView")
export class DocsPageHeaderView extends Model {
  @uielement(DocsElements.HEADING, { level: 1 })
  @prop()
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
