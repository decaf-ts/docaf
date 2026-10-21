export * from "../components";

export { DocsSectionsComponent as DocsListComponent } from "../components/docs-sections/docs-sections.component";
export { DocsNavTreeComponent as DocsNavChildrenComponent } from "../components/docs-nav-tree/docs-nav-tree.component";

import {
  DocsBodyLayoutComponent,
  DocsBrandComponent,
  DocsBreadcrumbsComponent,
  DocsChildrenComponent,
  DocsClassPageComponent,
  DocsCodeComponent,
  DocsComponentMetadataComponent,
  DocsComponentPageComponent,
  DocsExamplesComponent,
  DocsFooterComponent,
  DocsGenericPageComponent,
  DocsHeaderComponent,
  DocsHomePageComponent,
  DocsLinkComponent,
  DocsMembersComponent,
  DocsNavigationItemsComponent,
  DocsNavTreeComponent,
  DocsParametersComponent,
  DocsPreviewComponent,
  DocsRelatedComponent,
  DocsReturnsComponent,
  DocsSearchComponent,
  DocsSectionsComponent,
  DocsSidebarComponent,
  DocsSignatureComponent,
  DocsSiteLayoutComponent,
  DocsSourceComponent,
  DocsSourcePageComponent,
  DocsSymbolComponent,
  DocsTextComponent,
  DocsTocComponent,
  DocsTutorialComponent,
  DocsTutorialPageComponent,
} from "../components";

/**
 * @description The dedicated Angular standalone components registered for docs rendering.
 * @summary One component per docs semantic element/layout tag: site, body, and
 * page layouts; header, footer, sidebar, navigation, breadcrumbs, table of
 * contents, search; symbol, signature, parameters, returns, members, examples,
 * code, source, tutorial, sections, related symbols, component metadata, and
 * the live preview. Consumed by the {@link AngularDocsRendererAdapter} to map
 * semantic tags to native components.
 * @const DOCS_ANGULAR_PRIMITIVES
 * @category Rendering
 * @memberOf module:docaf
 */
export const DOCS_ANGULAR_PRIMITIVES = [
  DocsChildrenComponent,
  DocsTextComponent,
  DocsBrandComponent,
  DocsLinkComponent,
  DocsHeaderComponent,
  DocsFooterComponent,
  DocsSidebarComponent,
  DocsSearchComponent,
  DocsNavTreeComponent,
  DocsNavigationItemsComponent,
  DocsBreadcrumbsComponent,
  DocsTocComponent,
  DocsCodeComponent,
  DocsExamplesComponent,
  DocsMembersComponent,
  DocsParametersComponent,
  DocsReturnsComponent,
  DocsSignatureComponent,
  DocsSectionsComponent,
  DocsSymbolComponent,
  DocsTutorialComponent,
  DocsSourceComponent,
  DocsRelatedComponent,
  DocsComponentMetadataComponent,
  DocsPreviewComponent,
  DocsSiteLayoutComponent,
  DocsBodyLayoutComponent,
  DocsClassPageComponent,
  DocsComponentPageComponent,
  DocsTutorialPageComponent,
  DocsSourcePageComponent,
  DocsHomePageComponent,
  DocsGenericPageComponent,
] as const;

/**
 * @description Loader returning a preview component class asynchronously.
 * @summary The shape {@link DocsAngularRuntime} preview loaders must satisfy:
 * a factory resolving to a component constructor whose inputs are plain
 * record properties.
 * @typedef {function(): Promise<Constructor<Record<string, unknown>>>} DocsAngularPreviewSource
 * @category Rendering
 * @memberOf module:docaf
 */
export type DocsAngularPreviewSource = () => Promise<
  new (...args: unknown[]) => Record<string, unknown>
>;
