import { prop } from "@decaf-ts/decoration";
import { Model, model, type ModelArg } from "@decaf-ts/decorator-validation";
import { uichild, uielement, uilayout, uimodel } from "@decaf-ts/ui-decorators";
import { stableName } from "../../models/naming";
import { DocsElements } from "../rendering/DocsSemanticTags";
import {
  DocsBreadcrumbsView,
  DocsPageSectionsView,
  DocsPreviewView,
  DocsRelatedSymbolsView,
  DocsSourceView,
  DocsTutorialView,
} from "../views/DocsViews";
import { DocsPageHeaderView } from "../views/DocsPageHeaderView";

/**
 * @description Base model for the content area of a documentation page.
 * @summary Declares only the page kind; the concrete subclass instance decides
 * which kind-specific composition is used, and the layout metadata of that
 * instance drives the renderer. DocsPageService picks a subclass per page kind.
 * @class DocsPageLayout
 * @category UI
 */
// Base page composition. The concrete instance decides the page kind; the
// layout metadata of that instance drives the renderer.
@model()
@uimodel()
@stableName("DocsPageLayout")
export class DocsPageLayout extends Model {
  @uielement("")
  @prop()
  kind?: string;

  constructor(arg?: ModelArg<DocsPageLayout>) {
    super(arg);
  }
}

/**
 * @description Layout for class-like pages (classes, interfaces, enums, typedefs, namespaces).
 * @summary Composes breadcrumbs, the page symbol header, the section list, and
 * related symbols into a 5-row, single-column grid tagged "docs.layout.class".
 * Built by DocsPageService for pages whose kind is in the class-kind set.
 * @class DocsClassLayout
 * @category UI
 */
@uilayout(DocsElements.CLASS_LAYOUT, 1, 5)
@model()
@uimodel()
@stableName("DocsClassLayout")
export class DocsClassLayout extends DocsPageLayout {
  @uichild("DocsBreadcrumbsView", DocsElements.BREADCRUMBS, {
    row: 1,
    col: 1,
  })
  breadcrumbs!: DocsBreadcrumbsView;

  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 2, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsPageSectionsView", DocsElements.SECTIONS, {
    row: 3,
    col: 1,
  })
  sections!: DocsPageSectionsView;

  @uichild("DocsRelatedSymbolsView", DocsElements.RELATED, {
    row: 4,
    col: 1,
  })
  related!: DocsRelatedSymbolsView;

  constructor(arg?: ModelArg<DocsClassLayout>) {
    super(arg);
  }
}

/**
 * @description Layout for component documentation pages.
 * @summary Composes breadcrumbs, the symbol header, a live component preview,
 * the section list, and related symbols into a 6-row, single-column grid tagged
 * "docs.layout.component". Built by DocsPageService for "component" pages.
 * @class DocsComponentLayout
 * @category UI
 */
@uilayout(DocsElements.COMPONENT_LAYOUT, 1, 6)
@model()
@uimodel()
@stableName("DocsComponentLayout")
export class DocsComponentLayout extends DocsPageLayout {
  @uichild("DocsBreadcrumbsView", DocsElements.BREADCRUMBS, {
    row: 1,
    col: 1,
  })
  breadcrumbs!: DocsBreadcrumbsView;

  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 2, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsPreviewView", DocsElements.PREVIEW, { row: 3, col: 1 })
  preview!: DocsPreviewView;

  @uichild("DocsPageSectionsView", DocsElements.SECTIONS, {
    row: 4,
    col: 1,
  })
  sections!: DocsPageSectionsView;

  @uichild("DocsRelatedSymbolsView", DocsElements.RELATED, {
    row: 5,
    col: 1,
  })
  related!: DocsRelatedSymbolsView;

  constructor(arg?: ModelArg<DocsComponentLayout>) {
    super(arg);
  }
}

/**
 * @description Layout for tutorial pages.
 * @summary Composes the page header and the tutorial content view (the joined
 * prose of the page's sections) into a 2-row, single-column grid tagged
 * "docs.layout.tutorial".
 * @class DocsTutorialLayout
 * @category UI
 */
@uilayout(DocsElements.TUTORIAL_LAYOUT, 1, 2)
@model()
@uimodel()
@stableName("DocsTutorialLayout")
export class DocsTutorialLayout extends DocsPageLayout {
  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 1, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsTutorialView", DocsElements.TUTORIAL, { row: 2, col: 1 })
  tutorial!: DocsTutorialView;

  constructor(arg?: ModelArg<DocsTutorialLayout>) {
    super(arg);
  }
}

/**
 * @description Layout for source listing pages.
 * @summary Composes the page header and the source location view into a 2-row,
 * single-column grid tagged "docs.layout.source".
 * @class DocsSourceLayout
 * @category UI
 */
@uilayout(DocsElements.SOURCE_LAYOUT, 1, 2)
@model()
@uimodel()
@stableName("DocsSourceLayout")
export class DocsSourceLayout extends DocsPageLayout {
  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 1, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsSourceView", DocsElements.SOURCE, { row: 2, col: 1 })
  source!: DocsSourceView;

  constructor(arg?: ModelArg<DocsSourceLayout>) {
    super(arg);
  }
}

/**
 * @description Layout for the documentation home page.
 * @summary Composes the page header and the auto-generated "explore" sections
 * (Components, Tutorials, API) into a 2-row grid tagged "docs.layout.home".
 * @class DocsHomeLayout
 * @category UI
 */
@uilayout(DocsElements.HOME_LAYOUT, 1, 2)
@model()
@uimodel()
@stableName("DocsHomeLayout")
export class DocsHomeLayout extends DocsPageLayout {
  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 1, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsPageSectionsView", DocsElements.SECTIONS, {
    row: 2,
    col: 1,
  })
  sections!: DocsPageSectionsView;

  constructor(arg?: ModelArg<DocsHomeLayout>) {
    super(arg);
  }
}

/**
 * @description Fallback layout for pages without a kind-specific composition.
 * @summary Composes the page header and the section list into a 2-row grid
 * tagged "docs.layout.page". Used by DocsPageService when the page kind does
 * not match any specialized layout.
 * @class DocsGenericPageLayout
 * @category UI
 */
@uilayout(DocsElements.PAGE_LAYOUT, 1, 2)
@model()
@uimodel()
@stableName("DocsGenericPageLayout")
export class DocsGenericPageLayout extends DocsPageLayout {
  @uichild("DocsPageHeaderView", DocsElements.SYMBOL, { row: 1, col: 1 })
  header!: DocsPageHeaderView;

  @uichild("DocsPageSectionsView", DocsElements.SECTIONS, {
    row: 2,
    col: 1,
  })
  sections!: DocsPageSectionsView;

  constructor(arg?: ModelArg<DocsGenericPageLayout>) {
    super(arg);
  }
}
