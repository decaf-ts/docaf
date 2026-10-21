import { prop } from "@decaf-ts/decoration";
import { Model, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import {
  uichild,
  uielement,
  uilayout,
  uimodel,
} from "@decaf-ts/ui-decorators";
import { stableName } from "../../models/naming";
import { DocsElements } from "../rendering/DocsSemanticTags";

/**
 * @description One sidebar navigation item, optionally nested under a parent.
 * @summary Carries a navigation record's identity, label, and optional
 * route/anchor/kind plus nested children. Produced by DocsPageService when it
 * flattens a navigation model and consumed by DocsNavigationView.
 * @interface DocsNavigationEntry
 * @category UI
 * @memberOf module:docaf
 */
// Data records carried by view models. They are plain, serializable values so
// the same model can be produced by any renderer from the same snapshot.
export interface DocsNavigationEntry {
  uid: string;
  label: string;
  route?: string;
  anchor?: string;
  kind?: string;
  children?: DocsNavigationEntry[];
}

/**
 * @description One crumb in a breadcrumb trail.
 * @summary Holds a label with an optional route or anchor; a crumb without a
 * route (such as the page kind) renders as plain text.
 * @interface DocsBreadcrumbEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsBreadcrumbEntry {
  label: string;
  route?: string;
  anchor?: string;
}

/**
 * @description One entry of a page's "on this page" table of contents.
 * @summary Holds the heading label, the anchor to jump to, and the heading
 * level. Built by DocsPageService from the page's titled sections.
 * @interface DocsTocEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsTocEntry {
  label: string;
  anchor?: string;
  level?: number;
}

/**
 * @description One API member row (method, property, event, or related symbol link).
 * @summary Carries a member's identity, kind, optional signature text and
 * description, plus navigation (route/anchor) and visibility metadata. Used by
 * member sections, component property/event tables, and home explore lists.
 * @interface DocsMemberEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsMemberEntry {
  uid: string;
  name: string;
  kind: string;
  signature?: string;
  description?: string;
  route?: string;
  anchor?: string;
  access?: string;
  static?: boolean;
}

/**
 * @description One code example attached to a documented symbol.
 * @summary Holds the example's optional caption, its code, and the language
 * hint the renderer uses for highlighting.
 * @interface DocsExampleEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsExampleEntry {
  uid: string;
  caption?: string;
  code: string;
  language?: string;
}

/**
 * @description One parameter declared by a documented signature.
 * @summary Holds the parameter name, declared type text, optional/rest flags,
 * default value, and description. Built by DocsPageService from the signature's
 * parameter records so renderers can present a parameter table.
 * @interface DocsParameterEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsParameterEntry {
  uid: string;
  name: string;
  typeText?: string;
  optional?: boolean;
  rest?: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description One return or yield declaration of a documented signature.
 * @summary Holds the role ("returns" or "yields"), declared type text, optional
 * element type, nullability, and description. Built by DocsPageService from the
 * signature's return records.
 * @interface DocsReturnEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsReturnEntry {
  uid: string;
  role: "returns" | "yields";
  typeText?: string;
  description?: string;
  nullable?: boolean;
  elementTypeText?: string;
}

/**
 * @description One content section of a documentation page.
 * @summary Identified by key and kind, a section carries prose content or,
 * depending on kind, member/example rows or a source file reference; source
 * sections also carry the full source entry for the docs-source renderer, with
 * the fallback file name kept in code. Built by DocsPageService from the
 * page's section records and rendered by DocsPageSectionsView.
 * @interface DocsSectionEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsSectionEntry {
  uid: string;
  key: string;
  kind: string;
  title?: string;
  content?: string;
  members?: DocsMemberEntry[];
  examples?: DocsExampleEntry[];
  parameters?: DocsParameterEntry[];
  returns?: DocsReturnEntry[];
  code?: string;
  source?: DocsSourceViewEntry;
}

/**
 * @description One input property of a documented component.
 * @summary Holds the property name, optional alias, type text, required/optional
 * flags, default value, and description; also serves as the base record for
 * live preview controls.
 * @interface DocsComponentPropertyEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsComponentPropertyEntry {
  name: string;
  alias?: string;
  kind: "input";
  typeText?: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * @description One output event of a documented component.
 * @summary Holds the event name, its payload type text, and a description.
 * @interface DocsComponentEventEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsComponentEventEntry {
  name: string;
  payloadTypeText?: string;
  description?: string;
}

/**
 * @description A component input property bound to a live preview control.
 * @summary Extends DocsComponentPropertyEntry with the resolved runtime value
 * for the control, taken from the preview's input defaults or parsed from the
 * property's declared default value.
 * @interface DocsPreviewControlEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsPreviewControlEntry extends DocsComponentPropertyEntry {
  value?: unknown;
}

/**
 * @description Complete payload driving a component's live preview.
 * @summary Identifies the preview (uid, title, framework, entry, kind) and
 * provides the initial prop values, the per-input controls, and the list of
 * event names the rendered component emits. Produced by DocsPageService.
 * @interface DocsPreviewEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsPreviewEntry {
  uid: string;
  title: string;
  framework: string;
  entry: string;
  kind: string;
  initialProps: Record<string, unknown>;
  controls: DocsPreviewControlEntry[];
  events: string[];
}

/**
 * @description Renderer-independent record describing a documented component.
 * @summary Carries the component's uid, name, optional selector and framework,
 * plus its input property and output event rows. Built by componentView and
 * rendered through DocsComponentView.
 * @interface DocsComponentViewEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsComponentViewEntry {
  uid: string;
  name: string;
  selector?: string;
  framework: string;
  properties: DocsComponentPropertyEntry[];
  events: DocsComponentEventEntry[];
}

/**
 * @description Source location information for a documented symbol.
 * @summary Names the defining file with optional line/column, repository URL,
 * and source code. Falls back to the "unknown" file name when a symbol has no
 * source record.
 * @interface DocsSourceViewEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsSourceViewEntry {
  fileName: string;
  line?: number;
  column?: number;
  repository?: string;
  code?: string;
}

/**
 * @description One entry of the documentation search index.
 * @summary Holds a record's identity, display name, fully qualified longname,
 * kind, optional summary, navigation target, and rank. Used by both the sidebar
 * search view and the DocsPageService.search query results.
 * @interface DocsSearchEntry
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsSearchEntry {
  uid: string;
  name: string;
  longname: string;
  kind: string;
  summary?: string;
  route?: string;
  anchor?: string;
  rank?: number;
}

/**
 * @description Site-wide header view model.
 * @summary Binds to the "docs.header" element and renders the brand as a link
 * to "/" plus the optional project version. Built by DocsPageService from the
 * docs manifest.
 * @class DocsHeaderView
 * @category UI
 */
@uimodel(DocsElements.HEADER)
@model()
@stableName("DocsHeaderView")
export class DocsHeaderView extends Model {
  @uielement(DocsElements.BRAND, { route: "/" })
  @prop()
  @required()
  brand!: string;

  @uielement(DocsElements.TEXT)
  @prop()
  version?: string;

  constructor(arg?: ModelArg<DocsHeaderView>) {
    super(arg);
  }
}

/**
 * @description Site-wide footer view model.
 * @summary Binds to the "docs.footer" element and renders a single text line,
 * typically the project name and version joined by DocsPageService.
 * @class DocsFooterView
 * @category UI
 */
@uimodel(DocsElements.FOOTER)
@model()
@stableName("DocsFooterView")
export class DocsFooterView extends Model {
  @uielement(DocsElements.TEXT)
  @prop()
  @required()
  text!: string;

  constructor(arg?: ModelArg<DocsFooterView>) {
    super(arg);
  }
}

/**
 * @description Search view model holding the documentation search index entries.
 * @summary Binds to the "docs.search" element and carries the ranked search
 * entries surfaced in the sidebar navigation.
 * @class DocsSearchView
 * @category UI
 */
@uimodel(DocsElements.SEARCH)
@model()
@stableName("DocsSearchView")
export class DocsSearchView extends Model {
  @uielement(DocsElements.SEARCH_ENTRIES)
  @prop()
  @required()
  entries: DocsSearchEntry[] = [];

  constructor(arg?: ModelArg<DocsSearchView>) {
    super(arg);
  }
}

/**
 * @description Sidebar navigation view model.
 * @summary Binds to the "docs.sidebar" layout and composes the search view, a
 * section heading, and the nested navigation entries into a 3-row, 3-column
 * grid. Populated by DocsPageService from the page's navigation records.
 * @class DocsNavigationView
 * @category UI
 */
@uilayout(DocsElements.SIDEBAR, 1, 3, { gap: "small" })
@model()
@stableName("DocsNavigationView")
export class DocsNavigationView extends Model {
  @uichild("DocsSearchView", DocsElements.SEARCH, { row: 1, col: 1 })
  search!: DocsSearchView;

  @uielement(DocsElements.HEADING, { level: 2, row: 2 })
  @prop()
  title?: string;

  @uielement(DocsElements.NAVIGATION_ITEMS, { row: 3 })
  @prop()
  @required()
  items: DocsNavigationEntry[] = [];

  constructor(arg?: ModelArg<DocsNavigationView>) {
    super(arg);
  }
}

/**
 * @description Breadcrumb trail view model.
 * @summary Binds to the "docs.breadcrumbs" element and renders the ordered
 * crumb entries leading to the current page.
 * @class DocsBreadcrumbsView
 * @category UI
 */
@uimodel(DocsElements.BREADCRUMBS)
@model()
@stableName("DocsBreadcrumbsView")
export class DocsBreadcrumbsView extends Model {
  @uielement(DocsElements.BREADCRUMB_ITEMS)
  @prop()
  @required()
  items: DocsBreadcrumbEntry[] = [];

  constructor(arg?: ModelArg<DocsBreadcrumbsView>) {
    super(arg);
  }
}

/**
 * @description "On this page" table of contents view model.
 * @summary Binds to the "docs.toc" element and renders an optional heading plus
 * the anchor entries derived from the page's titled sections.
 * @class DocsTableOfContentsView
 * @category UI
 */
@uimodel(DocsElements.TOC)
@model()
@stableName("DocsTableOfContentsView")
export class DocsTableOfContentsView extends Model {
  @uielement(DocsElements.HEADING, { level: 2 })
  @prop()
  title?: string;

  @uielement(DocsElements.TOC_ITEMS)
  @prop()
  @required()
  items: DocsTocEntry[] = [];

  constructor(arg?: ModelArg<DocsTableOfContentsView>) {
    super(arg);
  }
}

/**
 * @description View model holding the content sections of a documentation page.
 * @summary Binds to the "docs.sections" element and renders the ordered section
 * entries built by DocsPageService.
 * @class DocsPageSectionsView
 * @category UI
 */
@uimodel(DocsElements.SECTIONS)
@model()
@stableName("DocsPageSectionsView")
export class DocsPageSectionsView extends Model {
  @uielement(DocsElements.SECTION_LIST)
  @prop()
  @required()
  items: DocsSectionEntry[] = [];

  constructor(arg?: ModelArg<DocsPageSectionsView>) {
    super(arg);
  }
}

/**
 * @description Simple symbol descriptor view model.
 * @summary Binds to the "docs.symbol" element and renders a symbol's name,
 * kind, and description through dedicated name/kind/description slots.
 * @class DocsSymbolView
 * @category UI
 */
@uimodel(DocsElements.SYMBOL)
@model()
@stableName("DocsSymbolView")
export class DocsSymbolView extends Model {
  @uielement(DocsElements.SYMBOL_NAME)
  @prop()
  @required()
  name!: string;

  @uielement(DocsElements.SYMBOL_KIND)
  @prop()
  @required()
  kind!: string;

  @uielement(DocsElements.SYMBOL_DESCRIPTION)
  @prop()
  description?: string;

  constructor(arg?: ModelArg<DocsSymbolView>) {
    super(arg);
  }
}

/**
 * @description Signature view model for a documented callable.
 * @summary Binds to the "docs.signature" element and renders the signature's
 * name, parameters text, and return type through dedicated slots.
 * @class DocsSignatureView
 * @category UI
 */
@uimodel(DocsElements.SIGNATURE)
@model()
@stableName("DocsSignatureView")
export class DocsSignatureView extends Model {
  @uielement(DocsElements.SIGNATURE_NAME)
  @prop()
  @required()
  name!: string;

  @uielement(DocsElements.SIGNATURE_PARAMETERS)
  @prop()
  parameters?: string;

  @uielement(DocsElements.SIGNATURE_RETURNS)
  @prop()
  returns?: string;

  constructor(arg?: ModelArg<DocsSignatureView>) {
    super(arg);
  }
}

/**
 * @description Member list view model.
 * @summary Binds to the "docs.members" element and renders API member rows
 * (methods, properties, and similar) for a documented symbol.
 * @class DocsMembersView
 * @category UI
 */
@uimodel(DocsElements.MEMBERS)
@model()
@stableName("DocsMembersView")
export class DocsMembersView extends Model {
  @uielement(DocsElements.MEMBER_LIST)
  @prop()
  @required()
  items: DocsMemberEntry[] = [];

  constructor(arg?: ModelArg<DocsMembersView>) {
    super(arg);
  }
}

/**
 * @description Example list view model.
 * @summary Binds to the "docs.examples" element and renders the code examples
 * attached to a documented symbol.
 * @class DocsExamplesView
 * @category UI
 */
@uimodel(DocsElements.EXAMPLES)
@model()
@stableName("DocsExamplesView")
export class DocsExamplesView extends Model {
  @uielement(DocsElements.EXAMPLE_LIST)
  @prop()
  @required()
  items: DocsExampleEntry[] = [];

  constructor(arg?: ModelArg<DocsExamplesView>) {
    super(arg);
  }
}

/**
 * @description Component documentation view model.
 * @summary Binds to the "docs.component" element and renders the component
 * view record (selector, framework, inputs, outputs) for a documented component.
 * @class DocsComponentView
 * @category UI
 */
@uimodel(DocsElements.COMPONENT)
@model()
@stableName("DocsComponentView")
export class DocsComponentView extends Model {
  @uielement(DocsElements.COMPONENT_VIEW)
  @prop()
  @required()
  component!: DocsComponentViewEntry;

  constructor(arg?: ModelArg<DocsComponentView>) {
    super(arg);
  }
}

/**
 * @description Live preview view model for a documented component.
 * @summary Binds to the "docs.preview" element and renders the preview entry
 * that drives the interactive component preview.
 * @class DocsPreviewView
 * @category UI
 */
@uimodel(DocsElements.PREVIEW)
@model()
@stableName("DocsPreviewView")
export class DocsPreviewView extends Model {
  @uielement(DocsElements.PREVIEW_VIEW)
  @prop()
  @required()
  preview!: DocsPreviewEntry;

  constructor(arg?: ModelArg<DocsPreviewView>) {
    super(arg);
  }
}

/**
 * @description Source location view model for a documented symbol.
 * @summary Binds to the "docs.source" element and renders the source entry
 * (file, line/column, repository, and optional code).
 * @class DocsSourceView
 * @category UI
 */
@uimodel(DocsElements.SOURCE)
@model()
@stableName("DocsSourceView")
export class DocsSourceView extends Model {
  @uielement(DocsElements.SOURCE_VIEW)
  @prop()
  @required()
  source!: DocsSourceViewEntry;

  constructor(arg?: ModelArg<DocsSourceView>) {
    super(arg);
  }
}

/**
 * @description Tutorial content view model.
 * @summary Binds to the "docs.tutorial" element and renders the tutorial's
 * content, joined by DocsPageService from the page's prose sections.
 * @class DocsTutorialView
 * @category UI
 */
@uimodel(DocsElements.TUTORIAL)
@model()
@stableName("DocsTutorialView")
export class DocsTutorialView extends Model {
  @uielement(DocsElements.TUTORIAL_CONTENT)
  @prop()
  content?: string;

  constructor(arg?: ModelArg<DocsTutorialView>) {
    super(arg);
  }
}

/**
 * @description Related symbols view model.
 * @summary Binds to the "docs.related" element and renders a short list of
 * navigation entries pointing to symbols of the same kind as the current page.
 * @class DocsRelatedSymbolsView
 * @category UI
 */
@uimodel(DocsElements.RELATED)
@model()
@stableName("DocsRelatedSymbolsView")
export class DocsRelatedSymbolsView extends Model {
  @uielement(DocsElements.RELATED_LIST)
  @prop()
  @required()
  items: DocsNavigationEntry[] = [];

  constructor(arg?: ModelArg<DocsRelatedSymbolsView>) {
    super(arg);
  }
}
