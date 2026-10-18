import {
  InternalError,
  SerializationError,
} from "@decaf-ts/db-decorators";
import { DocsRuntime, type DocsFetch } from "../../src/runtime/DocsRuntime";
import {
  DocsSnapshotValidationError,
  DocsTables,
  stableStringify,
} from "../../src/snapshot";
import { exportFixtureSnapshot } from "../unit/support/fixtures";

const RUNTIME_ALIAS = "runtime-test";

async function countTables(
  runtime: DocsRuntime
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    DocsTables.map(async (table) => [
      table.name,
      (
        await runtime.store.repositories()[table.name].select().execute()
      ).length,
    ])
  );
  return Object.fromEntries(entries);
}

function fetchReturning(payload: unknown): DocsFetch {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

describe("DocsRuntime", () => {
  it("throws InternalError from store before initialization", () => {
    const runtime = new DocsRuntime({ alias: RUNTIME_ALIAS });

    expect(runtime.isInitialized).toBe(false);
    expect(() => runtime.store).toThrow(InternalError);
    expect(() => runtime.store).toThrow(/not initialized/i);
  });

  it("uses the injected fetch and exposes a ready store", async () => {
    const snapshot = await exportFixtureSnapshot();
    const calls: string[] = [];
    const fetchImplementation: DocsFetch = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => snapshot,
      };
    };
    const runtime = new DocsRuntime({
      fetch: fetchImplementation,
      alias: RUNTIME_ALIAS,
    });

    const database = await runtime.initialize("https://example.test/snapshot.json");

    expect(calls).toEqual(["https://example.test/snapshot.json"]);
    expect(runtime.isInitialized).toBe(true);
    expect(runtime.store).toBe(database);
    expect(await database.pages.select().execute()).toHaveLength(1);
    expect(await database.doclets.select().execute()).toHaveLength(3);
  });

  it("does not duplicate records when initialized twice", async () => {
    const snapshot = await exportFixtureSnapshot();
    const runtime = new DocsRuntime({
      fetch: fetchReturning(snapshot),
      alias: RUNTIME_ALIAS,
    });

    await runtime.initialize("/snapshot.json");
    const firstCounts = await countTables(runtime);
    const firstStore = runtime.store;

    await runtime.initialize("/snapshot.json");
    const secondCounts = await countTables(runtime);

    expect(secondCounts).toEqual(firstCounts);
    expect(runtime.store).not.toBe(firstStore);
    expect(stableStringify(secondCounts)).toBe(stableStringify(firstCounts));
  });

  it("bootstraps directly from a validated snapshot", async () => {
    const snapshot = await exportFixtureSnapshot();
    const runtime = new DocsRuntime({ alias: RUNTIME_ALIAS });

    const database = await runtime.bootstrap(snapshot);

    expect(runtime.store).toBe(database);
    expect(await database.layouts.read("layout:default")).toBeDefined();
  });

  it("fails on a non-ok fetch response without exposing a store", async () => {
    const runtime = new DocsRuntime({
      fetch: async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
      alias: RUNTIME_ALIAS,
    });

    await expect(runtime.initialize("/snapshot.json")).rejects.toBeInstanceOf(
      InternalError
    );
    await expect(runtime.initialize("/snapshot.json")).rejects.toThrow(
      /Failed to load docs snapshot: 503/
    );
    expect(runtime.isInitialized).toBe(false);
    expect(() => runtime.store).toThrow(InternalError);
  });

  it("fails on an unreadable payload with SerializationError", async () => {
    const runtime = new DocsRuntime({
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("broken payload");
        },
      }),
      alias: RUNTIME_ALIAS,
    });

    await expect(runtime.initialize("/snapshot.json")).rejects.toBeInstanceOf(
      SerializationError
    );
    expect(runtime.isInitialized).toBe(false);
    expect(() => runtime.store).toThrow(InternalError);
  });

  it("fails on an invalid snapshot without partially hydrated state", async () => {
    const runtime = new DocsRuntime({
      fetch: fetchReturning({ schemaVersion: 2 }),
      alias: RUNTIME_ALIAS,
    });

    await expect(runtime.initialize("/snapshot.json")).rejects.toBeInstanceOf(
      DocsSnapshotValidationError
    );
    expect(runtime.isInitialized).toBe(false);
    expect(() => runtime.store).toThrow(InternalError);
  });

  it("fails on unresolved references without exposing a store", async () => {
    const snapshot = await exportFixtureSnapshot();
    snapshot.tables.pages[0].layoutId = "layout:missing";
    const runtime = new DocsRuntime({
      fetch: fetchReturning(snapshot),
      alias: RUNTIME_ALIAS,
    });

    await expect(runtime.initialize("/snapshot.json")).rejects.toThrow(
      /Unresolved reference "layout:missing"/
    );
    expect(runtime.isInitialized).toBe(false);
    expect(() => runtime.store).toThrow(InternalError);
  });
});
