import { Inject, Injectable, InjectionToken } from "@angular/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { DocsRuntime } from "../../runtime/DocsRuntime";
import type { DocsSnapshotV1 } from "../../snapshot/records";
import { DocsPageService } from "../../ui/DocsPageService";
import type { DocsAngularPreviewSource } from "../rendering/DocsAngularComponents";

/**
 * @description Map of preview keys to preview loaders for the Angular docs runtime.
 * @summary Keys are component UIDs, preview entry names, or preview UIDs produced by the docs
 * build; values are dynamic loaders returning the Angular component class for each preview.
 * @memberOf module:docaf
 */
export type DocsAngularPreviewRegistry = Record<
  string,
  DocsAngularPreviewSource
>;

/**
 * @description Angular injection token providing the static application's preview loaders.
 * @summary Generated preview registry files assign loaders under this token in the app config.
 * Falls back to an empty registry when no loaders are provided.
 */
// Preview loaders generated for the static documentation application.
export const DOCS_ANGULAR_PREVIEWS = new InjectionToken<DocsAngularPreviewRegistry>(
  "DOCS_ANGULAR_PREVIEWS",
  { factory: () => ({}) }
);

/**
 * @description Options for initializing the Angular docs runtime.
 * @summary Currently allows overriding the URL from which the docs snapshot is fetched
 * (defaults to `assets/docs/snapshot.json`).
 */
export interface DocsAngularRuntimeOptions {
  snapshotUrl?: string;
  snapshot?: DocsSnapshotV1;
}

/**
 * @description Root-scoped Angular bridge between the framework-neutral docs runtime and Angular.
 * @summary On construction it registers the Angular docs rendering elements and layouts with the
 * Decaf rendering engine and loads the preview loaders injected via {@link DOCS_ANGULAR_PREVIEWS}.
 * `initialize` fetches the docs snapshot into the {@link DocsRuntime} database (deduplicating
 * concurrent calls) and exposes a {@link DocsPageService} used by the docs page host to resolve
 * page layouts for routes. Preview lookups accept component UIDs, preview entries, or preview UIDs.
 * @class DocsAngularRuntime
 */
// Root-scoped bridge between the framework-neutral docs runtime and Angular.
// The static application registers generated preview loaders here.
@Injectable({ providedIn: "root" })
export class DocsAngularRuntime {
  private readonly runtime = new DocsRuntime();
  private service?: DocsPageService;
  private readonly loaders = new Map<string, DocsAngularPreviewSource>();
  private snapshotUrl?: string;
  private loading?: Promise<DocsPageService>;
  private registration?: Promise<void>;

  constructor(
    @Inject(DOCS_ANGULAR_PREVIEWS) previews: DocsAngularPreviewRegistry,
    private readonly suppliedSnapshot?: DocsSnapshotV1
  ) {
    for (const [key, loader] of Object.entries(previews ?? {}))
      this.loaders.set(key, loader);
    void this.ensureElements();
  }

  get pageService(): DocsPageService {
    if (!this.service)
      throw new InternalError("Documentation runtime not initialized");
    return this.service;
  }

  get initialized(): boolean {
    return this.service !== undefined;
  }

  registerPreview(key: string, loader: DocsAngularPreviewSource): void {
    this.loaders.set(key, loader);
  }

  previewLoader(key: string | undefined): DocsAngularPreviewSource | undefined {
    return key ? this.loaders.get(key) : undefined;
  }

  previewKeys(): string[] {
    return [...this.loaders.keys()];
  }

  async initialize(
    options: DocsAngularRuntimeOptions = {}
  ): Promise<DocsPageService> {
    if (this.service) return this.service;
    if (this.loading) return this.loading;
    this.snapshotUrl =
      options.snapshotUrl ?? this.snapshotUrl ?? "assets/docs/snapshot.json";
    const snapshot = options.snapshot ?? this.suppliedSnapshot;
    this.loading = (async () => {
      await this.ensureElements();
      const database = snapshot
        ? await this.runtime.bootstrap(snapshot)
        : await this.runtime.initialize(this.snapshotUrl as string);
      this.service = new DocsPageService(database);
      return this.service;
    })();
    try {
      return await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  private ensureElements(): Promise<void> {
    if (!this.registration) {
      this.registration = (async () => {
        const { registerAngularDocsElements, registerAngularDocsLayouts } =
          await import("../rendering/AngularDocsRendererAdapter");
        registerAngularDocsElements();
        registerAngularDocsLayouts();
      })();
    }
    return this.registration;
  }
}
