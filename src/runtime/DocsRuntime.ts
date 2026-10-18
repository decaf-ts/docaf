import { InternalError, SerializationError } from "@decaf-ts/db-decorators";
import { DocsDatabase } from "../database/DocsDatabase";
import type { DocsSnapshotV1 } from "../snapshot/records";
import { hydrateDocsDatabase } from "../snapshot/hydrate";
import { validateDocsSnapshot } from "../snapshot/validate";

/**
 * @description Minimal response contract the docs runtime needs from a fetch implementation.
 * @summary Mirrors the subset of the standard `Response` used when loading a snapshot: an `ok`
 * flag, a numeric `status`, and a `json()` accessor returning the parsed payload.
 */
export interface DocsFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * @description Injectable fetch function used by the docs runtime to retrieve snapshots.
 * @summary Takes a snapshot URL and resolves with a `DocsFetchResponse`; allows hosts without a
 * global `fetch` (or with custom transport/auth needs) to supply their own loader.
 * @param {string} url - Absolute or relative URL of the docs snapshot to load.
 * @returns {Promise<DocsFetchResponse>} Response exposing `ok`, `status`, and `json()`.
 */
export type DocsFetch = (url: string) => Promise<DocsFetchResponse>;

/**
 * @description Configuration options for `DocsRuntime`.
 * @summary All fields optional: `fetch` overrides the transport (defaults to `globalThis.fetch`,
 * throwing an `InternalError` when unavailable), and `alias` is the base name used for the
 * runtime's docs adapter (defaults to `"docs-browser"`, suffixed per database instance).
 */
export interface DocsRuntimeOptions {
  fetch?: DocsFetch;
  alias?: string;
}

const defaultFetch: DocsFetch = (url) => {
  const fetchImplementation = (
    globalThis as unknown as { fetch?: DocsFetch }
  ).fetch;
  if (typeof fetchImplementation !== "function")
    throw new InternalError(
      "No fetch implementation available for DocsRuntime; provide one explicitly"
    );
  return fetchImplementation(url);
};

/**
 * @description Browser-side facade that loads a docs snapshot into an in-memory database.
 * @summary Fetches a `DocsSnapshotV1` from a URL (or accepts one directly), validates it, and
 * bootstraps a fresh `DocsDatabase` hydrated with its contents. Each `bootstrap` run creates a
 * uniquely aliased database (`<alias>-<timestamp>-<random>`); re-initializing replaces the
 * runtime's current database. The `store` getter throws until initialization succeeds.
 * @example
 * const runtime = new DocsRuntime({ alias: "docs-browser" });
 * await runtime.initialize("/docs/snapshot.json");
 * const query = new DocsQueryService(runtime.store);
 * const doclets = await query.allDoclets();
 * @class DocsRuntime
 */
export class DocsRuntime {
  private database?: DocsDatabase;
  private readonly fetchImplementation: DocsFetch;
  private readonly alias: string;

  constructor(options: DocsRuntimeOptions = {}) {
    this.fetchImplementation = options.fetch ?? defaultFetch;
    this.alias = options.alias ?? "docs-browser";
  }

  get isInitialized(): boolean {
    return this.database !== undefined;
  }

  get store(): DocsDatabase {
    if (!this.database)
      throw new InternalError("Documentation runtime not initialized");
    return this.database;
  }

  async initialize(snapshotUrl: string): Promise<DocsDatabase> {
    const response = await this.fetchImplementation(snapshotUrl);
    if (!response.ok)
      throw new InternalError(
        `Failed to load docs snapshot: ${response.status}`
      );
    let snapshot: unknown;
    try {
      snapshot = await response.json();
    } catch (error) {
      throw new SerializationError(error);
    }
    validateDocsSnapshot(snapshot);
    return this.bootstrap(snapshot);
  }

  async bootstrap(snapshot: DocsSnapshotV1): Promise<DocsDatabase> {
    validateDocsSnapshot(snapshot);
    const database = new DocsDatabase({
      alias: DocsDatabase.nextAlias(
        `${this.alias}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`
      ),
    });
    await database.initialize();
    await hydrateDocsDatabase(database, snapshot);
    this.database = database;
    return database;
  }
}
