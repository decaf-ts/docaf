import { prop } from "@decaf-ts/decoration";
import { Model, type ModelArg } from "@decaf-ts/decorator-validation";
import { docsModel } from "../../models/base";
import { uichild, uilayout } from "@decaf-ts/ui-decorators";
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
 */
// Top-level documentation site layout: header, three-column body (sidebar,
// page content, table of contents), and footer.
@uilayout(DocsElements.BODY_LAYOUT, 3, 1, { gap: "small" })
@docsModel("DocsBodyLayout")
export class DocsBodyLayout extends Model {
  @uichild(DocsNavigationView.name, DocsElements.SIDEBAR, {
    row: 1,
    col: 1,
    cols: 1,
    rows: 3,
    gap: "small",
  })
  sidebar!: DocsNavigationView;

  @uichild(DocsPageLayout.name, DocsElements.PAGE_LAYOUT, {
    row: 1,
    col: 1,
    cols: 1,
    rows: 6,
  })
  content!: DocsPageLayout;

  @uichild(DocsTableOfContentsView.name, DocsElements.TOC, { row: 1, col: 1 })
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
 */
@uilayout(DocsElements.SITE_LAYOUT, 1, 3)
@docsModel("DocsSiteLayout")
export class DocsSiteLayout extends Model {
  @prop()
  route?: string;

  @prop()
  title?: string;

  @prop()
  pageUid?: string;

  @uichild(DocsHeaderView.name, DocsElements.HEADER, { row: 1, col: 1 })
  header!: DocsHeaderView;

  @uichild(DocsBodyLayout.name, DocsElements.BODY_LAYOUT, {
    row: 2,
    col: 1,
    cols: 3,
    rows: 1,
    gap: "small",
  })
  body!: DocsBodyLayout;

  @uichild(DocsFooterView.name, DocsElements.FOOTER, {
    row: 3,
    col: 1,
    className: "docs-footer",
  })
  footer!: DocsFooterView;

  constructor(arg?: ModelArg<DocsSiteLayout>) {
    super(arg);
  }
}
