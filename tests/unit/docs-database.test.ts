import { RamFlavour } from "@decaf-ts/core/ram";
import { ConflictError } from "@decaf-ts/db-decorators";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocLayoutModel } from "../../src/models";
import { DocsTableNames } from "../../src/snapshot";

describe("DocsDatabase", () => {
  it("registers a RamAdapter keyed by a unique alias", () => {
    const database = new DocsDatabase();

    expect(database.adapter).toBeDefined();
    expect(database.adapter.flavour).toBe(RamFlavour);
    expect(database.adapter.alias).toBe(database.alias);
    expect(DocsDatabase.isAliasRegistered(database.alias)).toBe(true);
    expect(database.isInitialized).toBe(false);
  });

  it("generates unique default aliases across instances", () => {
    const databases = Array.from({ length: 5 }, () => new DocsDatabase());
    const aliases = databases.map((database) => database.alias);

    expect(new Set(aliases).size).toBe(aliases.length);
    expect(aliases.every((alias) => alias.startsWith("decaf-docs-"))).toBe(true);
  });

  it("honours an explicit alias", () => {
    const alias = `docs-explicit-${Date.now()}-${Math.random()}`;
    const database = new DocsDatabase({ alias });

    expect(database.alias).toBe(alias);
    expect(database.adapter.alias).toBe(alias);
  });

  it("rejects a duplicate alias with ConflictError", () => {
    const database = new DocsDatabase();

    expect(() => new DocsDatabase({ alias: database.alias })).toThrow(
      ConflictError
    );
  });

  it("initializes the adapter idempotently", async () => {
    const database = new DocsDatabase();

    expect(database.isInitialized).toBe(false);
    await database.initialize();
    expect(database.isInitialized).toBe(true);
    await database.initialize();
    expect(database.isInitialized).toBe(true);
  });

  it("exposes one repository for every docs table", () => {
    const database = new DocsDatabase();
    const repositories = database.repositories();

    expect(Object.keys(repositories)).toEqual([...DocsTableNames]);
    for (const name of DocsTableNames) {
      const repository = repositories[name];
      expect(repository).toBeDefined();
      expect(repository).toBe(
        (database as unknown as Record<string, unknown>)[name]
      );
    }
  });

  it("keeps repositories isolated between databases", async () => {
    const first = new DocsDatabase();
    const second = new DocsDatabase();
    await first.initialize();
    await second.initialize();

    await first.layouts.create(
      new DocLayoutModel({ uid: "layout:isolated", name: "iso", tag: "div" })
    );

    expect(await first.layouts.read("layout:isolated")).toBeDefined();
    expect(await second.layouts.select().execute()).toHaveLength(0);
  });
});
