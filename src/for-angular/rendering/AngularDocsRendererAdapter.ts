import { LayoutComponent, NgxRenderingEngine } from "@decaf-ts/for-angular";
import type { DocsRendererAdapter } from "../../ui/rendering/DocsRendererAdapter";
import type { DocsRendererCapability } from "../../ui/rendering/DocsRendererCapabilities";
import { DocsElements } from "../../ui/rendering/DocsSemanticTags";
import {
  DOCS_ANGULAR_PRIMITIVES,
  DocsBrandComponent,
  DocsComponentMetadataComponent,
  DocsLinkComponent,
  DocsListComponent,
  DocsPreviewComponent,
  DocsSearchComponent,
  DocsSourceComponent,
  DocsTextComponent,
  DocsTutorialComponent,
} from "./DocsAngularComponents";

/**
 * @description Rendering capabilities the Angular docs renderer supports.
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

const CONTAINER_ELEMENTS = [
  DocsElements.SITE_LAYOUT,
  DocsElements.PAGE_LAYOUT,
  DocsElements.CLASS_LAYOUT,
  DocsElements.COMPONENT_LAYOUT,
  DocsElements.TUTORIAL_LAYOUT,
  DocsElements.SOURCE_LAYOUT,
  DocsElements.HOME_LAYOUT,
  DocsElements.BODY_LAYOUT,
  DocsElements.CONTENT_LAYOUT,
  DocsElements.HEADER,
  DocsElements.FOOTER,
  DocsElements.SIDEBAR,
  DocsElements.BREADCRUMBS,
  DocsElements.SYMBOL,
  DocsElements.SIGNATURE,
  DocsElements.METHOD,
  DocsElements.PARAMETERS,
  DocsElements.RETURNS,
  DocsElements.MEMBERS,
  DocsElements.EXAMPLES,
  DocsElements.CODE,
  DocsElements.COMPONENT,
  DocsElements.PREVIEW,
  DocsElements.SEARCH,
  DocsElements.SOURCE,
  DocsElements.TUTORIAL,
  DocsElements.SECTIONS,
  DocsElements.RELATED,
  DocsElements.TOC,
  DocsElements.NAVIGATION,
];

const TEXT_ELEMENTS = [
  DocsElements.TEXT,
  DocsElements.HEADING,
  DocsElements.MARKDOWN,
  DocsElements.SIGNATURE_NAME,
  DocsElements.SIGNATURE_PARAMETERS,
  DocsElements.SIGNATURE_RETURNS,
  DocsElements.SYMBOL_NAME,
  DocsElements.SYMBOL_KIND,
  DocsElements.SYMBOL_DESCRIPTION,
];

const LIST_ELEMENTS = [
  DocsElements.NAVIGATION_ITEMS,
  DocsElements.BREADCRUMB_ITEMS,
  DocsElements.TOC_ITEMS,
  DocsElements.SECTION_LIST,
  DocsElements.MEMBER_LIST,
  DocsElements.EXAMPLE_LIST,
  DocsElements.RELATED_LIST,
];

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
 * @summary Maps every docs semantic tag to its Angular implementation: container/layout tags
 * to the shared {@link LayoutComponent}, text tags to {@link DocsTextComponent}, list tags to
 * {@link DocsListComponent}, and the remaining tags to their dedicated primitive components
 * (brand, link, search, source, tutorial, component metadata, preview). Registration is
 * idempotent: elements already registered under the same name are silently kept.
 * @returns {void} Nothing.
 */
export function registerAngularDocsElements(): void {
  for (const tag of CONTAINER_ELEMENTS) register(tag, LayoutComponent);
  for (const tag of TEXT_ELEMENTS) register(tag, DocsTextComponent);
  for (const tag of LIST_ELEMENTS) register(tag, DocsListComponent);
  register(DocsElements.BRAND, DocsBrandComponent);
  register(DocsElements.LINK, DocsLinkComponent);
  register(DocsElements.SEARCH_ENTRIES, DocsSearchComponent);
  register(DocsElements.SOURCE_VIEW, DocsSourceComponent);
  register(DocsElements.TUTORIAL_CONTENT, DocsTutorialComponent);
  register(DocsElements.COMPONENT_VIEW, DocsComponentMetadataComponent);
  register(DocsElements.PREVIEW_VIEW, DocsPreviewComponent);
}

/**
 * @description Registers only the container/layout elements with the rendering engine.
 * @summary Maps the docs layout/semantic container tags to the shared Angular
 * {@link LayoutComponent}, idempotently. Useful when text/list components are registered
 * separately or by the runtime bootstrap.
 * @returns {void} Nothing.
 */
export function registerAngularDocsLayouts(): void {
  for (const tag of CONTAINER_ELEMENTS) register(tag, LayoutComponent);
}

/**
 * @description Angular implementation of the renderer-independent docs renderer adapter contract.
 * @summary Adapts the docs ui contracts to the Decaf Angular rendering engine. `initialize`
 * creates and initializes an {@link NgxRenderingEngine} (idempotent) and registers the docs
 * elements and layouts; `createApplication` stores the running Angular runtime and triggers
 * initialization. Its capabilities are the {@link DOCS_ANGULAR_CAPABILITIES} set.
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

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const engine = new NgxRenderingEngine();
    await engine.initialize();
    this.registerElements();
    this.registerLayouts();
    this.initialized = true;
  }

  registerElements(): void {
    registerAngularDocsElements();
  }

  registerLayouts(): void {
    registerAngularDocsLayouts();
  }

  async createApplication(runtime: unknown): Promise<void> {
    this.runtime = runtime;
    await this.initialize();
  }
}

/**
 * @description Angular component factories exported under the docs renderer-agnostic name.
 * @summary Alias of {@link DOCS_ANGULAR_PRIMITIVES}, allowing consumers to reference the
 * registered primitive components without depending on the Angular-specific name.
 */
export const DOCS_ANGULAR_COMPONENT_FACTORIES = DOCS_ANGULAR_PRIMITIVES;
