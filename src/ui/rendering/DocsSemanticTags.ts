/**
 * @description Framework-neutral registry of semantic element tags for documentation rendering.
 * @summary Every shared layout and view model references only these tags; a
 * rendering target maps each tag to a native component of its engine. Tags
 * cover site/page layouts, structural areas (header, footer, sidebar,
 * breadcrumbs), content elements (symbol, signature, members, examples, code,
 * component, preview, search, source, tutorial), and the leaf element slots
 * inside each view.
 */
// Framework-neutral semantic vocabulary used by every documentation renderer.
// Shared layout and view models reference these tags only; a rendering target
// maps each tag to a native component.
export const DocsElements = {
  SITE_LAYOUT: "docs.layout.site",
  PAGE_LAYOUT: "docs.layout.page",
  CLASS_LAYOUT: "docs.layout.class",
  COMPONENT_LAYOUT: "docs.layout.component",
  TUTORIAL_LAYOUT: "docs.layout.tutorial",
  SOURCE_LAYOUT: "docs.layout.source",
  HOME_LAYOUT: "docs.layout.home",
  BODY_LAYOUT: "docs.layout.body",
  CONTENT_LAYOUT: "docs.layout.content",
  HEADER: "docs.header",
  FOOTER: "docs.footer",
  SIDEBAR: "docs.sidebar",
  BREADCRUMBS: "docs.breadcrumbs",
  SYMBOL: "docs.symbol",
  SIGNATURE: "docs.signature",
  METHOD: "docs.method",
  PARAMETERS: "docs.parameters",
  RETURNS: "docs.returns",
  MEMBERS: "docs.members",
  EXAMPLES: "docs.examples",
  CODE: "docs.code",
  COMPONENT: "docs.component",
  PREVIEW: "docs.preview",
  SEARCH: "docs.search",
  SOURCE: "docs.source",
  TUTORIAL: "docs.tutorial",
  SECTIONS: "docs.sections",
  RELATED: "docs.related",
  TOC: "docs.toc",
  NAVIGATION: "docs.navigation",

  TEXT: "docs.text",
  HEADING: "docs.heading",
  LINK: "docs.link",
  BRAND: "docs.brand",
  MARKDOWN: "docs.markdown",
  SIGNATURE_NAME: "docs.signature.name",
  SIGNATURE_PARAMETERS: "docs.signature.parameters",
  SIGNATURE_RETURNS: "docs.signature.returns",
  SYMBOL_NAME: "docs.symbol.name",
  SYMBOL_KIND: "docs.symbol.kind",
  SYMBOL_DESCRIPTION: "docs.symbol.description",
  NAVIGATION_ITEMS: "docs.navigation.items",
  BREADCRUMB_ITEMS: "docs.breadcrumbs.items",
  TOC_ITEMS: "docs.toc.items",
  SECTION_LIST: "docs.sections.items",
  MEMBER_LIST: "docs.members.items",
  EXAMPLE_LIST: "docs.examples.items",
  RELATED_LIST: "docs.related.items",
  SOURCE_VIEW: "docs.source.view",
  COMPONENT_VIEW: "docs.component.view",
  PREVIEW_VIEW: "docs.preview.view",
  SEARCH_ENTRIES: "docs.search.entries",
  TUTORIAL_CONTENT: "docs.tutorial.content",
} as const;

/**
 * @description Union of every semantic element tag declared in DocsElements.
 * @summary The tag type rendering targets must accept when mapping a docs
 * semantic tag to a native component.
 */
export type DocsElement =
  (typeof DocsElements)[keyof typeof DocsElements];

/**
 * @description Semantic tags a rendering target must map to render a complete docs site.
 * @summary The minimum element set for a full publication: site and page
 * layouts, header, footer, sidebar, breadcrumbs, symbol, signature, members,
 * examples, code, component, preview, search, source, tutorial, and table of
 * contents. Any tag outside this list is optional for a rendering target.
 */
export const DOCS_REQUIRED_ELEMENTS: readonly DocsElement[] = [
  DocsElements.SITE_LAYOUT,
  DocsElements.PAGE_LAYOUT,
  DocsElements.HEADER,
  DocsElements.FOOTER,
  DocsElements.SIDEBAR,
  DocsElements.BREADCRUMBS,
  DocsElements.SYMBOL,
  DocsElements.SIGNATURE,
  DocsElements.MEMBERS,
  DocsElements.EXAMPLES,
  DocsElements.CODE,
  DocsElements.COMPONENT,
  DocsElements.PREVIEW,
  DocsElements.SEARCH,
  DocsElements.SOURCE,
  DocsElements.TUTORIAL,
  DocsElements.TOC,
];
