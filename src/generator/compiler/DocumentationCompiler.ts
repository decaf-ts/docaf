import { DocsDatabase } from "../../database/DocsDatabase";
import type {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPropertyModel,
  DocletModel,
  DocManifestModel,
  DocPageModel,
  DocSearchEntryModel,
} from "../../models";
import {
  exportDocsSnapshot,
  type DocsSnapshotV1,
} from "../../snapshot";
import {
  DecafPublisher,
  type DecafPublisherOptions,
  type PublicationResult,
} from "../../publisher/DecafPublisher";
import { loadPublicationDataset } from "../../publisher/dataset";
import type {
  DocsPipelineOptions,
  DocsPipelineResult,
} from "../pipeline/DocsPipeline";
import { DocsPipeline } from "../pipeline/DocsPipeline";

/**
 * @description Options for the programmatic documentation compiler.
 * @summary Extends `DocsPipelineOptions` while making `rootNames` optional:
 * when omitted they are derived from `source.include`, falling back to the
 * `src` directory. Also allows supplying a persistence `DocsDatabase`,
 * publisher overrides, and snapshot identity fields for `build()`/`compile()`.
 */
export interface DocumentationCompilerConfig
  extends Omit<DocsPipelineOptions, "rootNames"> {
  rootNames?: readonly string[];
  source?: {
    include?: string | readonly string[];
  };
  database?: DocsDatabase;
  publisher?: Omit<DecafPublisherOptions, "packageName">;
  snapshot?: {
    id?: string;
    sourceRevision?: string;
  };
}

/**
 * @description Result of the extraction phase of a documentation build.
 * @summary Bundles the doclets produced by the pipeline together with the
 * extracted component, component-property and component-event models, the
 * build diagnostics, and per-table record counts from the store.
 */
export interface DocumentationExtraction {
  doclets: DocletModel[];
  components: DocComponentModel[];
  componentProperties: DocComponentPropertyModel[];
  componentEvents: DocComponentEventModel[];
  diagnostics: DocsPipelineResult["diagnostics"];
  counts: Record<string, number>;
}

/**
 * @description Aggregate result of a full extraction-plus-publication build.
 * @summary Combines the extraction output with the publication result, the
 * exported versioned snapshot, the build manifest, and the published page and
 * search entry models produced by the publisher.
 */
export interface DocumentationBuildResult {
  extraction: DocumentationExtraction;
  publication: PublicationResult;
  snapshot: DocsSnapshotV1;
  manifest: DocManifestModel;
  pages: DocPageModel[];
  search: DocSearchEntryModel[];
}

function rootsOf(config: DocumentationCompilerConfig): string[] {
  if (config.rootNames?.length) return [...config.rootNames];
  const include = config.source?.include;
  if (!include) return ["src"];
  return typeof include === "string" ? [include] : [...include];
}

/**
 * Framework-neutral programmatic entry point. Extraction, publication and
 * snapshot export can be used separately or as one `build()` call.
 */
export class DocumentationCompiler {
  private readonly config: DocumentationCompilerConfig;

  constructor(config: DocumentationCompilerConfig) {
    this.config = config;
  }

  async extract(database?: DocsDatabase): Promise<DocumentationExtraction> {
    const pipeline = new DocsPipeline({
      ...this.config,
      rootNames: rootsOf(this.config),
    });
    const result = await pipeline.run();
    const target = database ?? this.database();
    await result.store.persist(target);
    return {
      doclets: result.doclets,
      components: result.store.get<DocComponentModel>("components"),
      componentProperties: result.store.get<DocComponentPropertyModel>(
        "componentProperties"
      ),
      componentEvents: result.store.get<DocComponentEventModel>(
        "componentEvents"
      ),
      diagnostics: result.diagnostics,
      counts: result.store.counts(),
    };
  }

  async publish(
    database: DocsDatabase = this.database()
  ): Promise<PublicationResult> {
    const dataset = await loadPublicationDataset(database);
    return this.publisher().publishDataset(database, dataset);
  }

  async build(
    database: DocsDatabase = this.database()
  ): Promise<DocumentationBuildResult> {
    const extraction = await this.extract(database);
    const publication = await this.publish(database);
    const snapshot = await exportDocsSnapshot(database, {
      project: this.config.project,
      build: {
        id: this.config.snapshot?.id,
        sourceRevision:
          this.config.snapshot?.sourceRevision ??
          this.config.publisher?.sourceRevision,
      },
    });
    return {
      extraction,
      publication,
      snapshot,
      manifest: publication.manifest,
      pages: publication.pages,
      search: publication.search,
    };
  }

  async compile(
    database?: DocsDatabase
  ): Promise<DocumentationBuildResult> {
    return this.build(database);
  }

  private database(): DocsDatabase {
    return this.config.database ?? new DocsDatabase();
  }

  private publisher(): DecafPublisher {
    return new DecafPublisher({
      ...(this.config.publisher ?? {}),
      packageName: this.config.project.name,
      projectName:
        this.config.publisher?.projectName ?? this.config.project.name,
      projectVersion:
        this.config.publisher?.projectVersion ?? this.config.project.version,
      sourceRevision:
        this.config.publisher?.sourceRevision ??
        this.config.snapshot?.sourceRevision,
      buildId: this.config.publisher?.buildId ?? this.config.snapshot?.id,
    });
  }
}

/**
 * @description Identity function wrapper for documentation compiler options.
 * @summary Returns the given configuration unchanged; it exists so
 * configuration can be written as `defineDocsConfig({...})` and type-checked
 * against `DocumentationCompilerConfig` (mirroring JSDoc-style `defineConfig`
 * helpers).
 * @param {DocumentationCompilerConfig} config - The compiler configuration.
 * @returns {DocumentationCompilerConfig} The same configuration object.
 * @memberOf module:docaf
 */
export function defineDocsConfig(
  config: DocumentationCompilerConfig
): DocumentationCompilerConfig {
  return config;
}
