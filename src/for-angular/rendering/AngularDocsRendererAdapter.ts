import { NgxRenderingEngine } from "@decaf-ts/for-angular";
import type { DocsRendererAdapter } from "../../ui/rendering/DocsRendererAdapter";
import type { DocsRendererCapability } from "../../ui/rendering/DocsRendererCapabilities";
import { DocsElements } from "../../ui/rendering/DocsSemanticTags";
import {
  DOCS_ANGULAR_PRIMITIVES,
  DocsBodyLayoutComponent,
  DocsBrandComponent,
  DocsBreadcrumbsComponent,
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
} from "./DocsAngularComponents";

/**
 * @description Rendering capabilities the Angular docs renderer supports.
 * @const DOCS_ANGULAR_CAPABILITIES
 * @category Rendering
 * @memberOf module:docaf
 * @summary Declared by the {@link AngularDocsRendererAdapter}: grid/flex/nested layouts,
 * navigation, routing, markdown rendering, search, native component previews, responsive and
 * accessibility support.
 */
export const DOCS_ANGULAR_CAPABILITIES: readonly DocsRendererCapability[] = [
  "layout.grid",
  "layout.flex",
  "layout.nested",
  "navigation",
  "routing",
  "markdown",
  "search",
  "component.native-preview",
  "responsive",
  "accessibility",
];

const LAYOUT_ELEMENTS = [
  DocsElements.SITE_LAYOUT,
  DocsElements.BODY_LAYOUT,
  DocsElements.PAGE_LAYOUT,
  DocsElements.CONTENT_LAYOUT,
  DocsElements.CLASS_LAYOUT,
  DocsElements.COMPONENT_LAYOUT,
  DocsElements.TUTORIAL_LAYOUT,
  DocsElements.SOURCE_LAYOUT,
  DocsElements.HOME_LAYOUT,
];

const ELEMENT_COMPONENTS: Record<string, unknown> = {
  [DocsElements.SITE_LAYOUT]: DocsSiteLayoutComponent,
  [DocsElements.BODY_LAYOUT]: DocsBodyLayoutComponent,
  [DocsElements.PAGE_LAYOUT]: DocsGenericPageComponent,
  [DocsElements.CONTENT_LAYOUT]: DocsGenericPageComponent,
  [DocsElements.CLASS_LAYOUT]: DocsClassPageComponent,
  [DocsElements.COMPONENT_LAYOUT]: DocsComponentPageComponent,
  [DocsElements.TUTORIAL_LAYOUT]: DocsTutorialPageComponent,
  [DocsElements.SOURCE_LAYOUT]: DocsSourcePageComponent,
  [DocsElements.HOME_LAYOUT]: DocsHomePageComponent,
  [DocsElements.HEADER]: DocsHeaderComponent,
  [DocsElements.FOOTER]: DocsFooterComponent,
  [DocsElements.SIDEBAR]: DocsSidebarComponent,
  [DocsElements.BREADCRUMBS]: DocsBreadcrumbsComponent,
  [DocsElements.SYMBOL]: DocsSymbolComponent,
  [DocsElements.SIGNATURE]: DocsSignatureComponent,
  [DocsElements.METHOD]: DocsMembersComponent,
  [DocsElements.PARAMETERS]: DocsParametersComponent,
  [DocsElements.RETURNS]: DocsReturnsComponent,
  [DocsElements.MEMBERS]: DocsMembersComponent,
  [DocsElements.EXAMPLES]: DocsExamplesComponent,
  [DocsElements.CODE]: DocsCodeComponent,
  [DocsElements.COMPONENT]: DocsComponentMetadataComponent,
  [DocsElements.PREVIEW]: DocsPreviewComponent,
  [DocsElements.SEARCH]: DocsSearchComponent,
  [DocsElements.SOURCE]: DocsSourceComponent,
  [DocsElements.TUTORIAL]: DocsTutorialComponent,
  [DocsElements.SECTIONS]: DocsSectionsComponent,
  [DocsElements.RELATED]: DocsRelatedComponent,
  [DocsElements.TOC]: DocsTocComponent,
  [DocsElements.NAVIGATION]: DocsNavigationItemsComponent,
  [DocsElements.TEXT]: DocsTextComponent,
  [DocsElements.HEADING]: DocsTextComponent,
  [DocsElements.LINK]: DocsLinkComponent,
  [DocsElements.BRAND]: DocsBrandComponent,
  [DocsElements.MARKDOWN]: DocsTutorialComponent,
  [DocsElements.SIGNATURE_NAME]: DocsTextComponent,
  [DocsElements.SIGNATURE_PARAMETERS]: DocsTextComponent,
  [DocsElements.SIGNATURE_RETURNS]: DocsTextComponent,
  [DocsElements.SYMBOL_NAME]: DocsTextComponent,
  [DocsElements.SYMBOL_KIND]: DocsTextComponent,
  [DocsElements.SYMBOL_DESCRIPTION]: DocsTextComponent,
  [DocsElements.NAVIGATION_ITEMS]: DocsNavigationItemsComponent,
  [DocsElements.BREADCRUMB_ITEMS]: DocsBreadcrumbsComponent,
  [DocsElements.TOC_ITEMS]: DocsTocComponent,
  [DocsElements.SECTION_LIST]: DocsSectionsComponent,
  [DocsElements.MEMBER_LIST]: DocsMembersComponent,
  [DocsElements.EXAMPLE_LIST]: DocsExamplesComponent,
  [DocsElements.RELATED_LIST]: DocsRelatedComponent,
  [DocsElements.SOURCE_VIEW]: DocsSourceComponent,
  [DocsElements.COMPONENT_VIEW]: DocsComponentMetadataComponent,
  [DocsElements.PREVIEW_VIEW]: DocsPreviewComponent,
  [DocsElements.SEARCH_ENTRIES]: DocsSearchComponent,
  [DocsElements.TUTORIAL_CONTENT]: DocsTutorialComponent,
};

