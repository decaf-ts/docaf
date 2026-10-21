import { prop } from "@decaf-ts/decoration";
import { Model, model, type ModelArg } from "@decaf-ts/decorator-validation";
import { uichild, uielement, uilayout, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "../../models/naming";
import { DocsElements } from "../rendering/DocsSemanticTags";
import {
  DocsFooterView,
  DocsHeaderView,
  DocsNavigationView,
  DocsTableOfContentsView,
} from "../views/DocsViews";
import { DocsPageLayout } from "./DocsPageLayouts";

/**
 * @description Three-column body layout of the documentation site.
 * @summary Arranges the sidebar navigation, the page content layout, and the
 * table of contents in a 3-column, single-row grid tagged "docs.layout.body"
 * with a small gap.
 * @class DocsBodyLayout
 * @category UI
 */
// Top-level documentation site layout: header, three-column body (sidebar,
// page content, table of contents), and footer.
@uilayout(DocsElements.BODY_LAYOUT, 3, 1, { gap: "small" })
@model()
@uimodel()
@stableName("DocsBodyLayout")
export class DocsBodyLayout extends Model {
  @uichild("DocsNavigationView", DocsElements.SIDEBAR, {
    row: 1,
    col: 1,
    cols: 1,
    rows: 3,
    gap: "small",
  })
  sidebar!: DocsNavigationView;

  @uichild("DocsPageLayout", DocsElements.PAGE_LAYOUT, {
    row: 1,
    col: 1,
    cols: 1,
    rows: 6,
  })
  content!: DocsPageLayout;

  @uichild("DocsTableOfContentsView", DocsElements.TOC, { row: 1, col: 1 })
  toc!: DocsTableOfContentsView;

  constructor(arg?: ModelArg<DocsBodyLayout>) {
    super(arg);
  }
}

/**
 * @description Root layout model of a rendered documentation site page.
 * @summary Carries the resolved route, page title, and page UID together with
 * the header, three-column body, and footer children in a 3-row grid tagged
 * "docs.layout.site". Produced by DocsPageService.resolveLayout and handed to
 * the active renderer.
 * @class DocsSiteLayout
 * @category UI
 */
@uilayout(DocsElements.SITE_LAYOUT, 1, 3)
@model()
@uimodel()
@stableName("DocsSiteLayout")
export class DocsSiteLayout extends Model {
  @uielement("")
  @prop()
  route?: string;

  @uielement("")
  @prop()
  title?: string;

  @uielement("")
  @prop()
  pageUid?: string;

  @uichild("DocsHeaderView", DocsElements.HEADER, { row: 1, col: 1 })
  header!: DocsHeaderView;

  @uichild("DocsBodyLayout", DocsElements.BODY_LAYOUT, {
    row: 2,
    col: 1,
    cols: 3,
    rows: 1,
    gap: "small",
  })
  body!: DocsBodyLayout;

  @uichild("DocsFooterView", DocsElements.FOOTER, {
    row: 3,
    col: 1,
    className: "docs-footer",
  })
  footer!: DocsFooterView;

  constructor(arg?: ModelArg<DocsSiteLayout>) {
    super(arg);
  }
}
