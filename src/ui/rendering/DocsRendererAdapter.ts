import type { DocsRendererCapability } from "./DocsRendererCapabilities";

/**
 * @description Contract for integrating a rendering target with the docs UI package.
 * @summary An adapter binds an existing Decaf rendering engine to the docs
 * semantic element tags and layout models; it does not implement model
 * rendering itself. Adapters advertise their id, engine flavour, and capability
 * set, then initialize, register their elements and layouts, and create the
 * application for the publication runtime.
 */
// Renderer adapter contract. Implementations integrate an existing Decaf
// rendering engine; they do not implement model rendering themselves.
export interface DocsRendererAdapter {
  readonly id: string;
  readonly flavour: string;
  readonly capabilities: ReadonlySet<DocsRendererCapability>;

  initialize(): Promise<void>;
  registerElements(): void;
  registerLayouts(): void;
  createApplication(runtime: unknown): Promise<void>;
}

/**
 * @description Observable semantics every docs renderer adapter is expected to satisfy.
 * @summary Each async method represents one conformance check over the same
 * publication models across rendering targets: site layout, class and
 * component pages, tutorials, navigation, signatures, nested layouts, routing,
 * and search. Targets that fail a check do not conform to the shared contract.
 */
// Shared cross-renderer contract. Every rendering adapter is expected to
// satisfy the same observable semantics for the same publication models.
export interface DocsRendererContract {
  rendersSiteLayout(): Promise<void>;
  rendersClassPage(): Promise<void>;
  rendersComponentPage(): Promise<void>;
  rendersTutorial(): Promise<void>;
  rendersNavigation(): Promise<void>;
  rendersSignatures(): Promise<void>;
  rendersNestedLayouts(): Promise<void>;
  supportsRouting(): Promise<void>;
  supportsSearch(): Promise<void>;
}