/**
 * @description Registers one component under a semantic tag with the rendering engine.
 * @summary Skips tags already registered under the same name and swallows
 * duplicate-registration errors; any other registration failure is rethrown.
 * @param {string} name - semantic tag to register (e.g. "docs.code").
 * @param {unknown} component - the Angular standalone component to register.
 * @returns {void}
 * @memberOf module:docaf
 */
function register(name: string, component: unknown): void {
  try {
    NgxRenderingEngine.components(name);
    return;
  } catch {
    // Not registered under this semantic name yet.
  }
  try {
    NgxRenderingEngine.registerComponent(
      name,
      component as Parameters<typeof NgxRenderingEngine.registerComponent>[1]
    );
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (!/already registered/i.test(message)) throw error;
  }
}

/**
 * @description Registers all Angular docs components with the Decaf rendering engine.
 * @summary Maps every docs semantic tag to its dedicated Angular standalone component
 * (header, footer, sidebar, breadcrumbs, symbol, signature, parameters, returns, members,
 * sections, examples, code, source, tutorial, search, table of contents, related symbols,
 * component metadata, preview, and the site/body/page layouts). Registration is idempotent:
 * elements already registered under the same name are silently kept.
 * @function registerAngularDocsElements
 * @category Rendering
 * @memberOf module:docaf
 * @returns {void} Nothing.
 */
export function registerAngularDocsElements(): void {
  for (const [tag, component] of Object.entries(ELEMENT_COMPONENTS))
    register(tag, component);
}

/**
 * @description Registers only the container/layout elements with the rendering engine.
 * @summary Maps the docs layout semantic tags to their dedicated Angular page/layout
 * components, idempotently. Useful when leaf components are registered separately or by the
 * runtime bootstrap.
 * @function registerAngularDocsLayouts
 * @category Rendering
 * @memberOf module:docaf
 * @returns {void} Nothing.
 */
export function registerAngularDocsLayouts(): void {
  for (const tag of LAYOUT_ELEMENTS) register(tag, ELEMENT_COMPONENTS[tag]);
}

/**
 * @description Angular implementation of the renderer-independent docs renderer adapter contract.
 * @summary Adapts the docs ui contracts to the Decaf Angular rendering engine. `initialize`
 * creates and initializes an {@link NgxRenderingEngine} (idempotent) and registers the docs
 * elements and layouts; `createApplication` stores the running Angular runtime and triggers
 * initialization. Its capabilities are the {@link DOCS_ANGULAR_CAPABILITIES} set.
 * @category Rendering
 * @example
 * const adapter = new AngularDocsRendererAdapter();
 * await adapter.initialize();
 * await adapter.createApplication(docsRuntime);
 * @class AngularDocsRendererAdapter
 */
export class AngularDocsRendererAdapter implements DocsRendererAdapter {
  readonly id = "angular";
  readonly flavour = "angular";
  readonly capabilities: ReadonlySet<DocsRendererCapability> = new Set(
    DOCS_ANGULAR_CAPABILITIES
  );

  private runtime?: unknown;
  private initialized = false;

  /**
   * @description Creates and initializes the rendering engine, registering docs elements.
   * @summary Idempotent: subsequent calls return immediately. Registers every
   * docs semantic element and layout with the new {@link NgxRenderingEngine}.
   * @returns {Promise<void>} resolves when the engine is ready.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const engine = new NgxRenderingEngine();
    await engine.initialize();
    this.registerElements();
    this.registerLayouts();
    this.initialized = true;
  }

  /**
   * @description Registers all docs semantic elements with the rendering engine.
   * @returns {void}
   */
  registerElements(): void {
    registerAngularDocsElements();
  }

  /**
   * @description Registers the docs layout elements with the rendering engine.
   * @returns {void}
   */
  registerLayouts(): void {
    registerAngularDocsLayouts();
  }

  /**
   * @description Stores the running docs runtime and ensures the engine is initialized.
   * @param {unknown} runtime - the Angular docs runtime handling snapshot hydration.
   * @returns {Promise<void>} resolves when the adapter is ready to render.
   */
  async createApplication(runtime: unknown): Promise<void> {
    this.runtime = runtime;
    await this.initialize();
  }
}

/**
 * @description Angular component factories exported under the docs renderer-agnostic name.
 * @const DOCS_ANGULAR_COMPONENT_FACTORIES
 * @category Rendering
 * @memberOf module:docaf
 * @summary Alias of {@link DOCS_ANGULAR_PRIMITIVES}, allowing consumers to reference the
 * registered dedicated components without depending on the Angular-specific name.
 */
export const DOCS_ANGULAR_COMPONENT_FACTORIES = DOCS_ANGULAR_PRIMITIVES;
